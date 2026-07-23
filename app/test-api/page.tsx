import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getCookieDomain } from "@/utils/supabase/cookie-domain"

// ── 통합 인증/구독 시스템 상수 ──────────────────────────────
const PROGRAM_ID = "drivermgmt"
const LOGIN_URL = "https://payment.1004.help/auth/login"
const SUBSCRIPTION_URL = "https://payment.1004.help/dashboard"
const VERIFY_API_BASE = "https://payment.1004.help/api/v1/verify-permission"
// ────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
// ── 개발/프리뷰 환경 예외 처리 ────────────────────────────
// *.vercel.app 도메인(v0 테스트 도메인)은 쿠키 도메인이 달라
// 검증 로직을 거치면 무한 리다이렉트가 발생하므로 바로 통과시킨다.
const requestHostname = request.nextUrl.hostname
if (requestHostname.endsWith(".vercel.app")) {
return NextResponse.next()
}
// ─────────────────────────────────────────────────────────

const pathname = request.nextUrl.pathname

// ── /debug 및 /api-test 경로 무조건 통과 ──────────────────────
if (pathname === "/debug" || pathname === "/api-test") {
return NextResponse.next()
}
// ─────────────────────────────────────────────────────────

// 현재 접속 도메인 기반 쿠키 도메인 분기 (.1004.help 또는 localhost 등)
const hostname = request.headers.get("host")?.split(":")[0] ?? null
const cookieDomain = getCookieDomain(hostname)

let supabaseResponse = NextResponse.next({ request })

// Fluid compute 환경: 매 요청마다 새 클라이언트 생성 (전역 변수 금지)
const supabase = createServerClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
cookieOptions: {
domain: cookieDomain,
path: "/",
sameSite: "lax",
secure: cookieDomain !== undefined,
},
cookies: {
getAll() {
return request.cookies.getAll()
},
setAll(cookiesToSet) {
cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
supabaseResponse = NextResponse.next({ request })
cookiesToSet.forEach(({ name, value, options }) =>
supabaseResponse.cookies.set(name, value, {
...options,
domain: cookieDomain,
path: "/",
sameSite: "lax",
secure: cookieDomain !== undefined,
}),
)
},
},
},
)

// createServerClient 와 getUser() 사이에 다른 코드를 넣지 말 것.
const {
data: { user },
} = await supabase.auth.getUser()

// ── 현재 URL 생성 (리다이렉트용) ─────────────────────────
const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")
const host = request.headers.get("host") ?? request.nextUrl.host
const currentUrl = `${proto}://${host}${pathname}${request.nextUrl.search}`
const isApiRoute = pathname.startsWith("/api/")

// ── 쿠키 문자열 직렬화 (Central API 전달용) ───────────────
const cookieString = request.cookies
.getAll()
.map(({ name, value }) => `${name}=${value}`)
.join("; ")

// ── 중앙 API 호출: 권한 검증 ─────────────────────────────
// Edge 캐시를 막기 위해 타임스탬프(_t) 쿼리파라미터를 추가하고,
// 현재 요청의 쿠키를 Cookie 헤더에 수동으로 전달한다.
let permissionData: Record<string, unknown> | null = null
try {
const verifyUrl = `${VERIFY_API_BASE}?program_id=${PROGRAM_ID}&_t=${Date.now()}`
const verifyRes = await fetch(verifyUrl, {
method: "GET",
headers: {
Cookie: cookieString,
},
})
if (verifyRes.ok) {
permissionData = (await verifyRes.json()) as Record<string, unknown>
}
} catch (err) {
console.error("[Middleware] verify-permission API 호출 실패:", err)
}

// ── 케이스 A: 미인증 ──────────────────────────────────────
// API 응답에 유저 정보가 없거나 authenticated 가 false인 경우
const isAuthenticated =
permissionData !== null &&
(permissionData.authenticated === true || permissionData.authenticated === "true")

if (!user || !isAuthenticated) {
if (isApiRoute) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
// 메인 페이지(/)는 클라이언트 팝업 모달로 로그인 유도 → 리다이렉트 없이 통과
if (pathname === "/") {
return supabaseResponse
}
const loginUrl = new URL(LOGIN_URL)
loginUrl.searchParams.set("next", currentUrl)
return NextResponse.redirect(loginUrl)
}

console.log("[Middleware Debug] permissionData:", JSON.stringify(permissionData));

// ── 케이스 B: 인증됨, 권한 만료/없음 ─────────────────────
// API 응답 구조가 중첩되어 있으므로 permission 객체를 안전하게 추출
const perm = (permissionData?.permission as Record<string, unknown>) || {}

// is_active 가 true 이거나, approval_status 가 'approved' 이면 활성화된 것으로 간주
const isActive =
perm.is_active === true ||
perm.is_active === "true" ||
perm.isActive === true ||
perm.isActive === "true" ||
perm.approval_status === "approved" ||
perm.approvalStatus === "approved"

const expiresAtRaw =
(perm.expires_at as string | null | undefined) ??
(perm.expiresAt as string | null | undefined) ??
null

// 만료일이 없거나 null 이면 무제한(만료 안 됨)으로 간주
const isExpired =
expiresAtRaw !== null && expiresAtRaw !== undefined
? new Date(expiresAtRaw).getTime() < Date.now()
: false

if (!isActive || isExpired) {
if (isApiRoute) {
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
}
// 메인 페이지(/)는 구독 권한이 없어도 튕기지 않고 화면을 보여줌
if (pathname === "/") {
return supabaseResponse
}
return NextResponse.redirect(SUBSCRIPTION_URL)
}

// ── 케이스 C: 정상 통과 + 헤더 주입 ─────────────────────
// API 응답에서 유저 등급, 회사명, 회사코드를 추출하여 request headers에 주입
const comp = (permissionData?.company as Record<string, unknown>) || {}
const userLevel = String(perm.user_level ?? perm.userLevel ?? "")
const companyName = String(comp.name ?? permissionData?.company_name ?? permissionData?.companyName ?? "")
const companyCode = String(comp.code ?? permissionData?.company_code ?? permissionData?.companyCode ?? "")

// 기존 request headers를 복사한 뒤 커스텀 헤더를 추가한다
const requestHeaders = new Headers(request.headers)
requestHeaders.set("X-User-Level", userLevel)
requestHeaders.set("X-Company-Name", companyName)
requestHeaders.set("X-Company-Code", companyCode)

// supabaseResponse 가 갱신한 쿠키를 보존하면서 새 헤더를 주입한 응답을 생성
const finalResponse = NextResponse.next({
request: {
headers: requestHeaders,
},
})

// Supabase 세션 쿠키 갱신 정보를 finalResponse 에 복사
supabaseResponse.cookies.getAll().forEach(({ name, value, ...cookieOptions }) => {
finalResponse.cookies.set(name, value, cookieOptions)
})

return finalResponse
}

export const config = {
matcher: [
/*
* 아래 경로를 제외한 모든 요청에 매칭:
* - _next/static (정적 파일)
* - _next/image (이미지 최적화 파일)
* - favicon.ico, 정적 이미지 (svg, png, jpg 등)
* - manifest.json, sw.js (PWA 관련 파일)
* ※ /api 경로는 의도적으로 포함 → 권한 검증 및 헤더 주입 적용
*/
"/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
],
}
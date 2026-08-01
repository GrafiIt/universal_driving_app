import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getCookieDomain } from "@/utils/supabase/cookie-domain"

// ── 통합 인증/구독 시스템 상수 ──────────────────────────────
/** 현재 SaaS 프로그램의 고유 서비스명 (DB 저장 키값) */
const PROGRAM_ID = "DailyDrivingCheck"
/** 통합 결제 사이트 로그인 주소 */
const LOGIN_URL = "https://payment.1004.help/auth/login"
/** 통합 결제 사이트 구독 관리 주소 */
const SUBSCRIPTION_URL = "https://payment.1004.help/dashboard/subscriptions"
// ────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  // ── 개발/프리뷰 환경 예외 처리 ────────────────────────────
  // 1) Supabase 환경 변수가 없으면 인증 로직 실행 불가 → 바로 통과
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next()
  }
  // 2) *.vercel.app 도메인(v0 테스트 도메인)은 쿠키 도메인이 달라
  //    검증 로직을 거치면 무한 리다이렉트가 발생하므로 바로 통과시킨다.
  const requestHostname = request.nextUrl.hostname
  if (requestHostname.endsWith(".vercel.app")) {
    return NextResponse.next()
  }
  // ─────────────────────────────────────────────────────────

  // ── 퍼블릭 라우트(로그인 불필요) 우회 처리 ─────────────────
  // 루트(/)는 온보딩용 퍼블릭 랜딩 페이지, /install 은 PWA 설치 안내 페이지로
  // 미인증 사용자도 접근할 수 있어야 하므로 권한 검증을 건너뛴다.
  const currentPathname = request.nextUrl.pathname
  const isPublicRoute = currentPathname === "/" || currentPathname.startsWith("/install")
  if (isPublicRoute) {
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
            // Supabase가 넘기는 options 에는 domain 이 없으므로 강제 병합한다.
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

  // ── 통합 결제 허브 권한 검증 API 호출 ────────────────────
  const verifyUrl = `https://payment.1004.help/api/v1/verify-permission?program_id=${PROGRAM_ID}&_t=${Date.now()}`
  const pathname = request.nextUrl.pathname

  // API 라우트(`/api/`) 요청 여부.
  // API 요청에 대해서는 차단 시 HTML 로그인 페이지로 redirect 하면
  // 프론트엔드 fetch 에서 CORS / JSON 파싱 에러가 발생하므로,
  // redirect 대신 JSON 401 응답을 반환해야 한다.
  const isApiRequest = pathname.startsWith("/api/")

  // request.cookies.getAll() 로 재조합 → 에지 리다이렉트 시 쿠키 누락 방지
  const cookieHeader = request.cookies.getAll().map(c => `${c.name}=${c.value}`).join("; ")

  let verifyData: {
    authenticated?: boolean
    user?: unknown
    permission?: {
      program_id?: string
      is_active?: boolean | string
      isActive?: boolean | string
      expires_at?: string | null
      expiresAt?: string | null
      user_level?: string | number
      userLevel?: string | number
    }
    company?: { name?: string; code?: string }
  } = {}

  try {
    const verifyRes = await fetch(verifyUrl, {
      headers: { cookie: cookieHeader },
      // Edge Runtime 에서 캐시를 사용하지 않도록 설정
      cache: "no-store",
    })
    if (verifyRes.ok) {
      verifyData = await verifyRes.json()
    }
  } catch {
    // 네트워크 오류 시 미인증으로 간주
  }

  // ── 케이스 A: 미인증 처리 ─────────────────────────────────
  if (!verifyData.authenticated || !verifyData.user) {
    // API 요청이면 HTML 로그인 페이지 대신 JSON 401 반환
    if (isApiRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const loginUrl = new URL(LOGIN_URL)
    loginUrl.searchParams.set("next", encodeURIComponent(request.url))
    return NextResponse.redirect(loginUrl)
  }

  // ── 디버깅 라우트 예외: /debug 는 케이스 B를 완전히 우회 ──
  if (pathname === "/debug") {
    return supabaseResponse
  }

  // ── 케이스 B: 인증됨, SaaS 권한 없음/만료 ────────────────
  const permission = verifyData.permission

  // 스네이크 케이스·카멜케이스·문자열 "true" 모두 정상(true)으로 처리
  const rawActive = permission?.is_active ?? permission?.isActive
  const isActive = rawActive === true || rawActive === "true"

  // 만료일이 없거나 null 이면 '만료되지 않음(false)'으로 안전하게 처리
  const expiresAtRaw = permission?.expires_at ?? permission?.expiresAt ?? null
  const isExpired = expiresAtRaw ? new Date(expiresAtRaw).getTime() < Date.now() : false

  if (!permission || !isActive || isExpired) {
    // API 요청이면 HTML 로그인 페이지 대신 JSON 401 반환
    if (isApiRequest) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // 케이스 B: 인증됨 + SaaS 구독 권한 없음/만료
    // → 케이스 A와 동일하게 결제 허브 로그인 페이지로 강제 리다이렉트
    const loginUrl = new URL(LOGIN_URL)
    loginUrl.searchParams.set("next", encodeURIComponent(request.url))
    return NextResponse.redirect(loginUrl)
  }

  // ── 케이스 C: 인증됨, SaaS 권한도 있음 → 정상 통과 ───────
  // API가 리턴한 유저 등급/회사명을 헤더에 주입하여 Page.tsx 에서 활용 가능하게 한다.
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set(
    "X-User-Level",
    String(permission.user_level ?? permission.userLevel ?? ""),
  )
  requestHeaders.set(
    "X-Company-Name",
    encodeURIComponent(verifyData.company?.name ?? ""),
  )
  requestHeaders.set("X-Company-Code", verifyData.company?.code ?? "")
  requestHeaders.set("X-User-Role", (verifyData.user as { role?: string } | null)?.role ?? "")

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  // supabaseResponse 에 설정된 쿠키(갱신된 세션 등)를 최종 응답에 복사한다.
  supabaseResponse.cookies.getAll().forEach(({ name, value }) => {
    response.cookies.set(name, value)
  })

  return response
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 매칭:
     * - api (API 라우트) → 단, `/api/v1/users/me` 는 예외적으로 미들웨어를 태워
     *   X-User-Level 헤더를 주입받아야 하므로 매칭 대상에 포함시킨다.
     *   (부��� 룩어헤드 `api(?!/v1/users/me)`: api 로 시작하되 /v1/users/me 가
     *    뒤따르지 않는 경로만 제외 → 결제 허브 등 외부 API 충돌 방지)
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화 파일)
     * - favicon.ico, 정적 이미지 (svg, png, jpg 등)
     * - manifest.json, sw.js (PWA 관련 파일)
     */
    "/((?!api(?!/v1/users/me)|_next/static|_next/image|favicon.ico|debug|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}

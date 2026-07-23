import { cookies, headers } from "next/headers"

// ── 테스트 대상 상수 ──────────────────────────────
const PROGRAM_ID = "DailyDrivingCheck"
const VERIFY_API_BASE = "https://payment.1004.help/api/v1/verify-permission"
// ──────────────────────────────────────────────────

export default async function ApiTestPage() {
  // 1. 현재 요청의 쿠키 및 미들웨어가 주입한 헤더 가져오기
  const cookieStore = await cookies()
  const cookieString = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ")

  const headersList = await headers()
  const injectedUserLevel = headersList.get("X-User-Level") || "없음 (미들웨어 미작동 또는 미인증)"
  const injectedCompanyName = headersList.get("X-Company-Name") || "없음"
  const injectedCompanyCode = headersList.get("X-Company-Code") || "없음"

  let permissionData = null
  let errorMessage = null
  let statusCode = null

  // 2. 권한 검증 API 직접 호출 테스트
  try {
    const verifyUrl = `${VERIFY_API_BASE}?program_id=${PROGRAM_ID}&_t=${Date.now()}`
    const verifyRes = await fetch(verifyUrl, {
      method: "GET",
      headers: {
        Cookie: cookieString,
      },
      cache: "no-store", // 실시간 테스트를 위해 캐시 무효화
    })

    statusCode = verifyRes.status

    if (verifyRes.ok) {
      permissionData = await verifyRes.json()
    } else {
      errorMessage = await verifyRes.text()
    }
  } catch (err: any) {
    errorMessage = err.message || "API 호출 중 알 수 없는 오류가 발생했습니다."
  }

  // 3. 디버깅 대시보드 UI 렌더링
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans text-gray-800">
      <div className="max-w-4xl mx-auto space-y-6">
        <header className="border-b pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">SaaS 권한 및 미들웨어 상태 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">Program ID: <span className="font-mono bg-gray-200 px-1 rounded">{PROGRAM_ID}</span></p>
        </header>

        {/* 미들웨어 주입 헤더 검증 영역 */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold border-l-4 border-blue-500 pl-3 mb-4">1. 미들웨어 헤더 주입 결과</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded border">
              <p className="text-sm text-gray-500 mb-1">X-User-Level</p>
              <p className="font-medium text-gray-900">{injectedUserLevel}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded border">
              <p className="text-sm text-gray-500 mb-1">X-Company-Name</p>
              <p className="font-medium text-gray-900">{injectedCompanyName}</p>
            </div>
            <div className="bg-gray-50 p-4 rounded border">
              <p className="text-sm text-gray-500 mb-1">X-Company-Code</p>
              <p className="font-medium text-gray-900">{injectedCompanyCode}</p>
            </div>
          </div>
        </section>

        {/* API 직접 호출 응답 영역 */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold border-l-4 border-green-500 pl-3 mb-4">2. 백엔드 API 직접 호출 결과</h2>
          <div className="mb-4">
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${statusCode === 200 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
              HTTP Status: {statusCode ?? "N/A"}
            </span>
          </div>

          {errorMessage ? (
            <div className="bg-red-50 text-red-700 p-4 rounded border border-red-200 overflow-x-auto">
              <pre className="text-sm">{errorMessage}</pre>
            </div>
          ) : (
            <div className="bg-gray-900 text-green-400 p-4 rounded border overflow-x-auto">
              <pre className="text-sm font-mono">{JSON.stringify(permissionData, null, 2)}</pre>
            </div>
          )}
        </section>

        {/* 쿠키 데이터 확인 영역 */}
        <section className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold border-l-4 border-purple-500 pl-3 mb-4">3. 브라우저 쿠키 (요청에 사용됨)</h2>
          <div className="bg-gray-100 p-4 rounded border overflow-x-auto text-sm text-gray-700 font-mono">
            {cookieString || "전송된 쿠키가 없습니다."}
          </div>
        </section>
      </div>
    </div>
  )
}

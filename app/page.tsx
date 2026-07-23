'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Smartphone, Loader2 } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function LandingPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleStart = async () => {
    setIsLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()

      // 1. 미로그인 상태 처리
      if (!session) {
        console.log('[DEBUG] 세션 없음 -> 로그인 페이지로 이동')
        const currentUrl = window.location.href
        const loginUrl = new URL('https://payment.1004.help/auth/login')
        loginUrl.searchParams.set('next', currentUrl)
        window.location.href = loginUrl.toString()
        return
      }

      console.log('[DEBUG] 로그인 세션 확인됨:', session.user.id, session.user.email)

      // 2. 차량 배정 여부 조회 (ID 또는 이메일 매칭)
      const { data, error } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_vehicles')
        .select('id, vehicle_number')
        .or(`driver_id.eq.${session.user.id},driver_id.eq.${session.user.email}`)
        .maybeSingle()

      if (error) {
        console.error('[DEBUG] 차량 조회 오류:', error)
      }

      console.log('[DEBUG] 조회된 차량 데이터:', data)

      // 3. 차량 배정 결과에 따른 라우팅
      if (!data) {
        console.log('[DEBUG] 배정된 차량 없음 -> /unassigned 로 이동')
        router.push('/unassigned')
      } else {
        console.log('[DEBUG] 배정된 차량 있음 -> /checklist 로 이동')
        router.push('/checklist')
      }
    } catch (err) {
      console.error('[DEBUG] handleStart 예외 발생:', err)
      // 예외 발생 시 안전하게 로그인 페이지로 안내
      const currentUrl = window.location.href
      const loginUrl = new URL('https://payment.1004.help/auth/login')
      loginUrl.searchParams.set('next', currentUrl)
      window.location.href = loginUrl.toString()
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen w-full flex-col items-center bg-white px-6 pb-28 pt-12">
      {/* 최상단: 운수종사자 일상 점검 로고 */}
      <header className="flex w-full justify-center">
        <Image
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E1%84%8B%E1%85%AE%E1%86%AB%E1%84%89%E1%85%AE%E1%84%8C%E1%85%A9%E1%86%BC%E1%84%89%E1%85%A1%E1%84%8C%E1%85%A1_%E1%84%8B%E1%85%B5%E1%86%AF%E1%84%8B%E1%85%B5%E1%86%AF%E1%84%8C%E1%85%A5%E1%86%B7%E1%84%80%E1%85%A5%E1%86%B7_%E1%84%91%E1%85%A1%E1%84%87%E1%85%B5%E1%84%8F%E1%85%A9%E1%86%AB-xlKIl8cHfJcqJBJpf7zIuwZwuEKoWn.png"
          alt="운수종사자 일상 점검 로고"
          width={200}
          height={64}
          priority
          className="h-auto w-40 object-contain"
        />
      </header>

      {/* 중앙 영역 */}
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        {/* 중앙 상단: 타이틀 */}
        <h1 className="text-balance text-3xl font-bold leading-snug text-gray-900 sm:text-4xl">
          운수종사자
          <br />
          일상 점검
        </h1>

        {/* 중앙 하단: 휴대폰 설치 안내 */}
        <Link
          href="/install"
          className="flex flex-col items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-8 py-6 transition-colors hover:bg-gray-100"
        >
          <Smartphone size={40} className="text-[#ff6b35]" aria-hidden="true" />
          <span className="text-base font-semibold text-gray-800">휴대폰에 앱 설치하기</span>
        </Link>
      </div>

      {/* 최하단: 화면 하단 고정 시작하기 버튼 */}
      <div className="fixed inset-x-0 bottom-0 border-t border-gray-100 bg-white/95 p-4 backdrop-blur">
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="mx-auto flex h-14 w-full max-w-md items-center justify-center rounded-2xl bg-[#ff6b35] text-lg font-bold text-white shadow-lg shadow-orange-500/30 transition-colors hover:bg-[#e85f2e] active:bg-[#d1552a] disabled:opacity-70"
        >
          {isLoading ? (
            <Loader2 size={24} className="animate-spin" />
          ) : (
            '시작하기'
          )}
        </button>
      </div>
    </main>
  )
}

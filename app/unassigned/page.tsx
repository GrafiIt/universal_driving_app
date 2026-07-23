'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { AlertCircle, User, Mail, Phone, RotateCw, Home, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

export default function UnassignedPage() {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.reload()
  }

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* 상단 헤더 */}
      <header className="flex items-center px-5 pt-4 pb-4 bg-white gap-4 border-b border-gray-200">
        <div className="flex-shrink-0">
          <Image
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/%E1%84%8B%E1%85%AE%E1%86%AB%E1%84%89%E1%85%AE%E1%84%8C%E1%85%A9%E1%86%BC%E1%84%89%E1%85%A1%E1%84%8C%E1%85%A1_%E1%84%8B%E1%85%B5%E1%86%AF%E1%84%8B%E1%85%B5%E1%86%AF%E1%84%8C%E1%85%A5%E1%86%B7%E1%84%80%E1%85%A5%E1%86%B7_%E1%84%91%E1%85%A1%E1%84%87%E1%85%B5%E1%84%8F%E1%85%A9%E1%86%AB-xlKIl8cHfJcqJBJpf7zIuwZwuEKoWn.png"
            alt="운수종사자 일상 점검 로고"
            width={48}
            height={40}
            priority
            className="object-contain"
          />
        </div>
        <div className="flex-1 flex justify-center">
          <h1 className="text-[17px] font-bold text-[#1a3a52] leading-tight tracking-tight">
            운수종사자 일상 점검
          </h1>
        </div>
        <div className="w-10 h-10 flex-shrink-0" aria-hidden="true" />
      </header>

      {/* 본문 */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-10 gap-8">
        {/* 안내 메시지 */}
        <div className="flex flex-col items-center text-center gap-4">
          <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center">
            <AlertCircle size={40} className="text-[#ff6b35]" />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xl font-bold text-[#1a3a52] text-balance leading-snug">
              매칭된 차량이 없습니다.
            </p>
            <p className="text-base font-medium text-gray-600 text-balance leading-relaxed">
              관리자에게 문의하세요.
            </p>
          </div>
        </div>

        {/* 관리자 연락처 카드 */}
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-none overflow-hidden">
          <div className="bg-[#1a3a52] px-5 py-3">
            <h2 className="text-sm font-bold text-white tracking-tight">전산 관리자 안내</h2>
          </div>

          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">담당자</span>
            <span className="text-sm font-bold text-[#1a3a52] text-right">
              관리자
            </span>
          </div>

          <a
            href="mailto:admin@example.com"
            className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Mail size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">E-mail</span>
            <span className="text-sm font-bold text-[#1a3a52] text-right break-all">
              admin@example.com
            </span>
          </a>

          <a
            href="tel:010-0000-0000"
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">연락처</span>
            <span className="text-sm font-bold text-[#1a3a52] text-right">010-0000-0000</span>
          </a>
        </div>
      </main>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 mt-auto px-4 pb-6 pt-3 bg-white border-t border-gray-200 flex flex-col gap-2.5">
        <button
          onClick={() => window.location.reload()}
          className="w-full h-14 bg-[#ff6b35] hover:bg-[#e55a24] active:bg-[#cc4910] text-white text-lg font-bold rounded-none transition-colors flex items-center justify-center gap-2"
        >
          <RotateCw size={20} />
          다시 시도
        </button>
        <button
          onClick={handleLogout}
          className="w-full h-12 bg-[#1a3a52] hover:bg-[#142e42] active:bg-[#0e2232] text-white text-base font-bold rounded-none transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          로그아웃
        </button>
        <button
          onClick={() => router.push('/checklist')}
          className="w-full h-12 bg-white border border-gray-300 text-[#1a3a52] text-base font-bold rounded-none transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <Home size={18} />
          홈으로 돌아가기
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, User, Mail, Phone, Home, LogOut } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

const FALLBACK_CONTACT = {
  manager_name: '관리자',
  manager_email: 'admin@example.com',
  manager_phone: '010-0000-0000',
}

export default function UnassignedPage() {
  const router = useRouter()
  const [contact, setContact] = useState(FALLBACK_CONTACT)

  useEffect(() => {
    const fetchContact = async () => {
      try {
        // /api/v1/users/me 에서 company 식별자 취득
        let companyCode: string | null = null
        try {
          const res = await fetch('/api/v1/users/me')
          if (res.ok) {
            const json = await res.json()
            // companyCode가 없으면 companyName을 회사 식별자로 사용
            companyCode = json.companyCode || json.company_code || json.companyName || 'default_company'
          }
        } catch {
          companyCode = 'default_company'
        }

        if (!companyCode) return

        const supabase = createClient()
        const { data } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_company_contacts')
          .select('manager_name, manager_email, manager_phone')
          .eq('company_id', companyCode)
          .single()

        if (data) {
          setContact({
            manager_name: data.manager_name || FALLBACK_CONTACT.manager_name,
            manager_email: data.manager_email || FALLBACK_CONTACT.manager_email,
            manager_phone: data.manager_phone || FALLBACK_CONTACT.manager_phone,
          })
        }
      } catch {
        // fallback 유지
      }
    }

    fetchContact()
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
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
              {contact.manager_name}
            </span>
          </div>

          <a
            href={`mailto:${contact.manager_email}`}
            className="flex items-center gap-3 px-5 py-4 border-b border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Mail size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">E-mail</span>
            <span className="text-sm font-bold text-[#1a3a52] text-right break-all">
              {contact.manager_email}
            </span>
          </a>

          <a
            href={`tel:${contact.manager_phone}`}
            className="flex items-center gap-3 px-5 py-4 hover:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">연락처</span>
            <span className="text-sm font-bold text-[#1a3a52] text-right">{contact.manager_phone}</span>
          </a>
        </div>
      </main>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 mt-auto px-4 pb-6 pt-3 bg-white border-t border-gray-200 flex flex-col gap-2.5">
        <button
          onClick={() => router.push('/')}
          className="w-full h-12 bg-white border border-gray-300 text-[#1a3a52] text-base font-bold rounded-none transition-colors hover:bg-gray-50 flex items-center justify-center gap-2"
        >
          <Home size={18} />
          홈으로 돌아가기
        </button>
        <button
          onClick={handleLogout}
          className="w-full h-12 bg-[#1a3a52] hover:bg-[#142e42] active:bg-[#0e2232] text-white text-base font-bold rounded-none transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { Save, RefreshCw, User, Mail, Phone } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────
interface ContactInfo {
  manager_name: string
  manager_email: string
  manager_phone: string
}

// ─────────────────────────────────────────
// 휴대폰 번호 자동 하이픈 포맷터
// ─────────────────────────────────────────
function formatPhoneNumber(value: string): string {
  const nums = value.replace(/[^0-9]/g, '')
  if (nums.length <= 3) return nums
  if (nums.length <= 7) return `${nums.slice(0, 3)}-${nums.slice(3)}`
  return `${nums.slice(0, 3)}-${nums.slice(3, 7)}-${nums.slice(7, 11)}`
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function EmergencyContacts() {
  const [contactForm, setContactForm] = useState<ContactInfo>({
    manager_name: '',
    manager_email: '',
    manager_phone: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    const init = async () => {
      // 1) /api/v1/users/me 로 company 식별자 취득
      let cid: string | null = null
      try {
        const res = await fetch('/api/v1/users/me')
        if (res.ok) {
          const json = await res.json()
          cid = json.companyCode || json.company_code || json.companyName || 'default_company'
        }
      } catch {
        cid = 'default_company'
      }

      setCompanyId(cid)

      // 2) 관리자 연락처 조회
      if (cid) {
        const supabase = createClient()
        const { data: contactData } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_company_contacts')
          .select('manager_name, manager_email, manager_phone')
          .eq('company_id', cid)
          .single()

        if (contactData) {
          setContactForm({
            manager_name: contactData.manager_name ?? '',
            manager_email: contactData.manager_email ?? '',
            manager_phone: contactData.manager_phone ?? '',
          })
        }
      }
    }

    init()
  }, [])

  // ── 관리자 연락처 저장 ──
  const handleSave = async () => {
    if (!companyId) {
      setSaveMessage({ type: 'error', text: 'company_id를 확인할 수 없습니다.' })
      return
    }

    setIsSaving(true)
    setSaveMessage(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_company_contacts')
        .upsert(
          {
            company_id: companyId,
            manager_name: contactForm.manager_name,
            manager_email: contactForm.manager_email,
            manager_phone: contactForm.manager_phone,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'company_id' }
        )

      if (error) throw new Error(error.message)
      setSaveMessage({ type: 'success', text: '관리자 연락처가 저장되었습니다.' })
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.',
      })
    } finally {
      setIsSaving(false)
      setTimeout(() => setSaveMessage(null), 4000)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* 카드 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-base font-bold text-slate-900">관리자 연락처 설정</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              차량 미배정자 안내 페이지에 표시되는 담당자 정보입니다.
            </p>
          </div>
        </div>

        {/* 폼 */}
        <div className="px-6 py-5">
          <div className="flex flex-wrap gap-3 items-end">
            {/* 담당자명 */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <User size={13} className="text-slate-400" />
                담당자명
              </label>
              <input
                type="text"
                value={contactForm.manager_name}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, manager_name: e.target.value }))
                }
                placeholder="홍길동"
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
              />
            </div>

            {/* E-mail */}
            <div className="flex flex-col gap-1.5 min-w-[220px] flex-1">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Mail size={13} className="text-slate-400" />
                E-mail
              </label>
              <input
                type="email"
                value={contactForm.manager_email}
                onChange={(e) =>
                  setContactForm((prev) => ({ ...prev, manager_email: e.target.value }))
                }
                placeholder="admin@company.com"
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
              />
            </div>

            {/* 휴대폰 번호 */}
            <div className="flex flex-col gap-1.5 min-w-[160px]">
              <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                <Phone size={13} className="text-slate-400" />
                휴대폰 번호
              </label>
              <input
                type="tel"
                value={contactForm.manager_phone}
                onChange={(e) => {
                  const formatted = formatPhoneNumber(e.target.value)
                  setContactForm((prev) => ({ ...prev, manager_phone: formatted }))
                }}
                placeholder="010-0000-0000"
                maxLength={13}
                className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
              />
            </div>

            {/* 저장 버튼 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-transparent select-none">저장</label>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="h-10 inline-flex items-center gap-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-slate-900 px-5 text-sm font-semibold text-white transition-colors disabled:opacity-60"
              >
                {isSaving ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Save size={15} />
                )}
                저장하기
              </button>
            </div>
          </div>

          {/* 저장 메시지 */}
          {saveMessage && (
            <p
              className={`mt-3 text-xs font-medium ${
                saveMessage.type === 'success' ? 'text-emerald-600' : 'text-red-500'
              }`}
            >
              {saveMessage.text}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

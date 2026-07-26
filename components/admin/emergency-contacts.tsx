'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Save, RefreshCw, User, Mail, Phone, ChevronLeft, ChevronRight } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────
interface ContactInfo {
  manager_name: string
  manager_email: string
  manager_phone: string
}

interface MemberRow {
  id: string
  driver_name: string | null
  vehicle_number: string | null
  created_at: string
}

const PAGE_SIZE = 20

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function EmergencyContacts() {
  // ── 상단: 관리자 연락처 ──
  const [contactForm, setContactForm] = useState<ContactInfo>({
    manager_name: '',
    manager_email: '',
    manager_phone: '',
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [companyId, setCompanyId] = useState<string | null>(null)

  // ── 하단: 회원 목록 ──
  const [members, setMembers] = useState<MemberRow[]>([])
  const [filteredMembers, setFilteredMembers] = useState<MemberRow[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMembers, setIsLoadingMembers] = useState(true)
  const [membersError, setMembersError] = useState<string | null>(null)

  // ── 초기 데이터 로드 ──
  useEffect(() => {
    const init = async () => {
      // 1) /api/v1/users/me 로 companyCode 취득
      let cid: string | null = null
      try {
        const res = await fetch('/api/v1/users/me')
        if (res.ok) {
          const json = await res.json()
          cid = json.companyCode ?? json.company_code ?? null
        }
      } catch {
        cid = null
      }

      setCompanyId(cid)

      const supabase = createClient()

      // 2) 관리자 연락처 조회
      if (cid) {
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

      // 3) 차량/기사 목록 조회 (universal_driving_check_vehicles)
      setIsLoadingMembers(true)
      setMembersError(null)
      try {
        const query = supabase
          .schema('driver-checklist')
          .from('universal_driving_check_vehicles')
          .select('id, driver_name, vehicle_number, created_at')
          .order('created_at', { ascending: false })

        if (cid) {
          query.eq('company_id', cid)
        }

        const { data: memberData, error: memberError } = await query
        if (memberError) throw new Error(memberError.message)
        setMembers(memberData ?? [])
        setFilteredMembers(memberData ?? [])
      } catch (err) {
        setMembersError(err instanceof Error ? err.message : '목록 조회 중 오류가 발생했습니다.')
      } finally {
        setIsLoadingMembers(false)
      }
    }

    init()
  }, [])

  // ── 검색 필터 ──
  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      setFilteredMembers(members)
    } else {
      setFilteredMembers(
        members.filter((m) =>
          (m.driver_name ?? '').toLowerCase().includes(q) ||
          (m.vehicle_number ?? '').toLowerCase().includes(q)
        )
      )
    }
    setCurrentPage(1)
  }, [searchQuery, members])

  // ── 페이지네이션 ──
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE))
  const pagedMembers = filteredMembers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  )

  const getPageNumbers = useCallback(() => {
    const pages: (number | '...')[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      pages.push(1)
      if (currentPage > 3) pages.push('...')
      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)
      for (let i = start; i <= end; i++) pages.push(i)
      if (currentPage < totalPages - 2) pages.push('...')
      pages.push(totalPages)
    }
    return pages
  }, [totalPages, currentPage])

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

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full gap-0" style={{ minHeight: 0 }}>
      {/* ─── 상단 1/5: 관리자 연락처 설정 ─── */}
      <div className="flex-none">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden mb-5">
          {/* 카드 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div>
              <h2 className="text-base font-bold text-slate-900">관리자 연락처 설정</h2>
              <p className="mt-0.5 text-xs text-slate-500">차량 미배정자 안내 페이지에 표시되는 담당자 정보입니다.</p>
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
                  onChange={(e) => setContactForm((prev) => ({ ...prev, manager_name: e.target.value }))}
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
                  onChange={(e) => setContactForm((prev) => ({ ...prev, manager_email: e.target.value }))}
                  placeholder="admin@company.com"
                  className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
                />
              </div>

              {/* 전화번호 */}
              <div className="flex flex-col gap-1.5 min-w-[160px]">
                <label className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400" />
                  전화번호
                </label>
                <input
                  type="tel"
                  value={contactForm.manager_phone}
                  onChange={(e) => setContactForm((prev) => ({ ...prev, manager_phone: e.target.value }))}
                  placeholder="010-0000-0000"
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

      {/* ─── 하단 4/5: 회원 연락처 목록 ─── */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-full">
          {/* 카드 헤더 + 검색 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 flex-none">
            <div>
              <h2 className="text-base font-bold text-slate-900">회원 연락처 목록</h2>
              <p className="mt-0.5 text-xs text-slate-500">
                총 {filteredMembers.length}명
                {searchQuery && ` (검색 결과)`}
              </p>
            </div>
            {/* 검색 */}
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="성명 또는 차량번호 검색"
                className="h-9 w-64 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 transition-colors"
              />
            </div>
          </div>

          {/* 테이블 */}
          <div className="flex-1 overflow-auto">
            <table className="w-full min-w-[560px] border-collapse text-sm">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-100 border-b border-slate-200">
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap w-14">
                    No.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 whitespace-nowrap">
                    운수종사자명(성명)
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 whitespace-nowrap">
                    차량번호
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap w-28">
                    등록일
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoadingMembers && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400">
                      데이터를 불러오는 중입니다...
                    </td>
                  </tr>
                )}
                {membersError && !isLoadingMembers && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-red-500 text-xs">
                      오류: {membersError}
                    </td>
                  </tr>
                )}
                {!isLoadingMembers && !membersError && pagedMembers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-slate-400">
                      {searchQuery ? '검색 결과가 없습니다.' : '등록된 차량/기사가 없습니다.'}
                    </td>
                  </tr>
                )}
                {!isLoadingMembers &&
                  !membersError &&
                  pagedMembers.map((member, idx) => (
                    <tr
                      key={member.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-center text-xs text-slate-400">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                        {member.driver_name ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 whitespace-nowrap">
                        {member.vehicle_number ?? <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(member.created_at)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {!isLoadingMembers && !membersError && filteredMembers.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-1 border-t border-slate-100 px-6 py-3 flex-none">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="이전 페이지"
              >
                <ChevronLeft size={16} />
              </button>

              {getPageNumbers().map((page, i) =>
                page === '...' ? (
                  <span key={`ellipsis-${i}`} className="flex h-8 w-8 items-center justify-center text-xs text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page as number)}
                    className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-semibold transition-colors ${
                      currentPage === page
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                    }`}
                  >
                    {page}
                  </button>
                )
              )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="다음 페이지"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

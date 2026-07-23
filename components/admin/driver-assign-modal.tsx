'use client'

import { useEffect, useState } from 'react'
import { X, Search, UserRound, Check, RefreshCw } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import type { VehicleRow } from '@/components/admin/vehicle-management'

// ─────────────────────────────────────────
// 타입: 통합 로그인 시스템 유저
// 응답 JSON: { users: [{ user_id: '123', user_name: '홍길동' }, ...] }
// ─────────────────────────────────────────
interface DriverUser {
  user_id: string
  user_name: string
  user_email: string
}


interface DriverAssignModalProps {
  vehicle: VehicleRow
  onClose: () => void
  onAssigned: () => void
}

export function DriverAssignModal({
  vehicle,
  onClose,
  onAssigned,
}: DriverAssignModalProps) {
  const [drivers, setDrivers] = useState<DriverUser[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [keyword, setKeyword] = useState('')

  // 배정 처리 중인 user_id (버튼 개별 로딩 표시용)
  const [assigningId, setAssigningId] = useState<string | null>(null)
  const [assignError, setAssignError] = useState<string | null>(null)

  // ── 모달 열릴 때: ESC 닫기 + 스크롤 잠금 + 유저 목록 fetch ──
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'

    const loadDrivers = async () => {
      setLoading(true)
      setLoadError(null)
      try {
        // 1. 현재 관리자의 회사 코드(companyCode) 가져오기
        const meRes = await fetch('/api/v1/users/me')
        if (!meRes.ok) throw new Error('사용자 정보를 불러올 수 없습니다.')

        const meData = await meRes.json()
        const companyCode = meData.companyCode

        if (!companyCode) {
          throw new Error('소속 회사 코드가 존재하지 않습니다.')
        }

        // 2. 회사 코드를 사용하여 기사(유저) 목록 조회
        const usersEndpoint = `https://payment.1004.help/api/v1/users?company=${companyCode}`
        const res = await fetch(usersEndpoint)

        if (!res.ok) throw new Error(`기사 목록 요청 실패 (HTTP ${res.status})`)

        const json = (await res.json()) as { users?: DriverUser[] }
        setDrivers(Array.isArray(json.users) ? json.users : [])
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : '기사 목록을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    }
    loadDrivers()

    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // ── 특정 기사 클릭 → DB UPDATE ──
  const handleAssign = async (driver: DriverUser) => {
    setAssigningId(driver.user_id)
    setAssignError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_vehicles')
        .update({
          driver_id: driver.user_id,
          driver_name: driver.user_name,
        })
        .eq('id', vehicle.id)

      if (error) throw new Error(error.message)

      onAssigned()
      onClose()
    } catch (err) {
      setAssignError(
        err instanceof Error ? err.message : '기사 배정 중 오류가 발생했습니다.',
      )
      setAssigningId(null)
    }
  }

  // 검색어 필터링
  const filtered = drivers.filter((d) =>
    d.user_name.toLowerCase().includes(keyword.trim().toLowerCase()),
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="운전기사 배정"
    >
      <div
        className="relative flex w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl"
        style={{ maxHeight: '80vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">운전기사 배정</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              차량번호{' '}
              <span className="font-semibold text-slate-700">
                {vehicle.vehicle_number}
              </span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* 검색 */}
        <div className="px-6 pt-4">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-[#1e3a5f] focus-within:ring-2 focus-within:ring-[#1e3a5f]/20 transition-colors">
            <Search size={16} className="text-slate-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="기사 이름으로 검색"
              className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* 배정 에러 */}
        {assignError && (
          <p className="px-6 pt-2 text-xs text-red-500">{assignError}</p>
        )}

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-400">
              <RefreshCw size={16} className="animate-spin" />
              기사 목록을 불러오는 중입니다...
            </div>
          )}

          {loadError && !loading && (
            <div className="py-12 text-center text-sm text-red-500">{loadError}</div>
          )}

          {!loading && !loadError && filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-400">
              {drivers.length === 0
                ? '가입된 기사가 없습니다.'
                : '검색 결과가 없습니다.'}
            </div>
          )}

          {!loading && !loadError && filtered.length > 0 && (
            <ul className="flex flex-col gap-1">
              {filtered.map((driver) => {
                const isCurrent = vehicle.driver_id === driver.user_id
                const isAssigning = assigningId === driver.user_id
                return (
                  <li key={driver.user_id}>
                    <button
                      onClick={() => handleAssign(driver)}
                      disabled={assigningId !== null}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors disabled:opacity-60 ${
                        isCurrent
                          ? 'bg-[#1e3a5f]/5 ring-1 ring-[#1e3a5f]/20'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                        <UserRound size={18} />
                      </span>
                      <span className="flex flex-1 flex-col">
                        <span className="text-sm font-semibold text-slate-800">
                          {driver.user_name}
                        </span>
                        <span className="text-xs text-slate-400">
                          Email: {driver.user_email}
                        </span>
                      </span>
                      {isAssigning ? (
                        <RefreshCw size={16} className="animate-spin text-[#1e3a5f]" />
                      ) : isCurrent ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a5f] px-2 py-0.5 text-[11px] font-semibold text-white">
                          <Check size={12} />
                          배정됨
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

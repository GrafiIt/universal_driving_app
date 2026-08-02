'use client'

import { useState, useEffect } from 'react'
import useSWR from 'swr'
import { RefreshCw, Plus, Pencil, Trash2, X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { DriverAssignModal } from '@/components/admin/driver-assign-modal'

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────
export interface VehicleRow {
  id: string
  vehicle_number: string
  driver_id: string | null
  driver_name: string | null
  created_at: string
}

// ─────────────────────────────────────────
// Supabase fetcher
// ─────────────────────────────────────────
async function fetchVehicles(companyCode: string): Promise<VehicleRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .schema('driver-checklist')
    .from('universal_driving_check_vehicles')
    .select('id, vehicle_number, driver_id, driver_name, created_at')
    .eq('company_code', companyCode)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as VehicleRow[]
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function VehicleManagement() {
  const [companyCode, setCompanyCode] = useState('default_company')
  const [companyCodeReady, setCompanyCodeReady] = useState(false)

  // companyCode 초기 로드
  useEffect(() => {
    fetch('/api/v1/users/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) {
          setCompanyCode(json.companyCode ?? json.company_code ?? 'default_company')
        }
        setCompanyCodeReady(true)
      })
      .catch(() => setCompanyCodeReady(true))
  }, [])

  const swrKey = companyCodeReady ? `admin-vehicles/${companyCode}` : null

  const { data, error, isLoading, mutate, isValidating } = useSWR(
    swrKey,
    () => fetchVehicles(companyCode),
  )

  // 차량 추가 모달
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newVehicleNumber, setNewVehicleNumber] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  // 기사 배정 모달 (선택된 차량)
  const [assignTarget, setAssignTarget] = useState<VehicleRow | null>(null)

  // 삭제 진행 중 상태
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // ── 차량 추가 (INSERT) ──
  const handleAddVehicle = async () => {
    const trimmed = newVehicleNumber.trim()
    if (trimmed === '') {
      setAddError('차량번호를 입력해 주세요.')
      return
    }

    setAdding(true)
    setAddError(null)
    try {
      const supabase = createClient()
      const { error: insertError } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_vehicles')
        .insert({ vehicle_number: trimmed, company_code: companyCode })

      if (insertError) throw new Error(insertError.message)

      setNewVehicleNumber('')
      setIsAddOpen(false)
      await mutate()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : '차량 추가 중 오류가 발생했습니다.')
    } finally {
      setAdding(false)
    }
  }

  // ── 차량 삭제 ──
  const handleDelete = async (row: VehicleRow) => {
    if (!window.confirm(`'${row.vehicle_number}' 차량을 삭제하시겠습니까?`)) return

    setDeletingId(row.id)
    try {
      const supabase = createClient()
      const { error: deleteError } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_vehicles')
        .delete()
        .eq('id', row.id)

      if (deleteError) throw new Error(deleteError.message)
      await mutate()
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제 중 오류가 발생했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* ── 헤더 타이틀 ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900">차량 및 기사 관리</h2>
          <p className="mt-1 text-sm text-slate-500">
            차량을 등록하고 전담 운전기사를 매칭합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => mutate()}
            disabled={isValidating}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={16} className={isValidating ? 'animate-spin' : ''} />
            새로고침
          </button>
          <button
            onClick={() => {
              setNewVehicleNumber('')
              setAddError(null)
              setIsAddOpen(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] active:bg-[#0f2035]"
          >
            <Plus size={16} />
            차량 추가
          </button>
        </div>
      </div>

      {/* ── 테이블 ── */}
      <div
        className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 240px)' }}
      >
        <div className="overflow-auto flex-1">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-100 border-b border-slate-200">
                <th
                  className="px-4 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ width: 70 }}
                >
                  No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 whitespace-nowrap">
                  차량번호
                </th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 whitespace-nowrap">
                  운전기사
                </th>
                <th
                  className="px-4 py-3 text-center text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ width: 120 }}
                >
                  관리
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-slate-400">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              )}

              {error && !isLoading && (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-red-500">
                    데이터 조회 중 오류: {error.message}
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-14 text-center text-slate-400">
                    등록된 차량이 없습니다. 우측 상단의 &apos;차량 추가&apos; 버튼을 눌러 등록해
                    주세요.
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                data?.map((row, index) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-center text-xs text-slate-400">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-800 whitespace-nowrap">
                      {row.vehicle_number}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {row.driver_name ? (
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-slate-800">{row.driver_name}</span>
                          <button
                            onClick={() => setAssignTarget(row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1e3a5f]"
                            title="운전기사 변경"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-400">
                            미지정
                          </span>
                          <button
                            onClick={() => setAssignTarget(row)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1e3a5f]"
                            title="운전기사 배정"
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="차량 삭제"
                      >
                        {deletingId === row.id ? (
                          <RefreshCw size={15} className="animate-spin" />
                        ) : (
                          <Trash2 size={15} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 차량 추가 모달 ── */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !adding && setIsAddOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="차량 추가"
        >
          <div
            className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">차량 추가</h2>
              <button
                onClick={() => !adding && setIsAddOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              차량번호
            </label>
            <input
              type="text"
              value={newVehicleNumber}
              autoFocus
              onChange={(e) => setNewVehicleNumber(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  !e.nativeEvent.isComposing &&
                  e.keyCode !== 229
                ) {
                  handleAddVehicle()
                }
              }}
              placeholder="예: 12가 3456"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors"
            />

            {addError && <p className="mt-2 text-xs text-red-500">{addError}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setIsAddOpen(false)}
                disabled={adding}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleAddVehicle}
                disabled={adding}
                className="rounded-lg bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] disabled:opacity-60 active:bg-[#0f2035]"
              >
                {adding ? '추가 중...' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 운전기사 배정 모달 ── */}
      {assignTarget && (
        <DriverAssignModal
          vehicle={assignTarget}
          onClose={() => setAssignTarget(null)}
          onAssigned={() => mutate()}
        />
      )}
    </div>
  )
}

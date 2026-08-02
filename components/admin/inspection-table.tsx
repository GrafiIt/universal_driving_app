'use client'

import { useState, useCallback, useEffect } from 'react'
import useSWR from 'swr'
import { RefreshCw, ImageIcon, Search, Pencil, MessageSquare, Trash2, Download } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CHECKLIST_ITEMS } from '@/lib/checklist-data'
import { PhotoModal } from '@/components/admin/photo-modal'
import { AdminNoteModal } from '@/components/admin/admin-note-modal'
import { AdminEditModal } from '@/components/admin/admin-edit-modal'

// ─────────────────────────────────────────
// 타입
// ─────────────────────────────────────────
interface InspectionItemRow {
  item_id: string
  status: 'normal' | 'abnormal' | 'pending' | 'skipped'
  note: string | null
  image_urls: string[] | null
}

interface InspectionRow {
  id: string
  driver_name: string | null
  vehicle_number: string | null
  inspected_at: string
  admin_note?: string | null
  universal_driving_check_inspection_items: InspectionItemRow[]
}

// ─────────────────────────────────────────
// 기본 날짜 계산 (오늘 ~ 30일 전)
// ─────────────────────────────────────────
function toDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function getDefaultDateRange(): { from: string; to: string } {
  const today = new Date()
  const past = new Date(today)
  past.setDate(today.getDate() - 30)
  return { from: toDateString(past), to: toDateString(today) }
}

// ─────────────────────────────────────────
// Supabase fetcher (기간 필터 포함)
// ─────────────────────────────────────────
async function fetchInspections(
  fromDate: string,
  toDate: string,
  keyword: string,
  companyCode: string,
): Promise<InspectionRow[]> {
  const supabase = createClient()
  // toDate는 당일 23:59:59까지 포함하기 위해 다음날 00:00:00 미만으로 처리
  const toDateExclusive = toDateString(
    new Date(new Date(toDate).getTime() + 24 * 60 * 60 * 1000),
  )

  let query = supabase
    .schema('driver-checklist')
    .from('universal_driving_check_inspections')
    .select(
      'id, driver_name, vehicle_number, inspected_at, admin_note, universal_driving_check_inspection_items(item_id, status, note, image_urls)',
    )
    .eq('company_code', companyCode)
    .gte('inspected_at', fromDate)
    .lt('inspected_at', toDateExclusive)

  // 작업자명 또는 차량번호 부분 일치 검색
  const trimmedKeyword = keyword.trim()
  if (trimmedKeyword !== '') {
    query = query.or(
      `driver_name.ilike.%${trimmedKeyword}%,vehicle_number.ilike.%${trimmedKeyword}%`,
    )
  }

  const { data, error } = await query.order('inspected_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []) as InspectionRow[]
}

// ─────────────────────────────────────────
// 날짜 포맷 (YYYY.MM.DD HH:mm)
// ─────────────────────────────────────────
function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// ─────────────────────────────────────────
// 15개 항목 순서 (checklist-data 순서 그대로)
// ─────────────────────────────────────────
const ORDERED_ITEMS = CHECKLIST_ITEMS // 이미 차량6 → 작업7 → 탱크2 순서

// 카테고리별 컬럼 범위 (항목 개수는 CHECKLIST_ITEMS 기준으로 동적 계산 → 컬럼/colSpan 자동 동기화)
const VEHICLE_ITEMS = ORDERED_ITEMS.filter((i) => i.categoryKey === 'vehicle')
const WORK_ITEMS    = ORDERED_ITEMS.filter((i) => i.categoryKey === 'work')
const ETC_ITEMS     = ORDERED_ITEMS.filter((i) => i.categoryKey === 'etc')
const SIGN_ITEMS    = ORDERED_ITEMS.filter((i) => i.categoryKey === 'sign')

// ─────────────────────────────────────────
// 모달 상태 타입
// ─────────────────────────────────────────
interface ModalState {
  images: string[]
  title: string
}

interface NoteModalState {
  rowId: string
  initialNote: string | null
}

// ─────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────
export function InspectionTable() {
  const defaults = getDefaultDateRange()
  const [fromDate, setFromDate] = useState(defaults.from)
  const [toDate, setToDate]     = useState(defaults.to)
  const [keyword, setKeyword]   = useState('')
  // 실제 조회에 사용할 값 (검색 버튼 클릭 시 적용)
  const [appliedFrom, setAppliedFrom] = useState(defaults.from)
  const [appliedTo, setAppliedTo]     = useState(defaults.to)
  const [appliedKeyword, setAppliedKeyword] = useState('')

  const [modal, setModal] = useState<ModalState | null>(null)
  const [noteModal, setNoteModal] = useState<NoteModalState | null>(null)
  const [editRow, setEditRow] = useState<InspectionRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [companyCode, setCompanyCode] = useState('default_company')
  const [companyCodeReady, setCompanyCodeReady] = useState(false)

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

  // SWR key에 날짜/키워드/companyCode를 포함시켜 값 변경 시 자동 refetch
  const swrKey = companyCodeReady
    ? `admin-inspections/${companyCode}/${appliedFrom}/${appliedTo}/${appliedKeyword}`
    : null

  const fetcher = useCallback(
    () => fetchInspections(appliedFrom, appliedTo, appliedKeyword, companyCode),
    [appliedFrom, appliedTo, appliedKeyword, companyCode],
  )

  const { data, error, isLoading, mutate, isValidating } = useSWR(swrKey, fetcher)

  // 검색 버튼 클릭
  const handleSearch = () => {
    setAppliedFrom(fromDate)
    setAppliedTo(toDate)
    setAppliedKeyword(keyword)
  }

  // ── 엑셀(CSV) 다운로드 ──
  const handleExportExcel = () => {
    if (!data || data.length === 0) {
      alert('다운로드할 데이터가 없습니다.')
      return
    }

    // 헤더: 고정 4개 + 모든 점검 항목 라벨 + 관리자 비고
    const headers = [
      'No.',
      '점검일시',
      '작업자명',
      '차량번호',
      ...ORDERED_ITEMS.map((item) => item.label),
      '관리자 비고',
    ]

    // CSV 셀 이스케이프 (쉼표/따옴표/줄바꿈 처리)
    const escapeCsv = (value: string | number | null | undefined) => {
      const str = value === null || value === undefined ? '' : String(value)
      return `"${str.replace(/"/g, '""')}"`
    }

    const rows = data.map((row, index) => {
      // 화면 렌더링과 동일하게 item_id → 기록 맵 구성
      const itemMap = new Map<string, InspectionItemRow>()
      ;(row.universal_driving_check_inspection_items ?? []).forEach((it) => {
        itemMap.set(it.item_id, it)
      })

      // 각 점검 항목의 상태 텍스트 추출
      const itemValues = ORDERED_ITEMS.map((item) => {
        const it = itemMap.get(item.id)
        const status = it?.status ?? 'pending'
        const hasImages = (it?.image_urls?.length ?? 0) > 0

        // 기록 없음 / 미입력
        if (!it || status === 'pending') return '-'

        // 미운행 처리
        if (status === 'skipped') {
          return item.type === 'signature' ? '-' : '미운행'
        }

        // 서명 항목
        if (item.type === 'signature') {
          return hasImages ? '서명완료' : '-'
        }

        // 양호 계열
        if (status === 'normal') {
          const label = item.customLabels?.[0] ?? '양호'
          return hasImages ? `${label}(사진)` : label
        }

        // 불량 계열
        if (status === 'abnormal') {
          const label = item.customLabels?.[1] ?? '불량'
          const note = it.note?.trim()
          const extras: string[] = []
          if (note) extras.push(`사유: ${note}`)
          if (hasImages) extras.push('사진')
          return extras.length > 0 ? `${label}(${extras.join(', ')})` : label
        }

        return '-'
      })

      return [
        index + 1,
        formatDateTime(row.inspected_at),
        row.driver_name ?? '',
        row.vehicle_number ?? '',
        ...itemValues,
        row.admin_note ?? '',
      ]
    })

    const csvBody = [headers, ...rows]
      .map((cols) => cols.map(escapeCsv).join(','))
      .join('\r\n')

    // MS Excel 한글 깨짐 방지를 위해 UTF-8 BOM(\uFEFF)을 맨 앞에 추가
    const blob = new Blob([`\uFEFF${csvBody}`], {
      type: 'text/csv;charset=utf-8;',
    })

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `일일점검_${appliedFrom}_${appliedTo}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 점검 기록 삭제 (자식 → 부모 순서)
  const handleDelete = async (rowId: string) => {
    if (!window.confirm('해당 점검 기록을 완전히 삭제하시겠습니까?')) return

    setDeletingId(rowId)
    try {
      const supabase = createClient()

      // 1) 자식 테이블(점검 항목) 먼저 삭제
      const { error: itemsError } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_inspection_items')
        .delete()
        .eq('inspection_id', rowId)

      if (itemsError) throw new Error(itemsError.message)

      // 2) 부모 테이블(점검 마스터) 삭제
      const { error: parentError } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_inspections')
        .delete()
        .eq('id', rowId)

      if (parentError) throw new Error(parentError.message)

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
          <h2 className="text-xl font-bold text-slate-900">일일점검 체크리스트</h2>
          <p className="mt-1 text-sm text-slate-500">
            기사님들이 제출한 운행 전 점검 자료입니다.
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
            onClick={handleExportExcel}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-600 bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 active:bg-emerald-800"
            title="엑셀 다운로드"
          >
            <Download size={16} />
            엑셀 다운로드
          </button>
        </div>
      </div>

      {/* ── 기간 검색 필터 ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
        <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">점검 기간</span>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={fromDate}
            max={toDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors"
          />
          <span className="text-slate-400 font-medium">~</span>
          <input
            type="date"
            value={toDate}
            min={fromDate}
            onChange={(e) => setToDate(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors"
          />
        </div>
        {/* 작업자명 / 차량번호 검색 */}
        <input
          type="text"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => {
            if (
              e.key === 'Enter' &&
              !e.nativeEvent.isComposing &&
              e.keyCode !== 229
            ) {
              handleSearch()
            }
          }}
          placeholder="작업자명 또는 차량번호 검색"
          className="min-w-[200px] flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors sm:flex-none"
        />
        <button
          onClick={handleSearch}
          className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] active:bg-[#0f2035]"
        >
          <Search size={15} />
          검색
        </button>
        {/* 조회 결과 건수 */}
        {!isLoading && !error && data && (
          <span className="ml-auto text-sm text-slate-500">
            총 <span className="font-bold text-slate-800">{data.length}</span>건
          </span>
        )}
      </div>

      {/* ── 테이블 래퍼: 세로 스크롤을 위해 높이 제한 + 가로 스크롤 ── */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        <div className="overflow-auto always-scrollbar flex-1">
          <table className="w-max min-w-full border-collapse text-sm">

            {/* ─── 다중 헤더 (2-row) ─── */}
            <thead className="sticky top-0 z-20">
              {/* 1행: 카테고리 그룹 헤더 */}
              <tr className="bg-slate-100 border-b border-slate-200">
                {/* ── 좌측 4개 고정 컬럼 (z-30: 헤더 + sticky 교차점) ── */}
                <th
                  rowSpan={2}
                  className="sticky left-0 z-30 border-r border-slate-200 bg-slate-100 px-3 py-2 text-center text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ width: 50, minWidth: 50 }}
                >
                  No.
                </th>
                <th
                  rowSpan={2}
                  className="sticky z-30 border-r border-slate-200 bg-slate-100 px-4 py-2 text-left text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ left: 50, width: 140, minWidth: 140 }}
                >
                  점검일시
                </th>
                <th
                  rowSpan={2}
                  className="sticky z-30 border-r border-slate-200 bg-slate-100 px-4 py-2 text-left text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ left: 190, width: 90, minWidth: 90 }}
                >
                  작업자명
                </th>
                <th
                  rowSpan={2}
                  className="sticky z-30 border-r-2 border-slate-300 bg-slate-100 px-4 py-2 text-left text-xs font-bold text-slate-600 whitespace-nowrap"
                  style={{ left: 280, width: 100, minWidth: 100 }}
                >
                  차량번호
                </th>
                {/* 외관점검 그룹 */}
                <th
                  colSpan={VEHICLE_ITEMS.length}
                  className="border-x border-slate-200 px-2 py-2 text-center text-xs font-bold text-blue-700 bg-blue-50 whitespace-nowrap"
                >
                  외관점검 ({VEHICLE_ITEMS.length}항목)
                </th>
                {/* 상태점검 그룹 */}
                <th
                  colSpan={WORK_ITEMS.length}
                  className="border-x border-slate-200 px-2 py-2 text-center text-xs font-bold text-emerald-700 bg-emerald-50 whitespace-nowrap"
                >
                  상태점검 ({WORK_ITEMS.length}항목)
                </th>
                {/* 기타 그룹 */}
                <th
                  colSpan={ETC_ITEMS.length}
                  className="border-x border-slate-200 px-2 py-2 text-center text-xs font-bold text-purple-700 bg-purple-50 whitespace-nowrap"
                >
                  기타 ({ETC_ITEMS.length}항목)
                </th>
                {/* 조치 및 서명 그룹 */}
                <th
                  colSpan={SIGN_ITEMS.length}
                  className="border-l border-slate-200 px-2 py-2 text-center text-xs font-bold text-orange-700 bg-orange-50 whitespace-nowrap"
                >
                  조치 및 서명 ({SIGN_ITEMS.length}항목)
                </th>
                {/* 관리자 그룹 */}
                <th
                  colSpan={1}
                  className="border-l border-slate-200 px-2 py-2 text-center text-xs font-bold text-slate-600 bg-slate-100 whitespace-nowrap"
                >
                  관리자
                </th>
              </tr>

              {/* 2행: 개별 항목 헤더 */}
              <tr className="bg-slate-50 border-b border-slate-200">
                {ORDERED_ITEMS.map((item, idx) => {
                  const isVehicle = item.categoryKey === 'vehicle'
                  const isWork    = item.categoryKey === 'work'
                  const isEtc     = item.categoryKey === 'etc'
                  const bgClass   = isVehicle
                    ? 'bg-blue-50/60'
                    : isWork
                    ? 'bg-emerald-50/60'
                    : isEtc
                    ? 'bg-purple-50/60'
                    : 'bg-orange-50/60'
                  const textClass = isVehicle
                    ? 'text-blue-800'
                    : isWork
                    ? 'text-emerald-800'
                    : isEtc
                    ? 'text-purple-800'
                    : 'text-orange-800'
                  // 카테고리 경계(마지막 항목)에서 굵은 구분선
                  const vehicleEnd = VEHICLE_ITEMS.length - 1
                  const workEnd    = VEHICLE_ITEMS.length + WORK_ITEMS.length - 1
                  const etcEnd     = VEHICLE_ITEMS.length + WORK_ITEMS.length + ETC_ITEMS.length - 1
                  const borderClass = idx === vehicleEnd || idx === workEnd || idx === etcEnd
                    ? 'border-r-2 border-slate-300'
                    : 'border-r border-slate-200'
                  return (
                    <th
                      key={item.id}
                      className={`${bgClass} ${borderClass} px-2 py-2 text-center text-[11px] font-semibold ${textClass} min-w-[130px] max-w-[160px]`}
                    >
                      <div className="line-clamp-2 leading-tight" title={item.label}>
                        {item.order}. {item.label}
                      </div>
                    </th>
                  )
                })}
                {/* 관리(비고/수정/삭제) 헤더 */}
                <th className="border-l border-slate-200 bg-slate-50 px-3 py-2 text-center text-[11px] font-semibold text-slate-600 min-w-[150px]">
                  비고 / 수정 / 삭제
                </th>
              </tr>
            </thead>

            {/* ─── 바디 ─── */}
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={4 + ORDERED_ITEMS.length + 1} className="py-14 text-center text-slate-400">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              )}

              {error && !isLoading && (
                <tr>
                  <td colSpan={4 + ORDERED_ITEMS.length + 1} className="py-14 text-center text-red-500">
                    데이터 조회 중 오류: {error.message}
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.length === 0 && (
                <tr>
                  <td colSpan={4 + ORDERED_ITEMS.length + 1} className="py-14 text-center text-slate-400">
                    해당 기간의 점검 자료가 없습니다.
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.map((row, index) => {
                // item_id → InspectionItemRow 맵
                const itemMap = new Map<string, InspectionItemRow>()
                ;(row.universal_driving_check_inspection_items ?? []).forEach((it) => {
                  itemMap.set(it.item_id, it)
                })

                return (
                  <tr
                    key={row.id}
                    className="group border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    {/* No. — sticky left 0 */}
                    <td
                      className="sticky left-0 z-10 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors px-3 py-2.5 text-center text-xs text-slate-400"
                      style={{ width: 50, minWidth: 50 }}
                    >
                      {index + 1}
                    </td>
                    {/* 점검일시 — sticky left 50 */}
                    <td
                      className="sticky z-10 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors px-4 py-2.5 whitespace-nowrap text-sm font-medium text-slate-800"
                      style={{ left: 50, width: 140, minWidth: 140 }}
                    >
                      {formatDateTime(row.inspected_at)}
                    </td>
                    {/* 작업자명 — sticky left 190 */}
                    <td
                      className="sticky z-10 border-r border-slate-200 bg-white group-hover:bg-slate-50 transition-colors px-4 py-2.5 whitespace-nowrap text-sm text-slate-700"
                      style={{ left: 190, width: 90, minWidth: 90 }}
                    >
                      {row.driver_name ?? '-'}
                    </td>
                    {/* 차량번호 — sticky left 280 */}
                    <td
                      className="sticky z-10 border-r-2 border-slate-300 bg-white group-hover:bg-slate-50 transition-colors px-4 py-2.5 whitespace-nowrap text-sm text-slate-700"
                      style={{ left: 280, width: 100, minWidth: 100 }}
                    >
                      {row.vehicle_number ?? '-'}
                    </td>

                    {/* 18개 점검 항목 셀 */}
                    {ORDERED_ITEMS.map((item, idx) => {
                      const it = itemMap.get(item.id)
                      const status = it?.status ?? 'pending'
                      const note   = it?.note ?? ''
                      const images = it?.image_urls ?? []
                      const borderClass = idx === VEHICLE_ITEMS.length - 1 || idx === VEHICLE_ITEMS.length + WORK_ITEMS.length - 1
                        ? 'border-r-2 border-slate-300'
                        : 'border-r border-slate-200'

                      // DB status값은 그대로 두고, 화면 표시 텍스트만 customLabels로 매핑
                const normalLabel = item.customLabels?.[0] ?? '양호'
                const abnormalLabel = item.customLabels?.[1] ?? '불량'

                      // 미운행 처리 (서명 항목은 '-', 나머지는 '미운행' 배지)
                      if (status === 'skipped') {
                        return (
                          <td key={item.id} className={`${borderClass} px-2 py-2.5 text-center`}>
                            {item.type === 'signature' ? (
                              <span className="text-[11px] text-slate-300">-</span>
                            ) : (
                              <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                                미운행
                              </span>
                            )}
                          </td>
                        )
                      }

                      // 서명 항목: image_urls의 서명 이미지를 작은 썸네일로 직접 렌더링
                      if (item.type === 'signature') {
                        return (
                          <td key={item.id} className={`${borderClass} px-2 py-2.5 text-center`}>
                            {images.length > 0 ? (
                              <button
                                onClick={() => setModal({ images, title: `${item.order}. ${item.label}` })}
                                className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-0.5 transition-colors hover:bg-slate-50"
                                title="서명 크게 보기"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={images[0]}
                                  alt="서명"
                                  className="h-10 w-20 object-contain"
                                />
                              </button>
                            ) : (
                              <span className="text-[11px] text-slate-300">-</span>
                            )}
                          </td>
                        )
                      }

                      if (status === 'normal') {
                        // 정상 계열 (준수 / 착용 / 설치 등)
                        const hasImages = images.length > 0
                        return (
                          <td key={item.id} className={`${borderClass} px-2 py-2.5 text-center`}>
                            {hasImages ? (
                              <button
                                onClick={() =>
                                  setModal({ images, title: `${item.order}. ${item.label}` })
                                }
                                className="inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors cursor-pointer hover:bg-emerald-50"
                                title="사진 보기"
                              >
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                  {normalLabel}
                                  <ImageIcon size={11} />
                                </span>
                              </button>
                            ) : (
                              <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                                {normalLabel}
                              </span>
                            )}
                          </td>
                        )
                      }

                      if (status === 'abnormal') {
                        // 이상 계열 (미준수 / 미착용 / 미설치 등) — 사유 + 사진 아이콘
                        const hasImages = images.length > 0
                        return (
                          <td key={item.id} className={`${borderClass} px-2 py-2.5 text-center`}>
                            <button
                              onClick={() =>
                                hasImages &&
                                setModal({ images, title: `${item.order}. ${item.label}` })
                              }
                              disabled={!hasImages}
                              className={`inline-flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-colors
                                ${hasImages
                                  ? 'cursor-pointer hover:bg-red-50'
                                  : 'cursor-default'}`}
                              title={hasImages ? '사진 보기' : ''}
                            >
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                                {abnormalLabel}
                                {hasImages && <ImageIcon size={11} />}
                              </span>
                              {note && (
                                <span className="block max-w-[120px] truncate text-[10px] text-slate-500" title={note}>
                                  {note}
                                </span>
                              )}
                            </button>
                          </td>
                        )
                      }

                      // pending / 미입력
                      return (
                        <td key={item.id} className={`${borderClass} px-2 py-2.5 text-center`}>
                          <span className="text-[11px] text-slate-300">-</span>
                        </td>
                      )
                    })}

                    {/* 관리 셀 (비고 / 수정 / 삭제) */}
                    <td className="border-l border-slate-200 px-3 py-2.5 min-w-[150px]">
                      <div className="flex items-center justify-center gap-1">
                        {/* 비고 (말풍선) */}
                        <button
                          onClick={() => setNoteModal({ rowId: row.id, initialNote: row.admin_note ?? null })}
                          className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                            row.admin_note
                              ? 'text-[#1e3a5f] hover:bg-slate-100'
                              : 'text-slate-300 hover:bg-slate-100 hover:text-slate-500'
                          }`}
                          title={row.admin_note ? `비고: ${row.admin_note}` : '비고 입력'}
                        >
                          <MessageSquare size={16} />
                          {row.admin_note && (
                            <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-[#1e3a5f]" />
                          )}
                        </button>

                        {/* 수정 (연필) */}
                        <button
                          onClick={() => setEditRow(row)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                          title="점검 내역 수정"
                        >
                          <Pencil size={16} />
                        </button>

                        {/* 삭제 (휴지통) */}
                        <button
                          onClick={() => handleDelete(row.id)}
                          disabled={deletingId === row.id}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="점검 기록 삭제"
                        >
                          {deletingId === row.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : (
                            <Trash2 size={16} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 사진 미리보기 모달 */}
      {modal && (
        <PhotoModal
          images={modal.images}
          title={modal.title}
          onClose={() => setModal(null)}
        />
      )}

      {/* 관리자 비고 모달 */}
      {noteModal && (
        <AdminNoteModal
          rowId={noteModal.rowId}
          initialNote={noteModal.initialNote}
          onClose={() => setNoteModal(null)}
          onSaved={() => mutate()}
        />
      )}

      {/* 점검 내역 수정 모달 */}
      {editRow && (
        <AdminEditModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={() => mutate()}
        />
      )}
    </div>
  )
}

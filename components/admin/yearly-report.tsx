'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Printer, Loader, Search } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ────────────────────────────────────────
// 점검 항목 그룹 정의 (monthly-report와 100% 동일)
// ────────────────────────────────────────
const GROUPS: {
  label: string
  verticalLabel: string
  items: { id: string; label: string }[]
}[] = [
  {
    label: '외관점검',
    verticalLabel: '외\n관\n점\n검',
    items: [
      { id: 'v1', label: '번호판, 전면유리, 후사경 등의 청결상태' },
      { id: 'v2', label: '후미등, 차폭등 등 등화장치 작동상태' },
      { id: 'v3', label: '창닦이기 작동상태' },
      {
        id: 'v4',
        label:
          '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착상태 및 훼손 여부',
      },
    ],
  },
  {
    label: '상태점검',
    verticalLabel: '상\n태\n점\n검',
    items: [
      { id: 'w1', label: '타이어 손상 및 마모(1.6㎜이상) 여부' },
      { id: 'w2', label: '화물, 적재함 지지대(판스프링) 등의 고정상태' },
      { id: 'w3', label: '바퀴 너트 등 균열 여부' },
    ],
  },
  {
    label: '기타',
    verticalLabel: '기\n타',
    items: [
      { id: 'e1', label: '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)' },
      { id: 'e2', label: '좌석안전띠 상태' },
      { id: 'e3', label: '소화기 비치 여부' },
      { id: 'e4', label: '안전삼각대 등 비치 여부' },
    ],
  },
]

interface ItemRow {
  inspection_id: string
  item_id: string
  status: 'normal' | 'abnormal' | 'skipped' | 'pending' | null
  note: string | null
  image_urls: string[] | null
}

interface Vehicle {
  vehicle_number: string
  driver_name: string | null
}

// 상태 → 기호
function statusSymbol(status: ItemRow['status']): string {
  if (status === 'normal') return 'O'
  if (status === 'abnormal') return 'X'
  if (status === 'skipped') return '미'
  return ''
}

// 월별 그룹화 타입: byMonthDay[month][day][item_id] = ItemRow
type ByMonthDay = Record<number, Record<number, Record<string, ItemRow>>>

// ────────────────────────────────────────
// 단일 월 A4 양식 컴포넌트 (monthly-report/page.tsx 표 구조 100% 동일)
// ────────────────────────────────────────
interface MonthSheetProps {
  year: number
  monthNum: number
  companyName: string
  vehicleNumber: string
  driverName: string
  byDay: Record<number, Record<string, ItemRow>>
  actionLines: string[]
}

function MonthSheet({
  year,
  monthNum,
  companyName,
  vehicleNumber,
  driverName,
  byDay,
  actionLines,
}: MonthSheetProps) {
  const yearShort = String(year).slice(2)
  const monthStr = String(monthNum).padStart(2, '0')
  // 해당 연도·월의 실제 일수 (28~31)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  // 1~31 고정 배열
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="w-full h-full bg-white text-black print:shadow-none shadow-lg">
      {/* 제목 */}
      <p className="text-center text-[13px] font-bold mb-1.5 tracking-widest">
        운수종사자 일상점검표
      </p>

      {/* 상단 정보란 */}
      <table className="w-full border-collapse border border-black mb-1.5 text-[10px] text-center font-bold">
        <tbody>
          <tr>
            <td className="border border-black bg-gray-50 py-1 w-[10%]">점검연월</td>
            <td className="border border-black py-1 w-[14%]">
              20&nbsp;{yearShort}&nbsp;년&nbsp;&nbsp;{monthStr}&nbsp;월
            </td>
            <td className="border border-black bg-gray-50 py-1 w-[12%]">운송사업자명</td>
            <td className="border border-black py-1 w-[22%]">{companyName || ''}</td>
            <td className="border border-black bg-gray-50 py-1 w-[10%]">차량번호</td>
            <td className="border border-black py-1 w-[14%]">{vehicleNumber || ''}</td>
            <td className="border border-black bg-gray-50 py-1 w-[10%]">운수종사자명</td>
            <td className="border border-black py-1 w-[8%]">{driverName || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* 메인 점검표 */}
      <table className="w-full flex-1 h-full border-collapse border border-black table-fixed text-center text-[8.5px] leading-tight">
        <colgroup>
          <col style={{ width: '3%' }} />
          <col style={{ width: '14%' }} />
          {days.map((d) => (
            <col key={d} style={{ width: `${83 / 31}%` }} />
          ))}
        </colgroup>

        <thead>
          <tr>
            <th
              colSpan={2}
              rowSpan={2}
              className="border border-black py-1 bg-white font-bold text-[9px]"
            >
              점검항목
            </th>
            <th
              colSpan={31}
              className="border border-black py-0.5 bg-white font-bold text-[9px]"
            >
              점검결과(양호 O, 불량 ×, 미운행시 &quot;미&quot; 기입)
            </th>
          </tr>
          <tr>
            {days.map((d) => (
              <th
                key={d}
                className="border border-black p-0 py-0.5 font-bold text-[8.5px]"
              >
                {d}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {GROUPS.map((group) =>
            group.items.map((item, itemIdx) => (
              <tr key={item.id}>
                {itemIdx === 0 && (
                  <td
                    rowSpan={group.items.length}
                    className="border border-black font-bold text-[8px] leading-[1.6] whitespace-pre-line align-middle p-0"
                  >
                    {group.verticalLabel}
                  </td>
                )}
                <td
                  className={`border border-black text-left px-1 py-0.5 align-middle leading-snug ${
                    item.id === 'v4' ? 'text-[8.5px]' : 'text-[10px] md:text-[11px]'
                  }`}
                >
                  {item.label}
                </td>
                {days.map((d) => {
                  const outOfRange = d > daysInMonth
                  const row = outOfRange ? undefined : byDay[d]?.[item.id]
                  return (
                    <td
                      key={d}
                      className={`border border-black p-0 h-[40px] align-middle font-medium text-[8.5px] ${
                        outOfRange ? 'bg-gray-100' : ''
                      }`}
                    >
                      {!outOfRange ? statusSymbol(row?.status ?? null) : ''}
                    </td>
                  )
                })}
              </tr>
            )),
          )}

          {/* 서명 행 */}
          <tr>
            <th
              colSpan={2}
              className="border border-black h-[52px] font-bold text-[8.5px]"
            >
              점검자 확인(서명)
            </th>
            {days.map((d) => {
              const outOfRange = d > daysInMonth
              const row = outOfRange ? undefined : byDay[d]?.['s2']
              const url = row?.image_urls?.[0]
              return (
                <td
                  key={d}
                  className={`border border-black p-0 h-[52px] align-middle ${
                    outOfRange ? 'bg-gray-100' : ''
                  }`}
                >
                  {!outOfRange && url ? (
                    <img
                      src={url}
                      alt="서명"
                      crossOrigin="anonymous"
                      className="h-8 w-full object-contain"
                    />
                  ) : null}
                </td>
              )
            })}
          </tr>

          {/* 불량상태 조치 기록 행 */}
          <tr>
            <th
              colSpan={2}
              className="border border-black h-[130px] font-bold text-[8.5px] align-middle"
            >
              불량상태 조치 기록
            </th>
            <td
              colSpan={31}
              className="border border-black text-left px-2 py-1 align-top h-[130px] text-[8.5px]"
            >
              {actionLines.map((line, idx) => (
                <span key={idx}>
                  {line}
                  {idx < actionLines.length - 1 && <br />}
                </span>
              ))}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ────────────────────────────────────────
// 메인 YearlyReport 컴포넌트
// ────────────────────────────────────────
export function YearlyReport() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [showDropdown, setShowDropdown] = useState(false)
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(false)
  const [dataLoaded, setDataLoaded] = useState(false)
  const [activePreviewMonth, setActivePreviewMonth] = useState<number | 'all'>(new Date().getMonth() + 1)

  // 월별 데이터: byMonthDay[month][day][item_id]
  const [byMonthDay, setByMonthDay] = useState<ByMonthDay>({})
  // 월별 조치 기록: monthActionLines[month] = string[]
  const [monthActionLines, setMonthActionLines] = useState<Record<number, string[]>>({})

  // 차량 목록 + 회사명 초기 로드
  useEffect(() => {
    const init = async () => {
      const supabase = createClient()

      // 회사명
      try {
        const res = await fetch('/api/v1/users/me')
        if (res.ok) {
          const json = await res.json()
          setCompanyName(json.companyName ?? '')
        }
      } catch {
        // 무시
      }

      // 전체 차량 목록
      const { data } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_vehicles')
        .select('vehicle_number, driver_name')
        .order('vehicle_number', { ascending: true })

      setVehicles((data as Vehicle[]) ?? [])
    }
    init()
  }, [])

  // 검색 필터링된 차량 목록
  const filteredVehicles = useMemo(() => {
    if (!vehicleSearch.trim()) return vehicles
    const q = vehicleSearch.trim().toLowerCase()
    return vehicles.filter(
      (v) =>
        v.vehicle_number.toLowerCase().includes(q) ||
        (v.driver_name ?? '').toLowerCase().includes(q),
    )
  }, [vehicles, vehicleSearch])

  // 1년치 데이터 조회
  const loadYearlyData = useCallback(async () => {
    if (!selectedVehicle) return
    setLoading(true)
    setDataLoaded(false)

    try {
      const supabase = createClient()
      const vNum = selectedVehicle.vehicle_number

      const startISO = `${year}-01-01T00:00:00`
      const endISO = `${year}-12-31T23:59:59`

      // 1) 해당 차량·연도의 점검 마스터 전체 조회
      const { data: inspections } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_inspections')
        .select('id, inspected_at')
        .eq('vehicle_number', vNum)
        .gte('inspected_at', startISO)
        .lte('inspected_at', endISO)

      const inspList = inspections ?? []
      // id → { month, day }
      const idToMonthDay = new Map<string, { month: number; day: number }>()
      const ids: string[] = []

      for (const insp of inspList) {
        const localDate = new Date(insp.inspected_at as string)
        const month = localDate.getMonth() + 1
        const day = localDate.getDate()
        idToMonthDay.set(insp.id as string, { month, day })
        ids.push(insp.id as string)
      }

      const newByMonthDay: ByMonthDay = {}
      // month → { day, note }[]
      const actionsByMonth: Record<number, { day: number; note: string | null }[]> = {}

      if (ids.length > 0) {
        const { data: items } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspection_items')
          .select('inspection_id, item_id, status, note, image_urls')
          .in('inspection_id', ids)

        for (const it of (items ?? []) as ItemRow[]) {
          const loc = idToMonthDay.get(it.inspection_id)
          if (!loc) continue
          const { month, day } = loc

          if (!newByMonthDay[month]) newByMonthDay[month] = {}
          if (!newByMonthDay[month][day]) newByMonthDay[month][day] = {}
          newByMonthDay[month][day][it.item_id] = it

          // s1(불량상태 조치)이 abnormal인 경우만 수집
          if (it.item_id === 's1' && it.status === 'abnormal') {
            if (!actionsByMonth[month]) actionsByMonth[month] = []
            actionsByMonth[month].push({ day, note: it.note })
          }
        }
      }

      // 월별 조치 기록 라인 생성 (최대 7개, 날짜 오름차순)
      const newMonthActionLines: Record<number, string[]> = {}
      for (let m = 1; m <= 12; m++) {
        const acts = (actionsByMonth[m] ?? []).sort((a, b) => a.day - b.day)
        newMonthActionLines[m] = acts.slice(0, 7).map(
          (a) => `[${m}월 ${a.day}일] ${a.note && a.note.trim() ? a.note : '조치 필요'}`,
        )
      }

      setByMonthDay(newByMonthDay)
      setMonthActionLines(newMonthActionLines)
      setDataLoaded(true)
    } catch (err) {
      console.error('[yearly-report] 데이터 조회 오류:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedVehicle, year])

  const handleVehicleSelect = (v: Vehicle) => {
    setSelectedVehicle(v)
    setVehicleSearch(`${v.vehicle_number}${v.driver_name ? ` (${v.driver_name})` : ''}`)
    setShowDropdown(false)
    setDataLoaded(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white -m-8">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }

          /* 브라우저 및 모든 부모 요소 스크롤/높이 제한 해제 */
          html, body, #__next, main, div {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
          }

          /* 관리자 사이드바, 헤더, 네비게이션, 탭, 컨트롤 버튼 전체 강제 숨김 */
          aside, header, nav, .print\\:hidden {
            display: none !important;
          }

          ::-webkit-scrollbar { display: none; }

          /* 화면에서 hidden이었던 월별 시트도 인쇄 시 강제 출력 */
          .print\\:block {
            display: block !important;
          }

          /* 월별 페이지 분할 */
          .page-break {
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          .page-break:last-child {
            page-break-after: auto !important;
            break-after: auto !important;
          }

          /* A4 가로 고정 크기 */
          .print-sheet {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 22mm 12mm 6mm 12mm !important; /* 상단 22mm(편철용), 우측 12mm, 하단 6mm, 좌측 12mm */
            box-sizing: border-box !important;
            box-shadow: none !important;
            background-color: white !important;
            overflow: hidden !important;
          }
        }
      `}</style>

      {/* ── 상단 전체 고정 영역 (인쇄 시 숨김) ── */}
      <div className="print:hidden sticky top-0 z-20 flex flex-col w-full shadow-md">

        {/* 1. 컨트롤 바 */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white px-5 py-4">
          <h1 className="text-lg font-bold text-slate-800">운수종사자 일상점검표 (1년치)</h1>
          <div className="flex items-center gap-3 flex-wrap">

            {/* 차량 검색 드롭다운 */}
            <div className="relative">
              <div className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-1.5 bg-white focus-within:border-[#ff6b35]">
                <Search size={14} className="text-gray-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="차량번호 또는 기사명 검색"
                  value={vehicleSearch}
                  onChange={(e) => {
                    setVehicleSearch(e.target.value)
                    setShowDropdown(true)
                    if (!e.target.value) {
                      setSelectedVehicle(null)
                      setDataLoaded(false)
                    }
                  }}
                  onFocus={() => setShowDropdown(true)}
                  onClick={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  className="w-52 text-sm font-bold text-black outline-none bg-transparent placeholder:font-normal placeholder:text-gray-400"
                />
                {selectedVehicle && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      setSelectedVehicle(null)
                      setVehicleSearch('')
                      setDataLoaded(false)
                      setShowDropdown(true)
                    }}
                    className="ml-1 flex-shrink-0 text-gray-400 hover:text-gray-700 text-base leading-none"
                    aria-label="차량 선택 초기화"
                  >
                    ×
                  </button>
                )}
              </div>
              {showDropdown && filteredVehicles.length > 0 && (
                <ul className="absolute top-full left-0 z-50 mt-1 w-full max-h-52 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm">
                  {filteredVehicles.map((v) => (
                    <li
                      key={v.vehicle_number}
                      onMouseDown={() => handleVehicleSelect(v)}
                      className="cursor-pointer px-3 py-2 hover:bg-slate-50 border-b border-gray-100 last:border-0"
                    >
                      <span className="font-semibold text-slate-800">{v.vehicle_number}</span>
                      {v.driver_name && (
                        <span className="ml-2 text-slate-500">{v.driver_name}</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* 연도 선택 */}
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              연도
              <select
                value={year}
                onChange={(e) => {
                  setYear(Number(e.target.value))
                  setDataLoaded(false)
                }}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-semibold text-black focus:border-[#ff6b35] focus:outline-none bg-white"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}년</option>
                ))}
              </select>
            </label>

            {/* 조회 버튼 */}
            <button
              onClick={loadYearlyData}
              disabled={!selectedVehicle || loading}
              className="flex items-center gap-2 rounded-md bg-slate-700 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? <Loader size={14} className="animate-spin" /> : null}
              조회하기
            </button>

            {/* 인쇄 버튼 */}
            <button
              onClick={() => window.print()}
              disabled={!dataLoaded}
              className="flex items-center gap-2 rounded-md bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e85d2a] active:bg-[#d4521f] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Printer size={16} />
              인쇄하기
            </button>
          </div>
        </div>

        {/* 2. 월 선택 탭 (데이터 로드 완료 후 노출) */}
        {dataLoaded && !loading && (
          <div className="flex flex-wrap items-center gap-1.5 px-5 py-3 bg-slate-50 border-t border-gray-200">
            {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => (
              <button
                key={m}
                onClick={() => setActivePreviewMonth(m)}
                className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                  activePreviewMonth === m
                    ? 'bg-[#ff6b35] text-white'
                    : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
                }`}
              >
                {m}월
              </button>
            ))}
            <button
              onClick={() => setActivePreviewMonth('all')}
              className={`rounded px-3 py-1 text-xs font-semibold transition-colors ${
                activePreviewMonth === 'all'
                  ? 'bg-slate-700 text-white'
                  : 'bg-gray-100 text-slate-600 hover:bg-gray-200'
              }`}
            >
              전체
            </button>
          </div>
        )}
      </div>

      {/* 안내 메시지 */}
      {!dataLoaded && !loading && (
        <div className="print:hidden flex flex-col items-center justify-center gap-3 py-32 text-slate-500">
          <p className="text-sm">차량을 선택하고 연도를 지정한 후 &quot;조회하기&quot;를 눌러주세요.</p>
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="print:hidden flex flex-col items-center justify-center gap-4 py-32">
          <Loader size={36} className="animate-spin text-[#ff6b35]" />
          <p className="text-sm font-medium text-gray-600">1년치 점검 데이터를 불러오는 중입니다...</p>
        </div>
      )}

      {/* 12개월 A4 양식 출력 영역 */}
      {dataLoaded && !loading && (
        <div className="overflow-x-auto py-8 bg-gray-100 print:bg-transparent print:py-0 print:overflow-visible">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((monthNum) => (
            <div
              key={monthNum}
              className={`page-break print-sheet mb-6 print:mb-0 ${
                activePreviewMonth === 'all' || activePreviewMonth === monthNum
                  ? 'block'
                  : 'hidden print:block'
              }`}
            >
              <MonthSheet
                year={year}
                monthNum={monthNum}
                companyName={companyName}
                vehicleNumber={selectedVehicle?.vehicle_number ?? ''}
                driverName={selectedVehicle?.driver_name ?? ''}
                byDay={byMonthDay[monthNum] ?? {}}
                actionLines={monthActionLines[monthNum] ?? []}
              />
            </div>
          ))}
        </div>
      )}


    </div>
  )
}

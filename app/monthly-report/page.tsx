'use client'

import { useState, useEffect, useMemo } from 'react'
import { Printer, Loader } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ────────────────────────────────────────
// 점검 항목 그룹 정의 (항목=행, 날짜=열 구조)
// s1은 그리드 행에서 제외하고 조치기록 데이터 용도로만 사용
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

// 점검 항목 1건 (DB row)
interface ItemRow {
  inspection_id: string
  item_id: string
  status: 'normal' | 'abnormal' | 'skipped' | 'pending' | null
  note: string | null
  image_urls: string[] | null
}

// 상태 → 기호 변환
function statusSymbol(status: ItemRow['status']): string {
  if (status === 'normal') return 'O'
  if (status === 'abnormal') return 'X'
  if (status === 'skipped') return '미'
  return ''
}

// 이번 달 YYYY-MM 기본값
function currentMonth(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export default function MonthlyReportPage() {
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth)
  const [loading, setLoading] = useState(true)

  const [companyName, setCompanyName] = useState('')
  const [driverName, setDriverName] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')

  // 일자별 → item_id별 점검 데이터
  const [byDay, setByDay] = useState<Record<number, Record<string, ItemRow>>>({})
  // 불량상태 조치 기록 라인들
  const [actionLines, setActionLines] = useState<string[]>([])

  const [year, monthNum] = useMemo(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return [y, m]
  }, [selectedMonth])

  // 연도 두 자리 (예: 2026 → "26")
  const yearShort = String(year).slice(2)
  // 월 두 자리 (예: 7 → "07")
  const monthStr = String(monthNum).padStart(2, '0')

  // 해당 월의 마지막 일 (28~31)
  const daysInMonth = useMemo(() => new Date(year, monthNum, 0).getDate(), [year, monthNum])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const supabase = createClient()

        // 1) 현재 세션 유저
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          if (!cancelled) setLoading(false)
          return
        }

        // 운전자 이름 (메타데이터 → 이메일 fallback)
        const name =
          (user.user_metadata?.name as string | undefined) ??
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          ''
        if (!cancelled) setDriverName(name)

        // 2) 회사명 조회
        try {
          const res = await fetch('/api/v1/users/me')
          if (res.ok) {
            const json = await res.json()
            if (!cancelled) setCompanyName(json.companyName ?? '')
          }
        } catch {
          // 무시
        }

        // 3) 차량번호 + 운전자 이름 조회
        const orFilters = [`driver_id.eq.${user.id}`]
        if (user.email) orFilters.push(`driver_id.eq.${user.email}`)

        const { data: vehicle } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_vehicles')
          .select('vehicle_number, driver_name')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle()

        const vNum = vehicle?.vehicle_number ?? ''
        const dName = vehicle?.driver_name ?? name
        if (!cancelled) {
          setVehicleNumber(vNum)
          setDriverName(dName)
        }

        if (!vNum) {
          if (!cancelled) {
            setByDay({})
            setActionLines([])
            setLoading(false)
          }
          return
        }

        // 4) 한 달 치 점검 마스터 조회
        const startLocal = new Date(year, monthNum - 1, 1, 0, 0, 0)
        const endLocal = new Date(year, monthNum, 1, 0, 0, 0)

        const { data: inspections } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspections')
          .select('id, inspected_at')
          .eq('vehicle_number', vNum)
          .gte('inspected_at', startLocal.toISOString())
          .lt('inspected_at', endLocal.toISOString())

        const inspList = inspections ?? []
        const idToDay = new Map<string, number>()
        const ids: string[] = []
        for (const insp of inspList) {
          const localDate = new Date(insp.inspected_at as string)
          const day = localDate.getDate()
          idToDay.set(insp.id as string, day)
          ids.push(insp.id as string)
        }

        const map: Record<number, Record<string, ItemRow>> = {}
        const actions: { day: number; note: string | null }[] = []

        if (ids.length > 0) {
          const { data: items } = await supabase
            .schema('driver-checklist')
            .from('universal_driving_check_inspection_items')
            .select('inspection_id, item_id, status, note, image_urls')
            .in('inspection_id', ids)

          for (const it of (items ?? []) as ItemRow[]) {
            const day = idToDay.get(it.inspection_id)
            if (!day) continue
            if (!map[day]) map[day] = {}
            map[day][it.item_id] = it

            // s1(불량상태 조치) 이 'abnormal'(있음)인 경우 조치 기록 수집
            if (it.item_id === 's1' && it.status === 'abnormal') {
              actions.push({ day, note: it.note })
            }
          }
        }

        actions.sort((a, b) => a.day - b.day)
        const lines = actions.slice(0, 3).map(
          (a) =>
            `[${monthNum}월 ${a.day}일] ${a.note && a.note.trim() ? a.note : '조치 필요'}`,
        )

        if (!cancelled) {
          setByDay(map)
          setActionLines(lines)
          setLoading(false)
        }
      } catch (err) {
        console.error('[monthly-report] 데이터 조회 오류:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [year, monthNum])

  // 1~31 고정 날짜 배열
  const days = Array.from({ length: 31 }, (_, i) => i + 1)

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 0; }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 297mm;
            height: 210mm;
          }
          header, nav, .print\\:hidden { display: none !important; }
          ::-webkit-scrollbar { display: none; }
          .print-container {
            width: 297mm !important;
            height: 210mm !important;
            margin: 0 !important;
            padding: 10mm 12mm !important;
            box-shadow: none !important;
            display: flex;
            flex-direction: column;
          }
        }
      `}</style>

      {/* 상단 컨트롤 (인쇄 시 숨김) */}
      <div className="print:hidden sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 bg-white border-b border-gray-200 px-5 py-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-800">운수종사자 일상점검표</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            점검연월
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-[#ff6b35] focus:outline-none"
            />
          </label>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-md bg-[#ff6b35] px-4 py-2 text-sm font-semibold text-white hover:bg-[#e85d2a] active:bg-[#d4521f] transition-colors"
          >
            <Printer size={16} />
            인쇄하기
          </button>
        </div>
      </div>

      {/* 로딩 */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 py-32">
          <Loader size={36} className="animate-spin text-[#ff6b35]" />
          <p className="text-sm font-medium text-gray-600">점검 데이터를 불러오는 중입니다...</p>
        </div>
      ) : (
        <div className="overflow-x-auto py-6 print:py-0">
          {/* A4 가로 양식 */}
          <div className="w-[297mm] min-h-[210mm] mx-auto bg-white text-black p-[10mm] shadow-lg print-container">

            {/* 제목 */}
            <p className="text-center text-[13px] font-bold mb-1.5 tracking-widest">
              운수종사자 일상점검표
            </p>

            {/* ── 상단 정보란 ── */}
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

            {/* ── 메인 점검표 (항목=행, 날짜=열) ── */}
            <table className="w-full flex-1 border-collapse border border-black table-fixed text-center text-[8.5px] leading-tight">
              <colgroup>
                {/* 카테고리 열 */}
                <col style={{ width: '3%' }} />
                {/* 항목명 열 */}
                <col style={{ width: '14%' }} />
                {/* 1~31일 열 (각 동일 너비) */}
                {days.map((d) => (
                  <col key={d} style={{ width: `${83 / 31}%` }} />
                ))}
              </colgroup>

              <thead>
                {/* 1행: 점검항목 / 점검결과 헤더 */}
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
                {/* 2행: 1~31 날짜 */}
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
                      {/* 카테고리 셀: 첫 번째 항목에만 rowSpan으로 렌더링 */}
                      {itemIdx === 0 && (
                        <td
                          rowSpan={group.items.length}
                          className="border border-black font-bold text-[8px] leading-[1.6] whitespace-pre-line align-middle p-0"
                        >
                          {group.verticalLabel}
                        </td>
                      )}

                      {/* 항목명 */}
                      <td className="border border-black text-left px-1 py-0.5 leading-snug text-[8px] align-middle">
                        {item.label}
                      </td>

                      {/* 1~31일 데이터 칸 */}
                      {days.map((d) => {
                        const row = byDay[d]?.[item.id]
                        return (
                          <td
                            key={d}
                            className="border border-black p-0 h-[34px] align-middle font-medium text-[8.5px]"
                          >
                            {statusSymbol(row?.status ?? null)}
                          </td>
                        )
                      })}
                    </tr>
                  )),
                )}

                {/* ── 서명 행 ── */}
                <tr>
                  <th
                    colSpan={2}
                    className="border border-black h-[45px] font-bold text-[8.5px]"
                  >
                    점검자 확인(서명)
                  </th>
                  {days.map((d) => {
                    const row = byDay[d]?.['s2']
                    const url = row?.image_urls?.[0]
                    return (
                      <td
                        key={d}
                        className="border border-black p-0 h-[45px] align-middle"
                      >
                        {url ? (
                          <img
                            src={url}
                            alt="서명"
                            crossOrigin="anonymous"
                            className="h-7 w-full object-contain"
                          />
                        ) : null}
                      </td>
                    )
                  })}
                </tr>

                {/* ── 불량상태 조치 기록 행 ── */}
                <tr>
                  <th
                    colSpan={2}
                    className="border border-black h-[100px] font-bold text-[8.5px] align-middle"
                  >
                    불량상태 조치 기록
                  </th>
                  <td
                    colSpan={31}
                    className="border border-black text-left px-2 py-1 align-top h-[100px] text-[8.5px]"
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
        </div>
      )}
    </div>
  )
}

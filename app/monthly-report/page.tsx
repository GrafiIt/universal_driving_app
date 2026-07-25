'use client'

import { useState, useEffect, useMemo } from 'react'
import { Printer, Loader } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

// ────────────────────────────────────────
// 점검항목 정의 (양식 열 순서와 동일)
//  - 외관점검 4 / 상태점검 3 / 기타 4 / 조치여부 1 / 서명 1 = 총 13개 항목열 + 날짜열 = 14열
// ────────────────────────────────────────
const GROUPS: { label: string; items: { id: string; label: string }[] }[] = [
  {
    label: '외관점검',
    items: [
      { id: 'v1', label: '번호판·전면유리·후사경 등 청결상태' },
      { id: 'v2', label: '후미등·차폭등 등 등화장치 작동상태' },
      { id: 'v3', label: '창닦이기 작동상태' },
      { id: 'v4', label: '적재함·측면보호대·후부반사판 등 부착·훼손 여부' },
    ],
  },
  {
    label: '상태점검',
    items: [
      { id: 'w1', label: '타이어 손상 및 마모(1.6mm이상) 여부' },
      { id: 'w2', label: '화물·적재함 지지대(판스프링) 고정상태' },
      { id: 'w3', label: '바퀴 너트 등 균열 여부' },
    ],
  },
  {
    label: '기타',
    items: [
      { id: 'e1', label: '냉각수·공기압·엔진오일 등 이상 여부' },
      { id: 'e2', label: '좌석안전띠 상태' },
      { id: 'e3', label: '소화기 비치 여부' },
      { id: 'e4', label: '안전삼각대 등 비치 여부' },
    ],
  },
  {
    label: '조치여부',
    items: [{ id: 's1', label: '불량상태 조치(개선) 여부' }],
  },
  {
    label: '서명',
    items: [{ id: 's2', label: '점검자 확인(서명)' }],
  },
]

// 모든 항목 id 를 평탄화한 열 순서
const COLUMN_ITEMS = GROUPS.flatMap((g) => g.items)

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

        // 3) 차량번호 조회 (driver_id = user.id 또는 email)
        const orFilters = [`driver_id.eq.${user.id}`]
        if (user.email) orFilters.push(`driver_id.eq.${user.email}`)

        const { data: vehicle } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_vehicles')
          .select('vehicle_number')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle()

        const vNum = vehicle?.vehicle_number ?? ''
        if (!cancelled) setVehicleNumber(vNum)

        if (!vNum) {
          if (!cancelled) {
            setByDay({})
            setActionLines([])
            setLoading(false)
          }
          return
        }

        // 4) 한 달 치 점검 마스터 조회 (로컬 월 경계 → ISO 변환)
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
          // Timezone 안전: ISO → Date → 로컬 일(day) 추출
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

            // 조치여부(s1) 가 '있음'(abnormal) 인 기록 수집
            if (it.item_id === 's1' && it.status === 'abnormal') {
              actions.push({ day, note: it.note })
            }
          }
        }

        actions.sort((a, b) => a.day - b.day)
        const lines = actions.map(
          (a) => `[${monthNum}월 ${a.day}일] ${a.note && a.note.trim() ? a.note : '조치 필요'}`,
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

  const cellBase = 'border border-black text-center align-middle py-0.5 px-1'

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* @page 인쇄 설정 */}
      <style>{'@media print { @page { size: A4 landscape; margin: 10mm; } body { background: white; } }'}</style>

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
          <div className="w-[297mm] min-h-[210mm] mx-auto bg-white text-black text-[10px] md:text-xs p-4 shadow-lg print:shadow-none print:p-0">
            {/* 제목 */}
            <h2 className="text-center text-lg font-bold mb-2">운수종사자 일상점검표</h2>

            {/* 상단 정보란 */}
            <table className="w-full border-collapse border border-black mb-1">
              <tbody>
                <tr>
                  <th className={`${cellBase} bg-gray-100 w-[12%]`}>점검연월</th>
                  <td className={`${cellBase} w-[21%]`}>
                    {year}년 {monthNum}월
                  </td>
                  <th className={`${cellBase} bg-gray-100 w-[12%]`}>운송사업자명</th>
                  <td className={`${cellBase} w-[21%]`}>{companyName || '-'}</td>
                  <th className={`${cellBase} bg-gray-100 w-[10%]`}>등록번호</th>
                  <td className={`${cellBase}`}>{vehicleNumber || '-'}</td>
                  <th className={`${cellBase} bg-gray-100 w-[12%]`}>운수종사자성명</th>
                  <td className={`${cellBase}`}>{driverName || '-'}</td>
                </tr>
              </tbody>
            </table>

            {/* 범례 */}
            <p className="text-right text-[9px] md:text-[10px] mb-1">
              점검결과 (양호 O, 불량 X, 미운행시 &quot;미&quot; 기입)
            </p>

            {/* 점검표 본문 */}
            <table className="w-full border-collapse border border-black table-fixed">
              <thead>
                {/* 1행: 날짜 + 카테고리 그룹 */}
                <tr>
                  <th className={`${cellBase} bg-gray-100 w-[5%]`} rowSpan={2}>
                    일자
                  </th>
                  {GROUPS.map((g) => (
                    <th key={g.label} className={`${cellBase} bg-gray-100`} colSpan={g.items.length}>
                      {g.label}
                    </th>
                  ))}
                </tr>
                {/* 2행: 개별 점검항목 */}
                <tr>
                  {COLUMN_ITEMS.map((item) => (
                    <th
                      key={item.id}
                      className={`${cellBase} bg-gray-50 text-[8px] md:text-[9px] leading-tight font-normal`}
                    >
                      {item.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dayData = byDay[day] ?? {}
                  return (
                    <tr key={day}>
                      <td className={`${cellBase} bg-gray-50 font-medium`}>{day}</td>
                      {COLUMN_ITEMS.map((item) => {
                        const row = dayData[item.id]
                        // 서명 열: 이미지가 있으면 렌더링
                        if (item.id === 's2') {
                          const url = row?.image_urls?.[0]
                          return (
                            <td key={item.id} className={`${cellBase} h-6`}>
                              {url ? (
                                <img
                                  src={url || '/placeholder.svg'}
                                  alt="서명"
                                  crossOrigin="anonymous"
                                  className="h-4 mx-auto object-contain"
                                />
                              ) : (
                                ''
                              )}
                            </td>
                          )
                        }
                        return (
                          <td key={item.id} className={`${cellBase} h-6 font-medium`}>
                            {statusSymbol(row?.status ?? null)}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* 하단 불량상태 조치 기록 */}
            <table className="w-full border-collapse border border-black border-t-0">
              <tbody>
                <tr>
                  <th className={`${cellBase} bg-gray-100 w-[12%] align-top`}>불량상태 조치 기록</th>
                  <td className="border border-black px-2 py-1 align-top text-left">
                    {actionLines.length > 0 ? (
                      <div className="flex flex-col gap-0.5">
                        {actionLines.map((line, idx) => (
                          <span key={idx}>{line}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-gray-400">(해당 없음)</span>
                    )}
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

'use client'

import { useEffect, useRef, useState } from 'react'
import { UserCircle, Gauge, Clock, Package, Boxes, Zap, Search, X, Loader, Truck, Calendar } from 'lucide-react'
import { CATEGORIES, CATEGORY_COUNT, CHECKLIST_ITEMS, type InspectionResult } from '@/lib/checklist-data'
import { createClient } from '@/utils/supabase/client'

interface StartScreenProps {
  results: Record<string, InspectionResult>
  driverName: string
  vehicleNumber: string
  userLevel: number | null
  selectedDate: string
  onDateChange: (date: string) => void
  onVehicleChange: (name: string, num: string) => void
  onStart: () => void
  onEdit: (inspectionId: string) => void
  onSkipToday: (inspectionId?: string | null) => void
  isLoadingEdit: boolean
}

interface VehicleRow {
  vehicle_number: string
  driver_name: string | null
}

function getTodayString(): string {
  return new Date().toISOString().split('T')[0]
}

function getMinDateString(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 3)
  return d.toISOString().split('T')[0]
}

function formatDateDisplay(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  const [yyyy, mm, dd] = dateStr.split('-')
  const dateObj = new Date(`${yyyy}-${mm}-${dd}`)
  const day = days[dateObj.getDay()]
  return `${yyyy}.${mm}.${dd} (${day})`
}

function getCategoryIcon(key: string) {
  if (key === 'vehicle') return <Package size={28} className="text-[#1a3a52]" />
  if (key === 'work') return <Boxes size={28} className="text-[#1a3a52]" />
  if (key === 'etc') return <Zap size={28} className="text-[#1a3a52]" />
  if (key === 'sign') return <Zap size={28} className="text-[#1a3a52]" />
  return null
}

function getCategoryBg(key: string) {
  if (key === 'vehicle') return 'bg-orange-50'
  if (key === 'work') return 'bg-slate-100'
  if (key === 'etc') return 'bg-slate-100'
  if (key === 'sign') return 'bg-orange-50'
  return 'bg-gray-50'
}

export default function StartScreen({ results, driverName, vehicleNumber, userLevel, selectedDate, onDateChange, onVehicleChange, onStart, onEdit, onSkipToday, isLoadingEdit }: StartScreenProps) {
  const [inspectionState, setInspectionState] = useState<'none' | 'partial' | 'completed'>('none')
  const [fetchedItemStatuses, setFetchedItemStatuses] = useState<Record<string, string>>({})
  const [dateInspectionId, setDateInspectionId] = useState<string | null>(null)
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false)

  const isAdmin = userLevel === 1 || userLevel === 2
  const todayStr = getTodayString()
  const minDate = getMinDateString()
  const isToday = selectedDate === todayStr

  // 선택 날짜 기준 점검 상태 조회
  useEffect(() => {
    const checkDateInspection = async () => {
      // 이전 차량/날짜의 잔상이 남지 않도록 먼저 초기화
      setInspectionState('none')
      setFetchedItemStatuses({})
      setDateInspectionId(null)

      try {
        const supabase = createClient()
        const dateStart = new Date(`${selectedDate}T00:00:00`)
        const dateEnd = new Date(`${selectedDate}T23:59:59`)

        const { data, error } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspections')
          .select('id, universal_driving_check_inspection_items(item_id, status)')
          .eq('vehicle_number', vehicleNumber)
          .gte('inspected_at', dateStart.toISOString())
          .lte('inspected_at', dateEnd.toISOString())
          .order('inspected_at', { ascending: false })
          .limit(1)

        if (!error && data && data.length > 0) {
          const inspection = data[0]
          setDateInspectionId(inspection.id)

          const items = (inspection.universal_driving_check_inspection_items ?? []) as { item_id: string; status: string }[]

          // item_id → status 매핑 저장
          const statusMap: Record<string, string> = {}
          for (const item of items) {
            statusMap[item.item_id] = item.status
          }
          setFetchedItemStatuses(statusMap)

          // pending이 아닌 항목 수로 완료 여부 판별
          const nonPendingCount = items.filter((i) => i.status !== 'pending').length
          const totalItems = CHECKLIST_ITEMS.length
          const isAllCompleted = nonPendingCount === totalItems

          setInspectionState(isAllCompleted ? 'completed' : 'partial')
        } else {
          setInspectionState('none')
          setFetchedItemStatuses({})
          setDateInspectionId(null)
        }
      } catch {
        // 조회 실패 시 기본값(미완료)으로 유지
        setInspectionState('none')
        setFetchedItemStatuses({})
        setDateInspectionId(null)
      }
    }

    checkDateInspection()
  }, [vehicleNumber, selectedDate])

  // 점검 시작 / 이어서 / 수정 분기 핸들러
  const handleMainButtonClick = () => {
    if (inspectionState === 'completed') {
      if (!dateInspectionId) return
      const confirmMsg = isToday
        ? '오늘 점검을 마무리했는데 수정하시겠습니까?'
        : `${formatDateDisplay(selectedDate)} 점검을 수정하시겠습니까?`
      const confirmed = window.confirm(confirmMsg)
      if (confirmed) {
        onEdit(dateInspectionId)
      }
    } else if (inspectionState === 'partial') {
      if (!dateInspectionId) return
      onEdit(dateInspectionId)
    } else {
      onStart()
    }
  }

  const totalItems = CHECKLIST_ITEMS.length

  // DB 데이터 기준으로 완료 수 계산 (partial/completed 상태일 때)
  const displayCompleted = inspectionState !== 'none'
    ? Object.values(fetchedItemStatuses).filter((s) => s !== 'pending').length
    : Object.values(results).filter((r) => r.status === 'normal' || r.status === 'abnormal').length
  const progressPercent = Math.round((displayCompleted / totalItems) * 100)

  const getCategoryCompleted = (categoryKey: string) => {
    if (inspectionState !== 'none') {
      const categoryItems = CHECKLIST_ITEMS.filter((i) => i.categoryKey === categoryKey)
      return categoryItems.filter(
        (i) => fetchedItemStatuses[i.id] !== undefined && fetchedItemStatuses[i.id] !== 'pending'
      ).length
    }
    const categoryItems = CHECKLIST_ITEMS.filter((i) => i.categoryKey === categoryKey)
    return categoryItems.filter(
      (i) => results[i.id]?.status === 'normal' || results[i.id]?.status === 'abnormal'
    ).length
  }

  // 메인 버튼 텍스트 결정
  const getMainButtonText = () => {
    if (isLoadingEdit) return '불러오는 중...'
    if (inspectionState === 'completed') {
      if (!isToday) return '해당 일자 점검 완료 (수정하기)'
      return '오늘 점검 완료 (수정하기)'
    }
    if (inspectionState === 'partial') return '이어서 점검하기'
    return '점검 시작'
  }

  return (
    <div className="w-full min-h-screen bg-white flex flex-col" style={{ touchAction: 'pan-y' }}>
      {/* 본문 */}
      <main className="flex-1 px-4 pb-4 flex flex-col gap-3">
        {/* 정보 카드 */}
        <div className="bg-white rounded-none border border-gray-200 overflow-hidden">
          {/* 작업자명 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <UserCircle size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">작업자명</span>
            <span className="text-sm font-bold text-[#1a3a52]">{driverName}</span>
          </div>
          {/* 차량번호 */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Gauge size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">차량번호</span>
            <span className="text-sm font-bold text-[#1a3a52]">{vehicleNumber}</span>
            <button
              onClick={() => setIsVehicleModalOpen(true)}
              aria-label="차량 검색 및 변경"
              className="ml-2 w-8 h-8 flex items-center justify-center rounded-none bg-orange-100 text-[#ff6b35] hover:bg-orange-200 active:bg-orange-300 transition-colors flex-shrink-0"
            >
              <Search size={16} />
            </button>
          </div>
          {/* 점검일시 */}
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-[#1a3a52]" />
            </div>
            <span className="text-sm text-gray-600 flex-1 font-medium">점검일시</span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${isToday ? 'text-[#1a3a52]' : 'text-[#ff6b35]'}`}>
                {formatDateDisplay(selectedDate)}
                {!isToday && <span className="ml-1 text-xs font-normal text-[#ff6b35]">(소급)</span>}
              </span>
              <div className="relative flex items-center justify-center w-8 h-8 flex-shrink-0">
                <div className="absolute inset-0 flex items-center justify-center rounded-none bg-orange-100 text-[#ff6b35] hover:bg-orange-200 active:bg-orange-300 transition-colors pointer-events-none">
                  <Calendar size={16} />
                </div>
                <input
                  type="date"
                  min={minDate}
                  max={todayStr}
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) onDateChange(e.target.value)
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="점검일 선택"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 전체 진행률 카드 */}
        <div className="bg-white rounded-none border border-gray-200 px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold text-[#1a3a52]">전체 점검 진행률</span>
            <span className="text-sm text-gray-600">
              <span className="font-bold text-[#ff6b35]">{displayCompleted}</span>
              {' / '}{totalItems} 항목
            </span>
          </div>
          {/* 프로그레스 바 */}
          <div className="h-2 bg-gray-300 rounded-none overflow-hidden mb-3">
            <div
              className="h-full bg-[#ff6b35] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-center text-2xl font-bold text-[#1a3a52]">{progressPercent}%</p>
        </div>

        {/* 카테고리별 요약 카드 */}
        <div className="bg-white rounded-none border border-gray-200 px-4 py-4">
          <div className="grid grid-cols-4 gap-2">
            {CATEGORIES.map((cat) => {
              const total = CATEGORY_COUNT[cat.key]
              const completed = getCategoryCompleted(cat.key)
              return (
                <div
                  key={cat.key}
                  className={`${getCategoryBg(cat.key)} rounded-none flex flex-col items-center py-4 gap-2 border border-gray-200`}
                >
                  {getCategoryIcon(cat.key)}
                  <span className="text-xs font-bold text-[#1a3a52] text-center leading-tight">
                    {cat.label}
                  </span>
                  <div className="text-center">
                    <span className="text-lg font-bold text-[#ff6b35]">{completed}</span>
                    <span className="text-xs text-gray-600"> / {total}</span>
                  </div>
                  <span className="text-xs text-gray-600 font-medium">항목</span>
                </div>
              )
            })}
          </div>
        </div>
      </main>

      {/* 하단 버튼 */}
      <div className="sticky bottom-0 mt-auto px-4 pb-6 pt-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={handleMainButtonClick}
            disabled={isLoadingEdit}
            className={`flex-1 h-14 text-white text-base font-bold rounded-none transition-colors
              ${isLoadingEdit
                ? 'bg-gray-400 cursor-not-allowed opacity-70'
                : inspectionState === 'completed'
                ? 'bg-[#1a3a52] hover:bg-[#0f2635] active:bg-[#081a28]'
                : inspectionState === 'partial'
                ? 'bg-[#5a8fae] hover:bg-[#4a7a99] active:bg-[#3a6680]'
                : 'bg-[#ff6b35] hover:bg-[#e55a24] active:bg-[#cc4910]'
              }`}
          >
            {getMainButtonText()}
          </button>
          <button
            onClick={() => onSkipToday(inspectionState !== 'none' ? dateInspectionId : null)}
            disabled={isLoadingEdit}
            className={`h-14 px-4 text-sm font-bold rounded-none transition-colors border whitespace-nowrap
              ${isLoadingEdit
                ? 'bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed opacity-60'
                : 'bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200 active:bg-gray-300'
              }`}
          >
            금일 미운행
          </button>
        </div>
      </div>

      {/* 차량 검색 모달 */}
      {isVehicleModalOpen && (
        <VehicleSearchModal
          isAdmin={isAdmin}
          currentDriverName={driverName}
          onClose={() => setIsVehicleModalOpen(false)}
          onSelect={(name, num) => {
            onVehicleChange(name, num)
            setIsVehicleModalOpen(false)
          }}
        />
      )}
    </div>
  )
}

// ── 차량 검색 모달 ──
interface VehicleSearchModalProps {
  isAdmin: boolean
  currentDriverName: string
  onClose: () => void
  onSelect: (name: string, num: string) => void
}

function VehicleSearchModal({ isAdmin, currentDriverName, onClose, onSelect }: VehicleSearchModalProps) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false

    const fetchVehicles = async () => {
      try {
        const supabase = createClient()

        let queryBuilder = supabase
          .schema('driver-checklist')
          .from('universal_driving_check_vehicles')
          .select('vehicle_number, driver_name')
          .order('vehicle_number', { ascending: true })

        if (!isAdmin) {
          queryBuilder = queryBuilder.eq('driver_name', currentDriverName)
        }

        const { data, error } = await queryBuilder

        if (!cancelled) {
          if (!error && data) {
            setVehicles(data as VehicleRow[])
          }
          setIsLoading(false)
        }
      } catch {
        if (!cancelled) setIsLoading(false)
      }
    }

    fetchVehicles()

    return () => {
      cancelled = true
    }
  }, [isAdmin, currentDriverName])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = normalizedQuery
    ? vehicles.filter(
        (v) =>
          v.vehicle_number.toLowerCase().includes(normalizedQuery) ||
          (v.driver_name ?? '').toLowerCase().includes(normalizedQuery)
      )
    : vehicles

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="차량 검색"
    >
      <div
        className="w-full max-w-md bg-white rounded-none border border-gray-200 shadow-xl flex flex-col max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-[#1a3a52]">차량 선택</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-none hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <X size={20} className="text-gray-600" />
          </button>
        </div>

        {/* 검색창 (Sticky) */}
        <div className="sticky top-0 z-10 bg-white px-5 py-3 border-b border-gray-200 flex-shrink-0">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="차량번호 또는 작업자명 검색"
              autoFocus
              className="w-full h-11 pl-10 pr-3 text-sm rounded-none border border-gray-300 bg-white text-[#1a3a52] focus:outline-none focus:border-[#ff6b35] focus:ring-1 focus:ring-[#ff6b35]"
            />
          </div>
        </div>

        {/* 리스트 */}
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12">
              <Loader size={28} className="animate-spin text-[#ff6b35]" />
              <p className="text-sm text-gray-500">차량 목록을 불러오는 중...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12">
              <Truck size={28} className="text-gray-300" />
              <p className="text-sm text-gray-500">검색 결과가 없습니다.</p>
            </div>
          ) : (
            <ul>
              {filtered.map((v) => (
                <li key={v.vehicle_number}>
                  <button
                    onClick={() => onSelect(v.driver_name ?? '미지정', v.vehicle_number)}
                    className="w-full flex items-center gap-3 px-5 py-3 border-b border-gray-100 text-left hover:bg-orange-50 active:bg-orange-100 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-none bg-orange-100 flex items-center justify-center flex-shrink-0">
                      <Truck size={18} className="text-[#1a3a52]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-[#1a3a52] truncate">{v.vehicle_number}</p>
                      <p className="text-xs text-gray-500 truncate">{v.driver_name ?? '미지정'}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

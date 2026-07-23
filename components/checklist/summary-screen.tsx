'use client'

import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CheckSquare, Square, AlertTriangle, ChevronDown, ChevronUp, Loader } from 'lucide-react'
import { useState } from 'react'
import { CATEGORIES, CHECKLIST_ITEMS, type CategoryKey, type InspectionResult } from '@/lib/checklist-data'

interface SummaryScreenProps {
  results: Record<string, InspectionResult>
  driverName: string
  vehicleNumber: string
  onBack: () => void
  onSubmit: () => Promise<void>
  isSubmitting: boolean
}

export default function SummaryScreen({
  results,
  driverName,
  vehicleNumber,
  onBack,
  onSubmit,
  isSubmitting,
}: SummaryScreenProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

  const toggleExpand = (itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const getCategoryItems = (key: CategoryKey) =>
    CHECKLIST_ITEMS.filter((i) => i.categoryKey === key)

  const getCategoryStats = (key: CategoryKey) => {
    const items = getCategoryItems(key)
    const completed = items.filter(
      (i) => results[i.id]?.status === 'normal' || results[i.id]?.status === 'abnormal' || results[i.id]?.status === 'skipped'
    ).length
    const abnormal = items.filter((i) => results[i.id]?.status === 'abnormal').length
    return { total: items.length, completed, abnormal }
  }

  const totalAbnormal = CHECKLIST_ITEMS.filter((i) => results[i.id]?.status === 'abnormal').length

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-4 border-b border-gray-200">
        {/* 좌측: CI 로고 */}
        <Link
          href="/checklist"
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
          aria-label="홈으로 이동"
        >
          <Image
            src="/logo-ci.png"
            alt="극동 로지텍 CI"
            width={48}
            height={40}
            priority
            className="object-contain"
          />
        </Link>
        
        {/* 중앙: 제목 + 작업자/차량 정보 */}
        <div className="flex-1 flex flex-col items-center">
          <h1 className="text-lg font-bold text-[#1a3a52] text-center tracking-tight">이상 항목 기록</h1>
          <p className="text-[11px] font-medium text-gray-500 text-center leading-tight mt-0.5">
            {driverName} · {vehicleNumber}
          </p>
        </div>
        
        {/* 우측: 뒤로 가기 */}
        <button
          onClick={onBack}
          disabled={isSubmitting}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors disabled:opacity-40 flex-shrink-0"
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={24} className="text-[#1a3a52]" />
        </button>
      </header>

      {/* 카테고리별 요약 */}
      <main className="flex-1 px-4 pb-32 flex flex-col gap-4">
        {CATEGORIES.map((cat) => {
          const stats = getCategoryStats(cat.key)
          const isAllDone = stats.completed === stats.total
          const items = getCategoryItems(cat.key)

          return (
            <section key={cat.key}>
              {/* 카테고리 헤더 */}
              <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-sm font-bold text-[#1a3a52]">
                  {cat.label}{' '}
                  <span className="text-gray-500 font-normal">
                    ({stats.completed}/{stats.total})
                  </span>
                </h2>
                {isAllDone ? (
                  <CheckSquare size={18} className="text-green-600" />
                ) : (
                  <Square size={18} className="text-red-500" />
                )}
              </div>

              {/* 항목 목록 */}
              <div className="flex flex-col gap-2">
                {items.map((item) => {
                  const result = results[item.id]
                  const isSkipped = result?.status === 'skipped'
                  const isAbnormal = result?.status === 'abnormal'
                  const isExpanded = expandedItems.has(item.id)
                  const hasDetail = isAbnormal && (result.note || (result.images && result.images.length > 0))

                  return (
                    <div
                      key={item.id}
                      className={`rounded-none border overflow-hidden ${
                        isAbnormal ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {/* 항목 행 */}
                      <div
                        className={`flex items-center gap-2.5 px-3 py-3 border-b border-gray-200 ${
                          hasDetail ? 'cursor-pointer' : ''
                        }`}
                        onClick={() => hasDetail && toggleExpand(item.id)}
                        role={hasDetail ? 'button' : undefined}
                        tabIndex={hasDetail ? 0 : undefined}
                        onKeyDown={(e) => hasDetail && e.key === 'Enter' && toggleExpand(item.id)}
                      >
                        {/* 순서 번호 */}
                        <span
                          className={`w-6 h-6 rounded-none flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${
                            isAbnormal ? 'bg-red-600 text-white' : 'bg-[#1a3a52] text-white'
                          }`}
                        >
                          {item.order}
                        </span>

                        {/* 항목명 */}
                        <span className="flex-1 text-xs text-gray-700 leading-snug">{item.label}</span>

                        {/* 상태 표시 */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {isSkipped ? (
                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-none">
                              미운행
                            </span>
                          ) : isAbnormal ? (
                            <>
                              <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-none">
                                {item.customLabels?.[1] ?? '이상'}
                              </span>
                              {hasDetail && (
                                isExpanded
                                  ? <ChevronUp size={14} className="text-gray-500" />
                                  : <ChevronDown size={14} className="text-gray-500" />
                              )}
                            </>
                          ) : item.type === 'signature' ? (
                            result?.images && result.images.length > 0 ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={result.images[0].dataUrl}
                                alt="서명"
                                className="h-12 w-24 object-contain rounded-none border border-gray-200 bg-white"
                              />
                            ) : (
                              <span className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-none">
                                미서명
                              </span>
                            )
                          ) : item.type === 'number' ? (
                            <span className="text-xs font-bold text-[#1a3a52]">
                              {result?.numberValue ?? '-'} {item.unit}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-none">
                              {item.customLabels?.[0] ?? '정상'}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 이상 상세 펼침 */}
                      {isAbnormal && isExpanded && (
                        <div className="px-3 pb-3 border-t border-red-200">
                          {result.note && (
                            <p className="text-xs text-red-800 mt-2 mb-2 leading-relaxed">
                              <AlertTriangle size={12} className="inline mr-1 mb-0.5" />
                              {result.note}
                            </p>
                          )}
                          {result.images && result.images.length > 0 && (
                            <div className="flex gap-2">
                              {result.images.map((img, idx) => (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={idx}
                                  src={img.dataUrl}
                                  alt={`이상 사진 ${idx + 1}`}
                                  className="w-20 h-20 object-cover rounded-lg border border-red-200"
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {/* 이상 항목 없음 메시지 */}
        {totalAbnormal === 0 && (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckSquare size={40} className="text-green-600" />
            <p className="text-sm font-bold text-green-800">모든 항목 정상입니다</p>
          </div>
        )}
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-gray-200">
        <button
          onClick={onSubmit}
          disabled={isSubmitting}
          className="w-full h-14 bg-[#ff6b35] hover:bg-[#e55a24] active:bg-[#cc4910] text-white text-lg font-bold rounded-none shadow-md transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader size={20} className="animate-spin" />
              제출 중...
            </>
          ) : (
            '점검 완료 제출'
          )}
        </button>
      </div>
    </div>
  )
}

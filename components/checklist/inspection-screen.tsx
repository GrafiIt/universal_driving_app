'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ImagePlus, XCircle, AlertTriangle, Camera, X } from 'lucide-react'
import {
  CATEGORIES,
  CHECKLIST_ITEMS,
  CATEGORY_COUNT,
  type CategoryKey,
  type ChecklistItem,
  type InspectionResult,
  type CompressedImage,
} from '@/lib/checklist-data'
import { compressImage, formatFileSize } from '@/lib/compress-image'

interface InspectionScreenProps {
  results: Record<string, InspectionResult>
  driverName: string
  vehicleNumber: string
  onUpdateResult: (itemId: string, update: Partial<InspectionResult>) => void
  onFinish: () => void
  onBack: () => void
  onPartialSave: () => void
}

// ── iOS 스타일 휠 픽커 ─────────────────────────────────────────
const SLEEP_OPTIONS: number[] = Array.from({ length: 17 }, (_, i) => 4 + i * 0.5) // 4 ~ 12, 0.5단위

interface WheelPickerProps {
  value: number
  onChange: (v: number) => void
}

function WheelPicker({ value, onChange }: WheelPickerProps) {
  const ITEM_H = 44          // px — 각 항목 높이
  const VISIBLE = 5          // 보이는 행 수 (중앙 포함)
  const containerH = ITEM_H * VISIBLE

  const scrollRef = useRef<HTMLDivElement>(null)
  const isUserScroll = useRef(false)

  // 초기 스크롤 위치 설정 (value 기준)
  useEffect(() => {
    const idx = SLEEP_OPTIONS.indexOf(value)
    if (idx < 0 || !scrollRef.current) return
    scrollRef.current.scrollTop = idx * ITEM_H
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 외부 value 변경 시 스크롤 동기화
  useEffect(() => {
    if (isUserScroll.current) return
    const idx = SLEEP_OPTIONS.indexOf(value)
    if (idx < 0 || !scrollRef.current) return
    scrollRef.current.scrollTop = idx * ITEM_H
  }, [value])

  const handleScroll = () => {
    const el = scrollRef.current
    if (!el) return
    isUserScroll.current = true
    const idx = Math.round(el.scrollTop / ITEM_H)
    const clamped = Math.max(0, Math.min(SLEEP_OPTIONS.length - 1, idx))
    if (SLEEP_OPTIONS[clamped] !== value) {
      onChange(SLEEP_OPTIONS[clamped])
    }
    // 잠시 후 플래그 해제
    clearTimeout((el as HTMLDivElement & { _swTimer?: ReturnType<typeof setTimeout> })._swTimer)
    ;(el as HTMLDivElement & { _swTimer?: ReturnType<typeof setTimeout> })._swTimer =
      setTimeout(() => { isUserScroll.current = false }, 200)
  }

  const padding = Math.floor(VISIBLE / 2) * ITEM_H // 위아래 패딩으로 중앙 정렬

  return (
    <div
      className="relative flex-1 select-none overflow-hidden"
      style={{ height: containerH }}
    >
      {/* 중앙 하이라이트 바 */}
      <div
        className="pointer-events-none absolute left-0 right-0 z-10 rounded-xl bg-gray-100 border border-gray-200"
        style={{ top: Math.floor(VISIBLE / 2) * ITEM_H, height: ITEM_H }}
      />

      {/* 위쪽 그라데이션 페이드 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-16 bg-gradient-to-b from-white to-transparent" />
      {/* 아래쪽 그라데이션 페이드 */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-16 bg-gradient-to-t from-white to-transparent" />

      {/* 스크롤 영역 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-auto snap-y snap-mandatory scrollbar-hide"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {/* 상단 패딩 */}
        <div style={{ height: padding }} />

        {SLEEP_OPTIONS.map((opt) => {
          const isSelected = opt === value
          return (
            <div
              key={opt}
              className="snap-center flex items-center justify-center transition-all duration-150"
              style={{ height: ITEM_H }}
            >
              <span
                className={`transition-all duration-150 ${
                  isSelected
                    ? 'text-2xl font-bold text-[#1e3a5f]'
                    : 'text-base font-medium text-gray-400'
                }`}
              >
                {Number.isInteger(opt) ? opt : opt.toFixed(1)}
              </span>
            </div>
          )
        })}

        {/* 하단 패딩 */}
        <div style={{ height: padding }} />
      </div>
    </div>
  )
}

// ── 이상 입력 모달 ─────────────────────────────────────────────
interface AbnormalModalProps {
  itemLabel: string
  result: InspectionResult
  onSave: (note: string, images: CompressedImage[]) => void
  onCancel: () => void
}

function AbnormalModal({ itemLabel, result, onSave, onCancel }: AbnormalModalProps) {
  const [note, setNote] = useState(result.note ?? '')
  const [images, setImages] = useState<CompressedImage[]>(result.images ?? [])
  const [isCompressing, setIsCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length) return
      if (images.length >= 2) return

      setIsCompressing(true)
      try {
        const remaining = 2 - images.length
        const filesToProcess = files.slice(0, remaining)
        const compressed = await Promise.all(filesToProcess.map(compressImage))
        setImages((prev) => [...prev, ...compressed])
      } finally {
        setIsCompressing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [images.length]
  )

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-8 shadow-2xl max-h-[90dvh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-600" />
            <span className="font-bold text-red-700 text-sm">이상 항목</span>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            aria-label="닫기"
          >
            <XCircle size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 내용 영역 - 스크롤 가능 */}
        <div className="overflow-y-auto pb-4 flex-1">
          <p className="text-sm font-semibold text-gray-800 mb-4 leading-snug">{itemLabel}</p>

          {/* 이상 내용 텍스트 */}
          <label className="block text-xs font-semibold text-gray-600 mb-1">이상 내용 입력</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="이상 내용을 입력하세요"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/40 mb-4"
          />

          {/* 사진 첨부 */}
          <label className="block text-xs font-semibold text-gray-600 mb-2">
            사진 첨부 <span className="text-gray-400 font-normal">(최대 2장, 자동 압축됨)</span>
          </label>
          <div className="flex gap-3 mb-5">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={`첨부 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  aria-label="이미지 삭제"
                >
                  <X size={12} className="text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] text-center py-0.5">
                  {formatFileSize(img.compressedSize)}
                </div>
              </div>
            ))}

            {images.length < 2 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-24 h-24 rounded-none border-2 border-dashed border-gray-400 flex flex-col items-center justify-center gap-1 hover:bg-orange-50 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <ImagePlus size={20} className="text-gray-600" />
                <span className="text-xs text-gray-600">
                  {isCompressing ? '압축 중...' : '사진 추가'}
                </span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={() => onSave(note, images)}
          className="w-full h-12 bg-[#ff6b35] text-white font-bold rounded-none text-sm hover:bg-[#e55a24] transition-colors flex-shrink-0 mt-2"
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ── 완료 판정 헬퍼 ─────────────────────────────────────────────
// 사진 첨부는 전 항목 선택사항 — 서명 제외 모든 항목은 status 선택만으로 완료 인정
function isItemCompleted(item: ChecklistItem, result?: InspectionResult): boolean {
  // skipped 항목은 무조건 완료로 처리 (미운행 원클릭 제출 대응)
  if (result?.status === 'skipped') return true
  // 서명 항목: 서명 이미지가 1장 이상 저장되어 있으면 완료
  if (item.type === 'signature') {
    return (result?.images?.length ?? 0) >= 1
  }
  return result?.status === 'normal' || result?.status === 'abnormal'
}

// ── 서명 패드 (HTML5 Canvas) ───────────────────────────────────
interface SignaturePadProps {
  itemId: string
  savedImage?: CompressedImage
  onSave: (image: CompressedImage) => void
  onClear: () => void
}

function SignaturePad({ itemId, savedImage, onSave, onClear }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [hasStroke, setHasStroke] = useState(false)
  // 저장된 서명이 있으면 편집 모드가 아닌 '저장됨' 상태로 시작
  const [isEditing, setIsEditing] = useState(!savedImage)

  // 캔버스 초기 설정 (고해상도 대응)
  useEffect(() => {
    if (!isEditing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * ratio
    canvas.height = rect.height * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a3a52'
  }, [isEditing])

  // 좌표 계산 (마우스 / 터치 공통)
  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const point = 'touches' in e ? e.touches[0] ?? e.changedTouches[0] : e
    return { x: point.clientX - rect.left, y: point.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    isDrawing.current = true
    lastPoint.current = getPos(e)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx || !lastPoint.current) return
    const pos = getPos(e)
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPoint.current = pos
    if (!hasStroke) setHasStroke(true)
  }

  const endDraw = () => {
    isDrawing.current = false
    lastPoint.current = null
  }

  const handleClear = () => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStroke(false)
    onClear()
  }

  const handleSave = () => {
    const canvas = canvasRef.current
    if (!canvas || !hasStroke) return
    const dataUrl = canvas.toDataURL('image/png')
    const size = Math.round((dataUrl.length * 3) / 4)
    onSave({
      dataUrl,
      fileName: `signature-${itemId}.png`,
      originalSize: size,
      compressedSize: size,
    })
    setIsEditing(false)
  }

  // 저장 완료 상태: 서명 이미지 미리보기 + 다시 서명 버튼
  if (!isEditing && savedImage) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-none border border-gray-300 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={savedImage.dataUrl} alt="저장된 서명" className="w-full h-40 object-contain" />
        </div>
        <button
          onClick={() => { setHasStroke(false); setIsEditing(true) }}
          className="w-full h-11 rounded-none border border-gray-300 bg-gray-50 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors"
        >
          다시 서명하기
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <canvas
        ref={canvasRef}
        className="w-full h-40 rounded-none border-2 border-dashed border-gray-400 bg-white touch-none cursor-crosshair"
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
      />
      <div className="flex gap-2">
        <button
          onClick={handleClear}
          className="flex-1 h-11 rounded-none border border-gray-300 bg-gray-50 text-gray-700 font-bold text-sm hover:bg-gray-100 transition-colors"
        >
          지우기(초기화)
        </button>
        <button
          onClick={handleSave}
          disabled={!hasStroke}
          className={`flex-1 h-11 rounded-none font-bold text-sm text-white transition-colors ${
            hasStroke ? 'bg-[#1a3a52] hover:bg-[#0f2635]' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          서명 저장
        </button>
      </div>
    </div>
  )
}

// ── 필수 사진 첨부 모달 (최소 1장 ~ 최대 2장) ──────────────────
interface PhotoAttachModalProps {
  itemLabel: string
  result: InspectionResult
  onSave: (images: CompressedImage[]) => void
  onCancel: () => void
  isOptional?: boolean
}

function PhotoAttachModal({ itemLabel, result, onSave, onCancel, isOptional }: PhotoAttachModalProps) {
  const [images, setImages] = useState<CompressedImage[]>(result.images ?? [])
  const [isCompressing, setIsCompressing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? [])
      if (!files.length) return
      if (images.length >= 2) return

      setIsCompressing(true)
      try {
        const remaining = 2 - images.length
        const filesToProcess = files.slice(0, remaining)
        const compressed = await Promise.all(filesToProcess.map(compressImage))
        setImages((prev) => [...prev, ...compressed])
      } finally {
        setIsCompressing(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [images.length]
  )

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  const canSave = isOptional ? true : images.length >= 1

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl px-5 pt-5 pb-8 shadow-2xl max-h-[90dvh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-4 border-b border-gray-200 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Camera size={20} className="text-[#1a3a52]" />
            <span className="font-bold text-[#1a3a52] text-sm">
              {isOptional ? '사진 첨부 (선택)' : '필수 사진 첨부'}
            </span>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100"
            aria-label="닫기"
          >
            <XCircle size={18} className="text-gray-500" />
          </button>
        </div>

        {/* 내용 영역 - 스크롤 가능 */}
        <div className="overflow-y-auto pb-4 flex-1">
          <p className="text-sm font-semibold text-gray-800 mb-4 leading-snug">{itemLabel}</p>

          <label className="block text-xs font-semibold text-gray-600 mb-2">
            사진 첨부{' '}
            <span className="text-gray-400 font-normal">
              {isOptional ? '(최대 2장 · 선택사항)' : '(최소 1장, 최대 2장 · 필수)'}
            </span>
          </label>
          <div className="flex gap-3 mb-5">
            {images.map((img, idx) => (
              <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-200 flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.dataUrl} alt={`첨부 사진 ${idx + 1}`} className="w-full h-full object-cover" />
                <button
                  onClick={() => removeImage(idx)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                  aria-label="이미지 삭제"
                >
                  <X size={12} className="text-white" />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[9px] text-center py-0.5">
                  {formatFileSize(img.compressedSize)}
                </div>
              </div>
            ))}

            {images.length < 2 && (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className="w-24 h-24 rounded-none border-2 border-dashed border-gray-400 flex flex-col items-center justify-center gap-1 hover:bg-slate-50 transition-colors disabled:opacity-50 flex-shrink-0"
              >
                <Camera size={20} className="text-gray-600" />
                <span className="text-xs text-gray-600">
                  {isCompressing ? '압축 중...' : '사진 추가'}
                </span>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          {!isOptional && !canSave && (
            <p className="text-xs text-red-600 mb-2">사진을 최소 1장 이상 첨부해야 합니다.</p>
          )}
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={() => canSave && onSave(images)}
          disabled={!canSave}
          className={`w-full h-12 text-white font-bold rounded-none text-sm transition-colors flex-shrink-0 mt-2 ${
            canSave ? 'bg-[#1a3a52] hover:bg-[#0f2635]' : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          저장
        </button>
      </div>
    </div>
  )
}

// ── 메인 점검 화면 ─────────────────────────────────────────────
export default function InspectionScreen({
  results,
  driverName,
  vehicleNumber,
  onUpdateResult,
  onFinish,
  onBack,
  onPartialSave,
}: InspectionScreenProps) {
  const [activeTab, setActiveTab] = useState<CategoryKey>('vehicle')
  const [modalItemId, setModalItemId] = useState<string | null>(null)
  const [photoModalItemId, setPhotoModalItemId] = useState<string | null>(null)

  const currentItems = CHECKLIST_ITEMS.filter((i) => i.categoryKey === activeTab)

  const getTabCompleted = (key: CategoryKey) => {
    const items = CHECKLIST_ITEMS.filter((i) => i.categoryKey === key)
    return items.filter((i) => isItemCompleted(i, results[i.id])).length
  }

  const totalCompleted = CHECKLIST_ITEMS.filter(
    (i) => isItemCompleted(i, results[i.id])
  ).length
  const totalItems = CHECKLIST_ITEMS.length
  const progressPercent = Math.round((totalCompleted / totalItems) * 100)

  const handleStatusClick = (itemId: string, status: 'normal' | 'abnormal') => {
    if (status === 'abnormal') {
      onUpdateResult(itemId, { status: 'abnormal' })
      setModalItemId(itemId)
    } else {
      // '정상' 선택 시 note는 초기화하되, 필수 사진은 유지되도록 images는 건드리지 않음
      onUpdateResult(itemId, { status: 'normal', note: undefined })
    }
  }

  const handlePhotoSave = (images: CompressedImage[]) => {
    if (!photoModalItemId) return
    onUpdateResult(photoModalItemId, { images })
    setPhotoModalItemId(null)
  }

  // 서명 저장: base64 이미지를 images 배열에 담고 status를 normal로 처리 → 완료 인식
  const handleSignatureSave = (itemId: string, image: CompressedImage) => {
    onUpdateResult(itemId, { status: 'normal', images: [image] })
  }

  // 서명 초기화: 이미지 제거 + pending으로 되돌림
  const handleSignatureClear = (itemId: string) => {
    onUpdateResult(itemId, { status: 'pending', images: [] })
  }

  const handleModalSave = (note: string, images: CompressedImage[]) => {
    if (!modalItemId) return
    onUpdateResult(modalItemId, { status: 'abnormal', note, images })
    setModalItemId(null)
  }

  const handleModalCancel = () => {
    if (modalItemId) {
      const current = results[modalItemId]
      if (current?.status === 'abnormal' && !current.note) {
        onUpdateResult(modalItemId, { status: 'pending' })
      }
    }
    setModalItemId(null)
  }

  const isAllDone = totalCompleted === totalItems

  const modalItem = modalItemId
    ? CHECKLIST_ITEMS.find((i) => i.id === modalItemId)
    : null

  const photoModalItem = photoModalItemId
    ? CHECKLIST_ITEMS.find((i) => i.id === photoModalItemId)
    : null

  return (
    <div className="w-full min-h-screen bg-white flex flex-col">
      {/* 상단 헤더 */}
      <header className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-200">
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
        
        {/* 중앙: 제목 + ����업자/차량 정보 */}
        <div className="flex-1 flex flex-col items-center">
          <h1 className="text-lg font-bold text-[#1a3a52] text-center tracking-tight">점검 체크리스트</h1>
          <p className="text-[11px] font-medium text-gray-500 text-center leading-tight mt-0.5">
            {driverName} · {vehicleNumber}
          </p>
        </div>
        
        {/* 우측: 뒤로 가기 */}
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="뒤로 가기"
        >
          <ArrowLeft size={24} className="text-[#1a3a52]" />
        </button>
      </header>

      {/* 진행률 미니바 + 탭 (sticky 고정 영역) */}
      <div className="sticky top-0 z-40 bg-white">
        {/* 진행률 미니바 */}
        <div className="px-4 pt-2 pb-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-600 font-medium">{totalCompleted} / {totalItems} 항목 완료</span>
            <span className="text-xs font-bold text-[#ff6b35]">{progressPercent}%</span>
          </div>
          <div className="h-1.5 bg-gray-300 rounded-none overflow-hidden">
            <div
              className="h-full bg-[#ff6b35] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* 탭 (차량 → 작업 → 탱크) */}
        <div className="flex gap-2.5 px-4 py-3">
          {CATEGORIES.map((cat) => {
            const completed = getTabCompleted(cat.key)
            const total = CATEGORY_COUNT[cat.key]
            const isActive = activeTab === cat.key
            const isAllTabDone = completed === total

            // 탭별 컬러 테마
            const theme = {
              vehicle: {
                activeBg: 'bg-[#ff6b35]',
                activeText: 'text-white',
                inactiveBg: 'bg-orange-50',
                inactiveText: 'text-[#1a3a52]',
                inactiveBorder: 'border-orange-300',
                inactiveShadow: 'border-b-2 border-b-orange-400',
                doneText: 'text-orange-100',
                inactiveDoneText: 'text-orange-600',
              },
              work: {
                activeBg: 'bg-[#1a3a52]',
                activeText: 'text-white',
                inactiveBg: 'bg-slate-100',
                inactiveText: 'text-[#1a3a52]',
                inactiveBorder: 'border-slate-300',
                inactiveShadow: 'border-b-2 border-b-slate-400',
                doneText: 'text-slate-200',
                inactiveDoneText: 'text-slate-600',
              },
              etc: {
                activeBg: 'bg-[#5a8fae]',
                activeText: 'text-white',
                inactiveBg: 'bg-slate-50',
                inactiveText: 'text-[#1a3a52]',
                inactiveBorder: 'border-slate-300',
                inactiveShadow: 'border-b-2 border-b-slate-400',
                doneText: 'text-slate-100',
                inactiveDoneText: 'text-slate-500',
              },
              sign: {
                activeBg: 'bg-[#3d6b8f]',
                activeText: 'text-white',
                inactiveBg: 'bg-orange-50',
                inactiveText: 'text-[#1a3a52]',
                inactiveBorder: 'border-orange-300',
                inactiveShadow: 'border-b-2 border-b-orange-400',
                doneText: 'text-orange-100',
                inactiveDoneText: 'text-orange-600',
              },
            } as const

            const t = theme[cat.key]

            return (
              <button
                key={cat.key}
                onClick={() => setActiveTab(cat.key)}
                className={`
                  flex-1 flex flex-col items-center py-2.5 px-1 rounded-none
                  font-bold text-xs gap-0.5 select-none
                  transition-all duration-150 ease-in-out
                  border
                  ${isActive
                    ? `${t.activeBg} ${t.activeText} border-transparent shadow-md translate-y-0.5`
                    : `${t.inactiveBg} ${t.inactiveText} ${t.inactiveBorder} ${t.inactiveShadow} hover:brightness-98 active:translate-y-0.5 active:border-b`
                  }
                `}
              >
                <span>{cat.label}</span>
                <span className={`text-[10px] font-semibold ${
                  isActive
                    ? (isAllTabDone ? t.doneText : 'text-white/75')
                    : (isAllTabDone ? t.inactiveDoneText : 'text-gray-500')
                }`}>
                  {completed}/{total}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* 항목 리스트 */}
      <main className="flex-1 px-4 pt-3 pb-32 overflow-y-auto">
        <div className="flex flex-col gap-3">
          {currentItems.map((item) => {
            const result = results[item.id]
            // 'skipped' 항목은 normal/abnormal 어느 쪽도 아닌 것으로 처리 (방어 코드)
            const isNormal = result?.status === 'normal'
            const isAbnormal = result?.status === 'abnormal'

            return (
              <div
                key={item.id}
                className="bg-white rounded-none border border-gray-200 overflow-hidden"
              >
                {/* 항목 헤더 */}
                <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-gray-200">
                  <span
                    className={`w-7 h-7 rounded-none flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      isAbnormal
                        ? 'bg-red-600 text-white'
                        : isNormal
                        ? 'bg-[#1a3a52] text-white'
                        : 'bg-gray-300 text-gray-700'
                    }`}
                  >
                    {item.order}
                  </span>
                  <p className="text-sm font-medium text-gray-800 leading-snug flex-1">
                    {item.label}
                  </p>

                  {/* binary / requiresPhoto 항목: 우측 끝 사진기 아이콘 (미첨부=회색, 1장 이상 첨부=초록) */}
                  {(item.type === 'binary' || item.requiresPhoto) && (
                    <button
                      onClick={() => setPhotoModalItemId(item.id)}
                      className="flex-shrink-0 w-9 h-9 flex items-center justify-center rounded-none border border-gray-200 hover:bg-gray-50 transition-colors relative"
                      aria-label="사진 첨부 (선택)"
                      title="사진 첨부 (선택)"
                    >
                      <Camera
                        size={20}
                        className={
                          (result?.images?.length ?? 0) > 0
                            ? 'text-green-600'
                            : 'text-gray-300'
                        }
                      />
                    </button>
                  )}
                </div>

                {/* 버튼 영역 */}
                <div className="px-4 pb-4">
                  {item.type === 'binary' ? (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleStatusClick(item.id, 'normal')}
                        className={`flex-1 h-11 rounded-none font-bold text-sm transition-colors border ${
                          isNormal
                            ? 'bg-[#1a3a52] text-white border-[#1a3a52] shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {item.customLabels?.[0] ?? '양호'}
                      </button>
                      <button
                        onClick={() => handleStatusClick(item.id, 'abnormal')}
                        className={`flex-1 h-11 rounded-none font-bold text-sm transition-colors border ${
                          isAbnormal
                            ? 'bg-red-600 text-white border-red-600 shadow-sm'
                            : 'bg-gray-50 text-gray-700 border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {item.customLabels?.[1] ?? '불량'}
                      </button>
                    </div>
                  ) : item.type === 'signature' ? (
                    // 서명 패드 (Canvas)
                    <SignaturePad
                      itemId={item.id}
                      savedImage={result?.images?.[0]}
                      onSave={(image) => handleSignatureSave(item.id, image)}
                      onClear={() => handleSignatureClear(item.id)}
                    />
                  ) : (
                    // 수면 시간 — iOS 스타일 휠 픽커
                    <div className="flex items-center gap-3 px-1">
                      <WheelPicker
                        value={result?.numberValue ?? 4}
                        onChange={(v) =>
                          onUpdateResult(item.id, {
                            status: 'normal',
                            numberValue: v,
                          })
                        }
                      />
                      <span className="text-sm font-medium text-gray-500 flex-shrink-0">{item.unit}</span>
                    </div>
                  )}
                </div>

                {/* 이상 입력 내용 미리보기 */}
                {isAbnormal && (result.note || (result.images && result.images.length > 0)) && (
                  <div
                    className="mx-4 mb-4 bg-red-50 border border-red-100 rounded-xl px-3 py-2 cursor-pointer"
                    onClick={() => setModalItemId(item.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setModalItemId(item.id)}
                    aria-label="이상 내용 수정"
                  >
                    {result.note && (
                      <p className="text-xs text-red-700 truncate">{result.note}</p>
                    )}
                    {result.images && result.images.length > 0 && (
                      <div className="flex gap-2 mt-1.5">
                        {result.images.map((img, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={idx}
                            src={img.dataUrl}
                            alt={`이상 사진 ${idx + 1}`}
                            className="w-14 h-14 object-cover rounded-lg border border-red-200"
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
      </main>

      {/* 하단 고정 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-6 pt-3 bg-white border-t border-gray-200">
        <div className="flex gap-2">
          <button
            onClick={onFinish}
            disabled={!isAllDone}
            className={`flex-1 h-14 text-white text-lg font-bold rounded-none shadow-md transition-colors ${
              isAllDone ? 'bg-[#1a3a52] hover:bg-[#0f2635] active:bg-[#081a28]' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            {isAllDone ? '점검 완료 → 최종 확인' : `${totalItems - totalCompleted}개 항목 미완료`}
          </button>
          <button
            onClick={onPartialSave}
            className="w-24 h-14 bg-gray-100 text-gray-700 font-bold text-sm rounded-none border border-gray-300 hover:bg-gray-200 transition-colors flex-shrink-0"
          >
            임시저장
          </button>
        </div>
      </div>

      {/* 이상 입력 모달 */}
      {modalItem && (
        <AbnormalModal
          itemLabel={modalItem.label}
          result={results[modalItem.id]}
          onSave={handleModalSave}
          onCancel={handleModalCancel}
        />
      )}

      {/* 필수 사진 첨부 모달 */}
      {photoModalItem && (
        <PhotoAttachModal
          itemLabel={photoModalItem.label}
          result={results[photoModalItem.id]}
          onSave={handlePhotoSave}
          onCancel={() => setPhotoModalItemId(null)}
          isOptional={true}
        />
      )}
    </div>
  )
}

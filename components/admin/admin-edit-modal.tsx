'use client'

import { useEffect, useState } from 'react'
import { X, Plus, Loader2, ImageOff } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'
import { CHECKLIST_ITEMS } from '@/lib/checklist-data'
import { compressImage, dataUrlToBlob } from '@/lib/compress-image'

const STORAGE_BUCKET = 'universal-driving-check-images'
const ORDERED_ITEMS = CHECKLIST_ITEMS

// ─────────────────────────────────────────
// 타입 (inspection-table.tsx와 동일 구조)
// ─────────────────────────────────────────
export interface InspectionItemRow {
  item_id: string
  status: 'normal' | 'abnormal' | 'pending'
  note: string | null
  image_urls: string[] | null
}

export interface InspectionRow {
  id: string
  driver_name: string | null
  vehicle_number: string | null
  inspected_at: string
  admin_note?: string | null
  universal_driving_check_inspection_items: InspectionItemRow[]
}

interface AdminEditModalProps {
  row: InspectionRow
  onClose: () => void
  onSaved: () => void
}

// ─────────────────────────────────────────
// 편집용 항목 상태
//  - existingUrls: 기존에 저장돼 있던 사진 URL (유지할 것들만 남김)
//  - newImages: 이번에 새로 첨부한 압축 이미지 (data URL)
// ─────────────────────────────────────────
interface EditableItem {
  item_id: string
  status: 'normal' | 'abnormal' | 'pending'
  note: string
  existingUrls: string[]
  newImages: { dataUrl: string; fileName: string }[]
}

export function AdminEditModal({ row, onClose, onSaved }: AdminEditModalProps) {
  // 항목별 편집 상태 초기화 (CHECKLIST_ITEMS 순서 기준)
  const [items, setItems] = useState<EditableItem[]>(() => {
    const map = new Map<string, InspectionItemRow>()
    ;(row.universal_driving_check_inspection_items ?? []).forEach((it) => map.set(it.item_id, it))
    return ORDERED_ITEMS.map((def) => {
      const it = map.get(def.id)
      return {
        item_id: def.id,
        status: it?.status ?? 'pending',
        note: it?.note ?? '',
        existingUrls: it?.image_urls ?? [],
        newImages: [],
      }
    })
  })

  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // ESC 닫기 + 스크롤 잠금
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  // ── 상태 토글 (정상 ↔ 이상) ──
  const toggleStatus = (itemId: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.item_id === itemId
          ? { ...it, status: it.status === 'normal' ? 'abnormal' : 'normal' }
          : it,
      ),
    )
  }

  // ── 비고(사유) 수정 ──
  const updateNote = (itemId: string, note: string) => {
    setItems((prev) => prev.map((it) => (it.item_id === itemId ? { ...it, note } : it)))
  }

  // ── 기존 사진 삭제 (해당 URL을 유지 목록에서 제거) ──
  const removeExistingUrl = (itemId: string, url: string) => {
    setItems((prev) =>
      prev.map((it) =>
        it.item_id === itemId
          ? { ...it, existingUrls: it.existingUrls.filter((u) => u !== url) }
          : it,
      ),
    )
  }

  // ── 새로 첨부한 사진 삭제 ──
  const removeNewImage = (itemId: string, index: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.item_id === itemId
          ? { ...it, newImages: it.newImages.filter((_, i) => i !== index) }
          : it,
      ),
    )
  }

  // ── 새 사진 첨부 (compressImage 적용) ──
  const handleAttach = async (itemId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    setSaveError(null)
    try {
      const compressed = await Promise.all(
        Array.from(fileList).map(async (file) => {
          const c = await compressImage(file)
          return { dataUrl: c.dataUrl, fileName: c.fileName }
        }),
      )
      setItems((prev) =>
        prev.map((it) =>
          it.item_id === itemId
            ? { ...it, newImages: [...it.newImages, ...compressed] }
            : it,
        ),
      )
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '이미지 압축에 실패했습니다.')
    }
  }

  // ── 저장 ──
  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const supabase = createClient()

      for (const it of items) {
        const uploadedUrls: string[] = []

        // 새로 첨부한 사진을 Storage에 업로드 (기존 파일과 충돌 방지를 위해 timestamp 접미사)
        for (let i = 0; i < it.newImages.length; i++) {
          const img = it.newImages[i]
          const blob = dataUrlToBlob(img.dataUrl)
          const filePath = `${row.id}/${it.item_id}_edit_${Date.now()}_${i + 1}.jpg`

          const { error: uploadError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

          if (uploadError) {
            throw new Error('이미지 업로드에 실패했습니다: ' + uploadError.message)
          }

          const { data: publicUrl } = supabase.storage
            .from(STORAGE_BUCKET)
            .getPublicUrl(filePath)
          uploadedUrls.push(publicUrl.publicUrl)
        }

        // 유지할 기존 URL + 새 업로드 URL 병합
        const finalUrls = [...it.existingUrls, ...uploadedUrls]

        const { error: updateError } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspection_items')
          .update({
            status: it.status,
            note: it.note.trim() === '' ? null : it.note.trim(),
            image_urls: finalUrls.length > 0 ? finalUrls : null,
          })
          .eq('inspection_id', row.id)
          .eq('item_id', it.item_id)

        if (updateError) {
          throw new Error(updateError.message)
        }
      }

      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="점검 내역 수정"
    >
      <div
        className="relative flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 헤더 ── */}
        <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">점검 내역 수정</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {formatDate(row.inspected_at)} · {row.driver_name ?? '-'} · {row.vehicle_number ?? '-'}
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

        {/* ── 항목 리스트 ── */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="flex flex-col gap-3">
            {ORDERED_ITEMS.map((def) => {
              const it = items.find((x) => x.item_id === def.id)
              if (!it) return null

              const normalLabel = def.customLabels?.[0] ?? '정상'
              const abnormalLabel = def.customLabels?.[1] ?? '이상'
              const isSignature = def.type === 'signature'
              const isNormal = it.status === 'normal'

              return (
                <div
                  key={def.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-800">
                      {def.order}. {def.label}
                    </span>

                    {/* 상태 토글 (서명 항목 제외) */}
                    {!isSignature && (
                      <button
                        type="button"
                        onClick={() => toggleStatus(def.id)}
                        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                          isNormal
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            : it.status === 'abnormal'
                              ? 'bg-red-100 text-red-700 hover:bg-red-200'
                              : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                        }`}
                        title="상태 변경"
                      >
                        {it.status === 'pending'
                          ? '미입력 (클릭하여 변경)'
                          : isNormal
                            ? normalLabel
                            : abnormalLabel}
                      </button>
                    )}
                  </div>

                  {/* 이상 시 사유 입력 */}
                  {!isSignature && it.status === 'abnormal' && (
                    <input
                      type="text"
                      value={it.note}
                      onChange={(e) => updateNote(def.id, e.target.value)}
                      placeholder="사유를 입력하세요..."
                      className="mt-3 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors"
                    />
                  )}

                  {/* ── 사진 영역 ── */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {/* 기존 사진 */}
                    {it.existingUrls.map((url) => (
                      <div key={url} className="relative h-16 w-16 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url || '/placeholder.svg'}
                          alt="점검 사진"
                          className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                          crossOrigin="anonymous"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingUrl(def.id, url)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                          aria-label="사진 삭제"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* 새로 첨부한 사진 */}
                    {it.newImages.map((img, i) => (
                      <div key={`new-${i}`} className="relative h-16 w-16 shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={img.dataUrl || '/placeholder.svg'}
                          alt="새 점검 사진"
                          className="h-16 w-16 rounded-lg border-2 border-[#1e3a5f] object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(def.id, i)}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow transition-colors hover:bg-red-600"
                          aria-label="사진 삭제"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}

                    {/* 사진 첨부 버튼 */}
                    <label className="flex h-16 w-16 shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 transition-colors hover:border-[#1e3a5f] hover:text-[#1e3a5f]">
                      <Plus size={16} />
                      <span className="text-[10px] font-medium">첨부</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleAttach(def.id, e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>

                    {it.existingUrls.length === 0 && it.newImages.length === 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                        <ImageOff size={12} />
                        첨부된 사진 없음
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 푸터 ── */}
        <div className="border-t border-slate-200 px-6 py-4">
          {saveError && <p className="mb-2 text-xs text-red-500">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] disabled:opacity-60 active:bg-[#0f2035]"
            >
              {saving && <Loader2 size={15} className="animate-spin" />}
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

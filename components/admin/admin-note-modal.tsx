'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface AdminNoteModalProps {
  rowId: string
  initialNote: string | null
  onClose: () => void
  onSaved: () => void
}

export function AdminNoteModal({
  rowId,
  initialNote,
  onClose,
  onSaved,
}: AdminNoteModalProps) {
  const [note, setNote] = useState(initialNote ?? '')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // 열릴 때 textarea 포커스 + ESC 닫기 + 스크롤 잠금
  useEffect(() => {
    textareaRef.current?.focus()
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

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const supabase = createClient()
      const { error } = await supabase
        .schema('driver-checklist')
        .from('universal_driving_check_inspections')
        .update({ admin_note: note.trim() === '' ? null : note.trim() })
        .eq('id', rowId)

      if (error) throw new Error(error.message)

      onSaved()
      onClose()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : '저장 중 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="관리자 비고 입력"
    >
      <div
        className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">관리자 비고</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            <X size={18} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="메모를 입력하세요..."
          rows={5}
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-[#1e3a5f] focus:ring-2 focus:ring-[#1e3a5f]/20 transition-colors"
        />

        {/* 에러 메시지 */}
        {saveError && (
          <p className="mt-2 text-xs text-red-500">{saveError}</p>
        )}

        {/* 버튼 */}
        <div className="mt-4 flex justify-end gap-2">
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
            className="rounded-lg bg-[#1e3a5f] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#162d4a] disabled:opacity-60 active:bg-[#0f2035]"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

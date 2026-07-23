'use client'

import { useState, useCallback, useEffect } from 'react'
import { Loader } from 'lucide-react'
import { createInitialResults, CHECKLIST_ITEMS, type InspectionResult, type CompressedImage } from '@/lib/checklist-data'
import { dataUrlToBlob } from '@/lib/compress-image'
import { createClient } from '@/utils/supabase/client'
import StartScreen from '@/components/checklist/start-screen'
import InspectionScreen from '@/components/checklist/inspection-screen'
import SummaryScreen from '@/components/checklist/summary-screen'

type Step = 'start' | 'inspection' | 'summary'

export default function ChecklistPage() {
  const [step, setStep] = useState<Step>('start')
  const [results, setResults] = useState<Record<string, InspectionResult>>(createInitialResults)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isLoadingEdit, setIsLoadingEdit] = useState(false)
  const [pendingSkipSubmit, setPendingSkipSubmit] = useState(false)

  // ── 사용자/차량 매칭 상태 ──
  const [driverName, setDriverName] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [userLevel, setUserLevel] = useState<number | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // ── 마운트 시 세션·권한·차량 매칭 검증 ──
  useEffect(() => {
    let cancelled = false

    const init = async () => {
      try {
        const supabase = createClient()

        // 1) 현재 세션 유저
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          // 세션이 없으면 미들웨어가 로그인으로 보내주므로 대기 상태 유지
          return
        }

        // 2) 사용자 등급 및 역할 조회
        let userLevel: number | null = null
        let userRole: string | null = null
        try {
          const res = await fetch('/api/v1/users/me')
          if (res.ok) {
            const json = await res.json()
            userLevel = json.userLevel ? Number(json.userLevel) : null
            userRole = json.userRole ?? null
          }
        } catch {
          // 조회 실패는 일반 사용자로 간주
        }

        if (!cancelled) setUserLevel(userLevel)

        // 3) 차량 매칭 조회 (driver_id 가 유저 id 또는 이메일과 일치)
        const orFilters = [`driver_id.eq.${user.id}`]
        if (user.email) orFilters.push(`driver_id.eq.${user.email}`)

        const { data: vehicle } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_vehicles')
          .select('driver_name, vehicle_number')
          .or(orFilters.join(','))
          .limit(1)
          .maybeSingle()

        if (cancelled) return

        const fallbackName =
          (user.user_metadata?.name as string | undefined) ??
          (user.user_metadata?.full_name as string | undefined) ??
          user.email ??
          '사용자'

        // ── 핵심 로직 분기 ──
        const isManager = userRole === 'admin' || userLevel === 1 || userLevel === 2
        if (isManager) {
          // 관리자/운영자: 차량 매칭 없어도 무조건 통과
          setDriverName(vehicle?.driver_name ?? fallbackName)
          setVehicleNumber(vehicle?.vehicle_number ?? '관리자')
          setIsInitializing(false)
          return
        }

        if (!vehicle) {
          // 일반 사용자 & 매칭 차량 없음 → 안내 페이지로 이동
          window.location.href = '/unassigned'
          return
        }

        // 차량 정상 매칭
        setDriverName(vehicle.driver_name ?? fallbackName)
        setVehicleNumber(vehicle.vehicle_number)
        setIsInitializing(false)
      } catch (err) {
        console.error('[checklist] 초기화 검증 오류:', err)
        if (!cancelled) window.location.href = '/unassigned'
      }
    }

    init()

    return () => {
      cancelled = true
    }
  }, [])

  // ── 단일 항목 결과 업데이트 ──
  const handleUpdateResult = useCallback(
    (itemId: string, update: Partial<InspectionResult>) => {
      setResults((prev) => ({
        ...prev,
        [itemId]: { ...prev[itemId], ...update },
      }))
    },
    []
  )

  // ── 수동으로 작업자/차량번호 변경 (관리자 대리 점검) ──
  const handleVehicleChange = (dName: string, vNum: string) => {
    setDriverName(dName)
    setVehicleNumber(vNum)
  }

  // ── 신규 점검 시작 ──
  const handleStart = useCallback(() => {
    setEditingId(null)
    setResults(createInitialResults())
    setStep('inspection')
  }, [])

  // ── 금일 미운행 원클릭 제출 ──
  const handleSkipToday = useCallback(async (existingId?: string | null) => {
    const confirmed = window.confirm('오늘 차량 미운행으로 기록하시겠습니까?\n(기존 점검 기록이 있다면 미운행으로 덮어씁니다.)')
    if (!confirmed) return

    const skippedResults: Record<string, InspectionResult> = {}
    for (const item of CHECKLIST_ITEMS) {
      if (item.id === 's1') {
        // 조치 여부: '없음' 표시를 위해 normal로 설정
        skippedResults[item.id] = { itemId: item.id, status: 'normal' }
      } else if (item.id === 's2') {
        // 서명: 이미지 대체 불가 → skipped + note로 텍스트 우회
        skippedResults[item.id] = { itemId: item.id, status: 'skipped', note: '-' }
      } else {
        skippedResults[item.id] = { itemId: item.id, status: 'skipped' }
      }
    }

    if (existingId) {
      setEditingId(existingId)
    } else {
      setEditingId(null)
    }

    setResults(skippedResults)
    setPendingSkipSubmit(true)
  }, [])

  // ── 오늘 작성한 기록 불러와 수정 모드 진입 ──
  const handleEdit = useCallback(async (inspectionId: string) => {
    setIsLoadingEdit(true)
    try {
      const supabase = createClient()

      const { data: items, error: itemsError } = await supabase
        .schema('driver-checklist')
          .from('universal_driving_check_inspection_items')
        .select('item_id, status, number_value, note, image_urls')
        .eq('inspection_id', inspectionId)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      const loaded = createInitialResults()
      for (const row of items ?? []) {
        const itemId: string = row.item_id
        if (!loaded[itemId]) continue
        const images: CompressedImage[] = Array.isArray(row.image_urls)
          ? row.image_urls.map((url: string, idx: number) => ({
              dataUrl: url,
              fileName: `existing_${idx + 1}.jpg`,
              originalSize: 0,
              compressedSize: 0,
            }))
          : []

        loaded[itemId] = {
          itemId,
          status: (row.status as InspectionResult['status']) ?? 'pending',
          numberValue: row.number_value ?? undefined,
          note: row.note ?? undefined,
          images: images.length > 0 ? images : undefined,
        }
      }

      setResults(loaded)
      setEditingId(inspectionId)
      setStep('inspection')
    } catch (err) {
      console.error('[checklist] 수정 데이터 불러오기 오류:', err)
      alert('기존 점검 데이터를 불러오지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setIsLoadingEdit(false)
    }
  }, [])

  // ── 미운행 플래그 감지 → 자동 제출 ──
  useEffect(() => {
    if (!pendingSkipSubmit) return
    setPendingSkipSubmit(false)
    handleSubmitWithResults(results, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingSkipSubmit])

  // ── Supabase 제출 (신규 INSERT / 수정 UPDATE 분기) ──
  const handleSubmit = async () => {
    await handleSubmitWithResults(results)
  }

  const handleSubmitWithResults = async (currentResults: Record<string, InspectionResult>, isSkipMode = false) => {
    setIsSubmitting(true)
    try {
      const supabase = createClient()
      const isEditing = editingId !== null
      let inspectionId: string

      if (isEditing) {
        inspectionId = editingId as string

        const { error: updateError } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspections')
          .update({
            driver_name: driverName,
            vehicle_number: vehicleNumber,
            inspected_at: new Date().toISOString(),
          })
          .eq('id', inspectionId)

        if (updateError) {
          throw new Error('점검 마스터 수정 실패: ' + updateError.message)
        }

        const { error: deleteError } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspection_items')
          .delete()
          .eq('inspection_id', inspectionId)

        if (deleteError) {
          throw new Error('기존 점검 항목 삭제 실패: ' + deleteError.message)
        }
      } else {
        const { data: inspection, error: inspectionError } = await supabase
          .schema('driver-checklist')
          .from('universal_driving_check_inspections')
          .insert({
            driver_name: driverName,
            vehicle_number: vehicleNumber,
            inspected_at: new Date().toISOString(),
          })
          .select('id')
          .single()

        if (inspectionError || !inspection) {
          throw new Error(inspectionError?.message ?? '점검 마스터 저장 실패')
        }

        inspectionId = inspection.id
      }

      const itemRows: object[] = []

      for (const [itemId, result] of Object.entries(currentResults)) {
        const imageUrls: string[] = []

        // skipped 항목은 이미지 업로드를 건너뜀 (서명 이미지 필수 검증 우회)
        if (result.status !== 'skipped' && result.images && result.images.length > 0) {
          for (let i = 0; i < result.images.length; i++) {
            const img = result.images[i]

            if (!img.dataUrl.startsWith('data:')) {
              imageUrls.push(img.dataUrl)
              continue
            }

            const blob = dataUrlToBlob(img.dataUrl)
            const filePath = `${inspectionId}/${itemId}_${i + 1}.jpg`

            const { error: uploadError } = await supabase.storage
              .from('universal-driving-check-images')
              .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true })

            if (uploadError) {
              throw new Error('이미지 업로드에 실패했습니다: ' + uploadError.message)
            }

            const { data: publicUrl } = supabase.storage
              .from('universal-driving-check-images')
              .getPublicUrl(filePath)
            imageUrls.push(publicUrl.publicUrl)
          }
        }

        itemRows.push({
          inspection_id: inspectionId,
          item_id: itemId,
          status: result.status,
          number_value: result.numberValue ?? null,
          note: result.note ?? null,
          image_urls: imageUrls.length > 0 ? imageUrls : null,
        })
      }

      const { error: itemsError } = await supabase
        .schema('driver-checklist')
          .from('universal_driving_check_inspection_items')
        .insert(itemRows)

      if (itemsError) {
        throw new Error(itemsError.message)
      }

      if (isSkipMode) {
        alert('미운행 처리가 완료되었습니다.')
        window.location.reload()
        return
      }
      alert(isEditing ? '점검일지가 수정되었습니다.' : '점검일지가 저장되었습니다.')
      setResults(createInitialResults())
      setEditingId(null)
      setStep('start')
    } catch (err) {
      const message = err instanceof Error ? err.message : '제출 중 오류가 발생했습니다.'
      alert(message + '\n다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── 초기화(검증) 중: 로딩 스피너 ──
  if (isInitializing) {
    return (
      <div className="w-full min-h-screen bg-white flex flex-col items-center justify-center gap-4">
        <Loader size={40} className="animate-spin text-[#ff6b35]" />
        <p className="text-sm font-medium text-gray-600">사용자 정보를 확인하는 중입니다...</p>
      </div>
    )
  }

  // ── 화면 렌더링 ──
  if (step === 'start') {
    return (
      <StartScreen
        results={results}
        driverName={driverName}
        vehicleNumber={vehicleNumber}
        userLevel={userLevel}
        onVehicleChange={handleVehicleChange}
        onStart={handleStart}
        onEdit={handleEdit}
        onSkipToday={handleSkipToday}
        isLoadingEdit={isLoadingEdit}
      />
    )
  }

  if (step === 'inspection') {
    return (
      <InspectionScreen
        results={results}
        driverName={driverName}
        vehicleNumber={vehicleNumber}
        onUpdateResult={handleUpdateResult}
        onFinish={() => setStep('summary')}
        onBack={() => setStep('start')}
      />
    )
  }

  return (
    <SummaryScreen
      results={results}
      driverName={driverName}
      vehicleNumber={vehicleNumber}
      onBack={() => setStep('inspection')}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
    />
  )
}

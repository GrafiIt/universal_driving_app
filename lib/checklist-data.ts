// 점검 카테고리 타입
export type CategoryKey = 'vehicle' | 'work' | 'etc' | 'sign'

// 개별 점검 항목 타입
export interface ChecklistItem {
  id: string
  categoryKey: CategoryKey
  order: number
  label: string
  type: 'binary' | 'number' | 'signature' // binary: 정상/이상, number: 숫자 입력, signature: 서명 패드
  unit?: string // 숫자 입력일 때 단위 (예: "시간")
  requiresPhoto?: boolean // true면 사진 최소 1장 첨부해야 완료로 인정
  // 화면 표시용 커스텀 라벨 (DB status값은 그대로 'normal'/'abnormal' 유지)
  // 인덱스 0: status === 'normal'일 때 표시할 텍스트
  // 인덱스 1: status === 'abnormal'일 때 표시할 텍스트
  customLabels?: [string, string]
}

// 카테고리 메타 정보
export interface Category {
  key: CategoryKey
  label: string
  icon: string
  color: string
}

// 점검 결과 타입 (단일 항목)
export interface InspectionResult {
  itemId: string
  status: 'normal' | 'abnormal' | 'pending' // 정상 | 이상 | 미선택
  numberValue?: number // 숫자 입력 항목
  note?: string // 이상 시 메모
  images?: CompressedImage[] // 압축된 이미지 (최대 2장)
}

export interface CompressedImage {
  dataUrl: string // base64 data URL (압축 후)
  fileName: string
  originalSize: number // bytes
  compressedSize: number // bytes
}

// ────────────────────────────────────────
// 카테고리 목록 (탭 순서: 외관 → 상태 → 기타 → 서명)
// ────────────────────────────────────────
export const CATEGORIES: Category[] = [
  { key: 'vehicle', label: '외관점검',    icon: '🚛', color: '#1e3a5f' },
  { key: 'work',    label: '상태점검',    icon: '📋', color: '#1e3a5f' },
  { key: 'etc',     label: '기타',        icon: '📦', color: '#1e3a5f' },
  { key: 'sign',    label: '조치 및 서명', icon: '✍️', color: '#1e3a5f' },
]

// ────────────────────────────────────────
// 13개 점검 항목 (외관 4 + 상태 3 + 기타 4 + 조치 및 서명 2)
// ────────────────────────────────────────
export const CHECKLIST_ITEMS: ChecklistItem[] = [
  // ── 외관점검 (4항목) ──
  {
    id: 'v1',
    categoryKey: 'vehicle',
    order: 1,
    label: '번호판, 전면유리, 후사경 등의 청결상태',
    type: 'binary',
  },
  {
    id: 'v2',
    categoryKey: 'vehicle',
    order: 2,
    label: '후미등, 차폭등 등 등화장치 작동상태',
    type: 'binary',
  },
  {
    id: 'v3',
    categoryKey: 'vehicle',
    order: 3,
    label: '창닦이기 작동상태',
    type: 'binary',
  },
  {
    id: 'v4',
    categoryKey: 'vehicle',
    order: 4,
    label: '적재함(보조지지대 포함), 측면 보호대, 후부반사판, 트레일러 연결장치의 부착상태 및 훼손 여부',
    type: 'binary',
  },

  // ── 상태점검 (3항목) ──
  {
    id: 'w1',
    categoryKey: 'work',
    order: 1,
    label: '타이어 손상 및 마모(1.6mm이상) 여부',
    type: 'binary',
  },
  {
    id: 'w2',
    categoryKey: 'work',
    order: 2,
    label: '화물, 적재함 지지대(판스프링) 등의 고정상태',
    type: 'binary',
  },
  {
    id: 'w3',
    categoryKey: 'work',
    order: 3,
    label: '바퀴 너트 등 균열 여부',
    type: 'binary',
  },

  // ── 기타 (4항목) ──
  {
    id: 'e1',
    categoryKey: 'etc',
    order: 1,
    label: '냉각수, 공기압, 엔진오일 등 차량 이상 여부(계기판 확인)',
    type: 'binary',
  },
  {
    id: 'e2',
    categoryKey: 'etc',
    order: 2,
    label: '좌석안전띠 상태',
    type: 'binary',
  },
  {
    id: 'e3',
    categoryKey: 'etc',
    order: 3,
    label: '소화기 비치 여부',
    type: 'binary',
  },
  {
    id: 'e4',
    categoryKey: 'etc',
    order: 4,
    label: '안전삼각대 등 비치 여부',
    type: 'binary',
  },

  // ── 조치 및 서명 (2항목) ──
  {
    id: 's1',
    categoryKey: 'sign',
    order: 1,
    label: '불량상태 조치(개선) 여부',
    type: 'binary',
    customLabels: ['없음', '있음'],
  },
  {
    id: 's2',
    categoryKey: 'sign',
    order: 2,
    label: '서명',
    type: 'signature',
    requiresPhoto: true,
  },
]

// 카테고리별 항목 수
export const CATEGORY_COUNT: Record<CategoryKey, number> = {
  vehicle: CHECKLIST_ITEMS.filter((i) => i.categoryKey === 'vehicle').length, // 4
  work:    CHECKLIST_ITEMS.filter((i) => i.categoryKey === 'work').length,    // 3
  etc:     CHECKLIST_ITEMS.filter((i) => i.categoryKey === 'etc').length,     // 4
  sign:    CHECKLIST_ITEMS.filter((i) => i.categoryKey === 'sign').length,    // 2
}

// 초기 결과 맵 생성
export function createInitialResults(): Record<string, InspectionResult> {
  return Object.fromEntries(
    CHECKLIST_ITEMS.map((item) => [
      item.id,
      { itemId: item.id, status: 'pending' as const },
    ])
  )
}

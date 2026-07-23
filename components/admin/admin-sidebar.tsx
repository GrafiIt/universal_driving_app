'use client'

import { Car, ClipboardCheck, PanelLeftClose, PanelLeftOpen, Shield, type LucideIcon } from 'lucide-react'

export type AdminMenuKey = 'checklist' | 'vehicles' | 'permissions'

interface AdminMenuItem {
  key: AdminMenuKey
  label: string
  icon: LucideIcon
}

// 추후 메뉴 확장을 위해 배열로 관리
const MENU_ITEMS: AdminMenuItem[] = [
  { key: 'checklist', label: '일일점검 체크리스트', icon: ClipboardCheck },
  { key: 'vehicles', label: '차량 및 기사 관리', icon: Car },
  { key: 'permissions', label: '권한 관리', icon: Shield },
]

interface AdminSidebarProps {
  active: AdminMenuKey
  onSelect: (key: AdminMenuKey) => void
  isCollapsed: boolean
  onToggleCollapse: () => void
}

export function AdminSidebar({ active, onSelect, isCollapsed, onToggleCollapse }: AdminSidebarProps) {
  return (
    <aside
      className={`flex flex-col border-r border-slate-700 bg-slate-900 transition-all duration-300 ease-in-out flex-shrink-0 ${
        isCollapsed ? 'w-16' : 'w-[220px]'
      }`}
    >
      {/* 로고 / 타이틀 + 토글 버튼 */}
      <div className="flex h-20 items-center border-b border-slate-800 px-3 justify-between overflow-hidden">
        {!isCollapsed && (
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap truncate">
            관리자 페이지
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className={`flex items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white flex-shrink-0 ${
            isCollapsed ? 'mx-auto' : 'ml-auto'
          }`}
          title={isCollapsed ? '사이드바 열기' : '사이드바 닫기'}
        >
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* 메뉴 목록 */}
      <nav className="flex flex-1 flex-col gap-2 p-2">
        {MENU_ITEMS.map((item, index) => {
          const Icon = item.icon
          const isActive = active === item.key
          return (
            <button
              key={item.key}
              onClick={() => onSelect(item.key)}
              title={isCollapsed ? `${index + 1}. ${item.label}` : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition-colors overflow-hidden ${
                isCollapsed ? 'justify-center' : ''
              } ${
                isActive
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon size={22} className="flex-shrink-0" />
              {!isCollapsed && (
                <span className="truncate">
                  {index + 1}. {item.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {!isCollapsed && (
        <div className="border-t border-slate-800 p-4">
          <p className="text-center text-xs text-slate-500">운수종사자 일상 점검</p>
        </div>
      )}
    </aside>
  )
}

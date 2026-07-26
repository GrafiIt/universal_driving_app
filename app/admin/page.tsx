'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AdminSidebar, type AdminMenuKey } from '@/components/admin/admin-sidebar'
import { InspectionTable } from '@/components/admin/inspection-table'
import { VehicleManagement } from '@/components/admin/vehicle-management'
import { YearlyReport } from '@/components/admin/yearly-report'
import { EmergencyContacts } from '@/components/admin/emergency-contacts'
import { createClient } from '@/utils/supabase/client'

export default function AdminPage() {
  const router = useRouter()
  const [activeMenu, setActiveMenu] = useState<AdminMenuKey>('checklist')
  const [isChecking, setIsChecking] = useState(true)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)

  // ── 클라이언트 측 세션 및 권한 검증 (URL 직접 접근 방어) ────
  useEffect(() => {
    const checkAdminPermission = async () => {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()

        // 1. 미로그인 시 현재 URL 기반 로그인 페이지 리다이렉트
        if (!session) {
          const currentUrl = window.location.href
          const loginUrl = new URL('https://payment.1004.help/auth/login')
          loginUrl.searchParams.set('next', currentUrl)
          window.location.href = loginUrl.toString()
          return
        }

        // 2. 관리자 권한 API 검증
        const res = await fetch('/api/v1/users/me')
        let isManager = false

        if (res.ok) {
          const json = await res.json()
          console.log('[DEBUG AdminPage] users/me 응답:', json)
          const userLevel = json.userLevel ? Number(json.userLevel) : null
          const userRole = json.userRole

          if (userRole === 'admin' || userLevel === 1 || userLevel === 2) {
            isManager = true
          }
        }

        // 3. 권한 여부에 따른 분기
        if (isManager) {
          setIsChecking(false)
        } else {
          alert('해당 페이지는 관리자만 접근 가능합니다.')
          router.push('/')
        }
      } catch (err) {
        console.error('[AdminPage] 권한 확인 중 오류:', err)
        router.push('/')
      }
    }

    checkAdminPermission()
  }, [router])

  // 세션 확인 중에는 아무것도 렌더링하지 않음
  if (isChecking) return null

  return (
    <div className="flex h-screen w-full overflow-hidden bg-slate-100">
      {/* 좌측 사이드바 */}
      <AdminSidebar
        active={activeMenu}
        onSelect={setActiveMenu}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* 우측 메인 콘텐츠: 사이드바 접힘 여부에 관계없이 남은 공간 전체 차지 */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeMenu === 'checklist' && <InspectionTable />}
          {activeMenu === 'vehicles' && <VehicleManagement />}
          {activeMenu === 'yearly-report' && <YearlyReport />}
          {activeMenu === 'permissions' && (
            <iframe
              src="https://payment.1004.help/dashboard/members"
              className="w-full h-[calc(100vh-160px)] rounded-xl border border-slate-200 bg-white"
              title="권한 관리"
            />
          )}
          {activeMenu === 'emergency-contacts' && <EmergencyContacts />}
        </div>
      </main>
    </div>
  )
}

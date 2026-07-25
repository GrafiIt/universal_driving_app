'use client'

import { useEffect, useState } from 'react'

import { usePathname, useRouter } from 'next/navigation'
import { AlignJustify, ArrowLeft } from 'lucide-react'
import { SlideMenu } from '@/components/slide-menu'

export default function GlobalHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const [companyName, setCompanyName] = useState<string>('')
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  useEffect(() => {
    const fetchCompanyName = async () => {
      try {
        const res = await fetch('/api/v1/users/me')
        if (res.ok) {
          const json = await res.json()
          if (json.companyName) {
            setCompanyName(json.companyName)
          }
        }
      } catch {
        // 실패 시 기본값 유지
      }
    }

    fetchCompanyName()
  }, [])

  // 메인 랜딩 페이지에서는 숨김
  if (pathname === '/') return null

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 flex items-center">
        {/* 좌측: 로고 */}
        <button
          onClick={() => {
            if (pathname === '/checklist') {
              window.dispatchEvent(new CustomEvent('global-home'))
            } else {
              router.push('/checklist')
            }
          }}
          aria-label="홈으로 이동"
          className="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/favicon.png" alt="로고" className="h-8 w-auto object-contain" />
        </button>

        {/* 중앙: 회사명 또는 기본 타이틀 */}
        <div className="flex-1 text-center">
          <span className="font-bold text-[#1a3a52] text-[17px]">
            {companyName || '운수종사자 일상 점검'}
          </span>
        </div>

        {/* 우측: 뒤로가기 + 햄버거 메뉴 */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => {
              if (pathname === '/checklist') {
                window.dispatchEvent(new CustomEvent('global-back'))
              } else {
                router.back()
              }
            }}
            aria-label="뒤로 가기"
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft size={24} className="text-[#1a3a52]" />
          </button>
          <button
            onClick={() => setIsMenuOpen(true)}
            aria-label="메뉴 열기"
            aria-haspopup="true"
            aria-expanded={isMenuOpen}
            className="w-9 h-9 flex items-center justify-center rounded hover:bg-gray-100 transition-colors"
          >
            <AlignJustify size={24} className="text-[#1a3a52]" />
          </button>
        </div>
      </header>

      <SlideMenu isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  )
}

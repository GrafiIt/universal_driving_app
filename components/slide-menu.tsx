'use client';

import { X, Smartphone, Settings, LogOut, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface SlideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

// 통합 인증 사이트 로그인 페이지
const LOGIN_URL = 'https://payment.1004.help/auth/login';

export function SlideMenu({ isOpen, onClose }: SlideMenuProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [userLevel, setUserLevel] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isLoadingLevel, setIsLoadingLevel] = useState(false);

  // 메뉴 열릴 때 body 스크롤 잠금 + 사용자 등급 조회
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';

      // 메뉴가 열릴 때마다 최신 등급을 가져옴
      setIsLoadingLevel(true);
      fetch('/api/v1/users/me')
        .then((res) => {
          if (!res.ok) throw new Error('unauthorized');
          return res.json();
        })
        .then((data) => {
          setUserLevel(data.userLevel ?? data.user_level ?? null);
          setUserRole(data.userRole ?? data.user_role ?? null);
        })
        .catch(() => {
          setUserLevel(null);
          setUserRole(null);
        })
        .finally(() => setIsLoadingLevel(false));
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleAdminClick = () => {
    // 로딩 중이면 무시
    if (isLoadingLevel) return;

    // userRole === 'admin' 또는 userLevel 1, 2 허용
    const isManager = userRole === 'admin' || userLevel === 1 || userLevel === 2;
    if (isManager) {
      router.push('/admin');
      onClose();
    } else {
      alert('관리자만 접근할 수 있습니다.');
    }
  };

  const handleMonthlyReportClick = () => {
    router.push('/monthly-report');
    onClose();
  };

  const handleInstallClick = () => {
    router.push('/install');
    onClose();
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[v0] 로그아웃 오류:', err);
    } finally {
      window.location.href = LOGIN_URL;
    }
  };

  return (
    <>
      {/* 오버레이 배경 */}
      <div
        className={`fixed inset-0 z-[60] bg-black/50 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onClose}
        aria-hidden="true"
        style={{ touchAction: 'none' }}
      />

      {/* 슬라이드 메뉴 패널 */}
      <div
        className={`fixed top-0 right-0 z-[70] h-full w-72 bg-slate-800 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="사이드 메뉴"
        style={{ touchAction: 'pan-y' }}
      >
        {/* 메뉴 헤더 */}
        <div className="flex items-center justify-between px-5 pt-8 pb-5 border-b border-slate-700">
          <span className="text-white font-bold text-lg tracking-tight">메뉴</span>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-2xl text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            aria-label="메뉴 닫기"
          >
            <X size={22} />
          </button>
        </div>

        {/* 메뉴 항목 목록 */}
        <nav className="flex-1 px-3 pt-4 flex flex-col gap-1">
          {/* 1. 관리자 페이지 */}
          <button
            onClick={handleAdminClick}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-100 hover:bg-slate-700 active:bg-slate-600 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Settings size={20} className="text-slate-200" />
            </div>
            <span className="font-semibold text-base">1. 관리자 페이지</span>
          </button>

          {/* 2. 운수종사자 일상점검표 확인 */}
          <button
            onClick={handleMonthlyReportClick}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-100 hover:bg-slate-700 active:bg-slate-600 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <FileText size={20} className="text-slate-200" />
            </div>
            <span className="font-semibold text-base">2. 운수종사자 일상점검표 확인</span>
          </button>

          {/* 3. 휴대폰 설치 */}
          <button
            onClick={handleInstallClick}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-100 hover:bg-slate-700 active:bg-slate-600 transition-colors text-left"
          >
            <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Smartphone size={20} className="text-slate-200" />
            </div>
            <span className="font-semibold text-base">3. 휴대폰 설치</span>
          </button>

          {/* 4. 로그아웃 */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-100 hover:bg-slate-700 active:bg-slate-600 transition-colors text-left disabled:opacity-60"
          >
            <div className="w-10 h-10 bg-slate-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <LogOut size={20} className="text-slate-200" />
            </div>
            <span className="font-semibold text-base">
              {isLoggingOut ? '로그아웃 중...' : '4. 로그아웃'}
            </span>
          </button>
        </nav>

        {/* 메뉴 하단 버전 표시 */}
        <div className="px-5 pb-8 pt-4 border-t border-slate-700">
          <p className="text-slate-500 text-xs text-center">v1.0.0</p>
        </div>
      </div>
    </>
  );
}

import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import ServiceWorkerRegister from '@/components/service-worker-register'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: '스마트폰으로 끝내는 운수종사자 일상점검표',
  description: "2026년 6월 30일 시행되는 화물자동차 운수사업법 개정안 완벽 대응! 번거로운 종이 '운수종사자 일상점검표'를 모바일 앱과 웹으로 간편하게 작성하고 보관하세요. 차량 내 비치 및 운송업체 보관 의무를 한 번에 해결하고 50만원 과태료를 예방합니다.",
  keywords: [
    '운수종사자 일상점검표',
    '화물자동차 운수사업법 시행규칙',
    '화물차 일상점검',
    '일상점검 앱',
    '일상점검표 어플',
    '운송사업자 관리 의무',
    '50만원 과태료',
    '차량관리시스템',
    '운행 전 점검',
    '화물차 관리',
  ],
  generator: 'v0.app',
  manifest: '/manifest.json',
  openGraph: {
    type: 'website',
    title: '스마트폰으로 끝내는 운수종사자 일상점검표',
    description: '종이 점검표는 그만! 기사님은 1분 만에 스마트폰으로 체크하고, 대표님은 사무실에서 실시간으로 확인하세요. 2026년 시행 개정안 완벽 대응 솔루션.',
    siteName: '운수종사자 일상점검표 간편 관리',
    images: [
      {
        url: '/logo-ci.png',
        width: 1200,
        height: 630,
        alt: '운수종사자 일상점검표',
      },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '운수종사자 일상점검',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1.0,
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} bg-background`}>
      <body className="font-sans antialiased bg-background">
        {children}
        <ServiceWorkerRegister />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}

'use client';

import { InstallGuide } from '@/components/install-guide';

export default function InstallPage() {
  return (
    <div className="w-full min-h-screen bg-white flex flex-col overflow-hidden">
      {/* ── 메인 콘텐츠 ── */}
        <main className="flex-1 flex flex-col overflow-hidden">
          <InstallGuide />
        </main>


    </div>
  );
}

import type { ReactNode } from 'react';
import { AppSidebar } from '@/components/app-sidebar';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-x-hidden pb-16 md:pb-0">{children}</main>
    </div>
  );
}

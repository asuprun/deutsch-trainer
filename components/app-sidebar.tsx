'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  GraduationCap,
  Layers,
  BookOpen,
  FolderOpen,
  BarChart3,
  Settings,
  LogOut,
  FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Главная', icon: LayoutDashboard },
  { href: '/upload', label: 'Загрузить', icon: Upload },
  { href: '/review', label: 'Тренировка', icon: GraduationCap },
  { href: '/cards', label: 'Карты', icon: Layers },
  { href: '/grammar', label: 'Грамматика', icon: BookOpen },
  { href: '/decks', label: 'Колоды', icon: FolderOpen },
  { href: '/import', label: 'Импорт', icon: FileDown },
  { href: '/stats', label: 'Статистика', icon: BarChart3 },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:bg-sidebar md:text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <GraduationCap className="size-5" />
        <span className="font-semibold">Deutsch Trainer</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => {
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/60',
                  )}
                >
                  <Icon className="size-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="border-t p-2">
        <Button variant="ghost" className="w-full justify-start gap-3" onClick={handleLogout}>
          <LogOut className="size-4" />
          Выйти
        </Button>
      </div>
    </aside>
  );
}

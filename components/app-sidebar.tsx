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
  Menu,
  MessageCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Главная', icon: LayoutDashboard },
  { href: '/upload', label: 'Загрузить', icon: Upload },
  { href: '/review', label: 'Тренировка', icon: GraduationCap },
  { href: '/practice', label: 'Чат', icon: MessageCircle },
  { href: '/cards', label: 'Карты', icon: Layers },
  { href: '/grammar', label: 'Грамматика', icon: BookOpen },
  { href: '/decks', label: 'Колоды', icon: FolderOpen },
  { href: '/import', label: 'Импорт', icon: FileDown },
  { href: '/stats', label: 'Статистика', icon: BarChart3 },
  { href: '/settings', label: 'Настройки', icon: Settings },
];

// Первые 4 пункта показываем в bottom bar напрямую, 5-й — кнопка «Меню»
const BOTTOM_NAV_ITEMS = [
  { href: '/', label: 'Главная', icon: LayoutDashboard },
  { href: '/review', label: 'Тренировка', icon: GraduationCap },
  { href: '/upload', label: 'Загрузить', icon: Upload },
  { href: '/cards', label: 'Карты', icon: Layers },
];

// Остальные пункты — в Sheet
const SHEET_NAV_ITEMS = NAV_ITEMS.filter(
  (item) => !BOTTOM_NAV_ITEMS.some((b) => b.href === item.href),
);

export function AppSidebar() {
  const pathname = usePathname();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }

  function isActive(href: string) {
    return href === '/' ? pathname === '/' : pathname.startsWith(href);
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 md:shrink-0 md:border-r md:bg-sidebar md:text-sidebar-foreground">
        <div className="flex h-14 items-center gap-2 border-b px-4">
          <GraduationCap className="size-5" />
          <span className="font-semibold">Deutsch Trainer</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
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

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t bg-background/95 backdrop-blur">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs transition-colors',
                active ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <Icon className="size-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}

        {/* Кнопка «Меню» открывает Sheet с остальными пунктами */}
        <Sheet>
          <SheetTrigger asChild>
            <button
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors"
              aria-label="Меню"
            >
              <Menu className="size-5" />
              <span>Меню</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>Навигация</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1">
              {SHEET_NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors',
                      active
                        ? 'bg-accent text-accent-foreground'
                        : 'hover:bg-accent/60',
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/60 text-destructive"
                >
                  <LogOut className="size-4" />
                  Выйти
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}

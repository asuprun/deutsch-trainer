'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
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
import { useI18n } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n/translations';

type NavItemDef = {
  href: string;
  key: TranslationKey;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEM_DEFS: NavItemDef[] = [
  { href: '/', key: 'nav_home', icon: LayoutDashboard },
  { href: '/upload', key: 'nav_upload', icon: Upload },
  { href: '/review', key: 'nav_review', icon: GraduationCap },
  { href: '/practice', key: 'nav_practice', icon: MessageCircle },
  { href: '/cards', key: 'nav_cards', icon: Layers },
  { href: '/grammar', key: 'nav_grammar', icon: BookOpen },
  { href: '/decks', key: 'nav_decks', icon: FolderOpen },
  { href: '/import', key: 'nav_import', icon: FileDown },
  { href: '/stats', key: 'nav_stats', icon: BarChart3 },
  { href: '/settings', key: 'nav_settings', icon: Settings },
];

const BOTTOM_NAV_HREFS = ['/', '/review', '/upload', '/cards'];

export function AppSidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);

  // Закрывать меню при любой смене маршрута
  useEffect(() => {
    setSheetOpen(false);
  }, [pathname]);

  const NAV_ITEMS = NAV_ITEM_DEFS.map((item) => ({ ...item, label: t(item.key) }));
  const BOTTOM_NAV_ITEMS = NAV_ITEM_DEFS.filter((item) =>
    BOTTOM_NAV_HREFS.includes(item.href),
  ).map((item) => ({ ...item, label: t(item.key) }));
  const SHEET_NAV_ITEMS = NAV_ITEMS.filter(
    (item) => !BOTTOM_NAV_HREFS.includes(item.href),
  );

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
            {t('nav_logout')}
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
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              className="flex flex-1 flex-col items-center justify-center gap-1 py-2 text-xs text-muted-foreground transition-colors"
              aria-label={t('nav_menu')}
            >
              <Menu className="size-5" />
              <span>{t('nav_menu')}</span>
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="pb-safe">
            <SheetHeader>
              <SheetTitle>{t('nav_navigation')}</SheetTitle>
            </SheetHeader>
            <nav className="mt-4 flex flex-col gap-1">
              {SHEET_NAV_ITEMS.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setSheetOpen(false)}
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
                  onClick={() => { setSheetOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-accent/60 text-destructive"
                >
                  <LogOut className="size-4" />
                  {t('nav_logout')}
                </button>
              </div>
            </nav>
          </SheetContent>
        </Sheet>
      </nav>
    </>
  );
}

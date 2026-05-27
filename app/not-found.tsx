'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';

export default function NotFound() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center p-6">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <h2 className="text-2xl font-semibold">{t('notfound_title')}</h2>
      <p className="text-muted-foreground max-w-sm">{t('notfound_description')}</p>
      <Button asChild>
        <Link href="/">{t('notfound_home')}</Link>
      </Button>
    </div>
  );
}

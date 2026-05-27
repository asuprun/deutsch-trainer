'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RotateCw, Home } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const { t } = useI18n();
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">{t('error_title')}</h1>
      <p className="text-sm text-muted-foreground max-w-sm">{error.message || t('error_page_load')}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCw className="size-4 mr-2" />
          {t('error_refresh')}
        </Button>
        <Button variant="outline" asChild>
          <Link href="/"><Home className="size-4 mr-2" />{t('btn_home')}</Link>
        </Button>
      </div>
    </div>
  );
}

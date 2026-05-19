'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { RotateCw, Home } from 'lucide-react';

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Ошибка</h1>
      <p className="text-sm text-muted-foreground max-w-sm">{error.message || 'Произошла ошибка при загрузке страницы'}</p>
      <div className="flex gap-3">
        <Button onClick={reset}>
          <RotateCw className="size-4 mr-2" />
          Обновить
        </Button>
        <Button variant="outline" asChild>
          <Link href="/"><Home className="size-4 mr-2" />Главная</Link>
        </Button>
      </div>
    </div>
  );
}

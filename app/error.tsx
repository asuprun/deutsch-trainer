'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="ru">
      <body className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
          <p className="text-muted-foreground text-sm max-w-sm">{error.message || 'Произошла непредвиденная ошибка'}</p>
          <Button onClick={reset}>Попробовать снова</Button>
        </div>
      </body>
    </html>
  );
}

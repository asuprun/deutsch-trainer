'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, RotateCw, Home, FlipHorizontal2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ReviewCard, type ReviewCardData } from '@/components/review-card';
import { SwipeCard } from '@/components/swipe-card';
import { RatingButtons, type RatingIntervals } from '@/components/rating-buttons';
import { TypingInput } from '@/components/typing-input';
import type { Grade } from 'ts-fsrs';
import { useI18n } from '@/lib/i18n/context';

type QueueCard = ReviewCardData & {
  intervals: RatingIntervals | null;
};

type QueueResponse = {
  queue: QueueCard[];
  due_count_total: number;
};

type Status = 'loading' | 'empty' | 'active' | 'done' | 'error';
type Mode = 'cards' | 'typing';

export default function ReviewPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('cards');

  const loadQueue = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/review/queue?limit=20');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data: QueueResponse = await res.json();
      if (data.queue.length === 0) {
        setStatus('empty');
      } else {
        setQueue(data.queue);
        setIdx(0);
        setFlipped(false);
        setDone(0);
        setStatus('active');
      }
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error ? e.message : t('review_load_error'));
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const current = status === 'active' ? queue[idx] : null;

  const advance = useCallback(() => {
    const next = idx + 1;
    setDone((d) => d + 1);
    if (next >= queue.length) {
      setStatus('done');
    } else {
      setIdx(next);
      setFlipped(false);
    }
  }, [idx, queue.length]);

  const handleRate = useCallback(
    async (rating: Grade) => {
      if (!current || submitting) return;
      setSubmitting(true);
      try {
        const res = await fetch('/api/review/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ card_id: current.id, rating }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        }
      } catch (e) {
        toast.error(t('review_save_error'), {
          description: e instanceof Error ? e.message : '',
        });
      } finally {
        setSubmitting(false);
      }
      advance();
    },
    [current, submitting, advance],
  );

  // Клавиши — только в режиме карточек
  useEffect(() => {
    if (status !== 'active' || mode !== 'cards') return;
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (!flipped) setFlipped(true);
        return;
      }
      if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        handleRate(Number(e.key) as Grade);
        return;
      }
      if (e.key === 'Escape') router.push('/');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, mode, flipped, handleRate, router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="p-6 max-w-xl">
        <h1 className="text-2xl font-semibold mb-2">{t('error_title')}</h1>
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button onClick={loadQueue}>
          <RotateCw className="size-4 mr-2" />
          {t('upload_retry')}
        </Button>
      </div>
    );
  }

  if (status === 'empty') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">{t('review_empty')}</h1>
        <p className="text-muted-foreground max-w-md">{t('review_empty_desc')}</p>
        <div className="flex gap-3 mt-2">
          <Button asChild>
            <Link href="/upload">{t('cards_upload_btn')}</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">{t('btn_home')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">{t('review_session_done')}</h1>
        <p className="text-muted-foreground">{t('review_reviewed_count')}: {done}</p>
        <div className="flex gap-3 mt-2">
          <Button onClick={loadQueue}>
            <RotateCw className="size-4 mr-2" />
            {t('review_another_session')}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">
              <Home className="size-4 mr-2" />
              {t('btn_home')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    // h-[100dvh] = динамический viewport: сжимается когда открыта клавиатура,
    // восстанавливается когда закрывается — без ручного скролла
    <div className="flex flex-col h-[100dvh]">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label={t('review_close_label')}>
            <X className="size-5" />
          </Link>
        </Button>

        <div className="flex-1">
          <Progress value={(idx / queue.length) * 100} className="h-2" />
        </div>

        <span className="text-sm tabular-nums text-muted-foreground mr-1">
          {idx + 1} / {queue.length}
        </span>

        {/* Переключатель режима */}
        <div className="flex rounded-md border overflow-hidden">
          <button
            onClick={() => { setMode('cards'); setFlipped(false); }}
            title={t('review_mode_cards')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors ${
              mode === 'cards'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <FlipHorizontal2 className="size-3.5" />
            <span className="hidden sm:inline">{t('review_mode_cards')}</span>
          </button>
          <button
            onClick={() => { setMode('typing'); setFlipped(false); }}
            title={t('review_mode_typing')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs transition-colors border-l ${
              mode === 'typing'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Keyboard className="size-3.5" />
            <span className="hidden sm:inline">{t('review_mode_typing')}</span>
          </button>
        </div>
      </header>

      {/* min-h-0 + overflow-y-auto: скролл внутри оставшегося пространства.
          Внутренний div с min-h-full + justify-center: центрирует когда влезает,
          скроллится когда не влезает (после флипа с примерами). */}
      <main className="flex-1 min-h-0 overflow-y-auto">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          {/* Карточка — в режиме ввода показываем только лицевую сторону до проверки */}
          {mode === 'cards' ? (
            <SwipeCard
              onSwipeLeft={flipped ? () => handleRate(1) : undefined}
              onSwipeRight={flipped ? () => handleRate(4) : () => setFlipped(true)}
              leftLabel={flipped ? '✗ Снова' : undefined}
              rightLabel={flipped ? '✓ Легко' : '👁 Ответ'}
              disabled={submitting}
            >
              <ReviewCard card={current} flipped={flipped} />
            </SwipeCard>
          ) : (
            <ReviewCard card={current} flipped={false} />
          )}

          {mode === 'cards' && !flipped && (
            <Button size="lg" onClick={() => setFlipped(true)}>
              {t('review_show_answer')}
              <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono hidden sm:inline">Space</kbd>
            </Button>
          )}

          {mode === 'typing' && (
            <TypingInput
              key={current.id}
              correctAnswer={current.back}
              hint={t('review_type_hint')}
              intervals={current.intervals}
              onRate={handleRate}
              disabled={submitting}
            />
          )}
        </div>
      </main>

      {/* Оценки — всегда внизу экрана, не в скролл-зоне */}
      {mode === 'cards' && flipped && (
        <footer className="shrink-0 border-t p-4 sm:p-6 bg-background/95 backdrop-blur">
          <div className="max-w-3xl mx-auto">
            <RatingButtons intervals={current.intervals} onRate={handleRate} disabled={submitting} />
          </div>
        </footer>
      )}
    </div>
  );
}

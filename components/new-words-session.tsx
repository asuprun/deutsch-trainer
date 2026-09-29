'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, X, RotateCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewCard, type ReviewCardData } from '@/components/review-card';
import { useI18n } from '@/lib/i18n/context';

type Props = { count: number; sourceId: string | null; onExit: () => void };
type Status = 'loading' | 'active' | 'empty' | 'done' | 'error';

/**
 * «Neue Wörter»: noch nie geübte Wörter bewusst ins Lernen aufnehmen.
 *  - Lernen        → Bewertung «Gut» → Lernphase 1 → 3 → 7 → 14 → 30 Tage (siehe LEARN_LADDER_DAYS)
 *  - Kenne ich     → Bewertung «Leicht» → Lernphase übersprungen, FSRS plant weit voraus
 *  - Überspringen  → bleibt neu, taucht beim nächsten Mal wieder auf
 * Die normale Wiederholung zeigt nur Wörter, die man so begonnen hat.
 */
export function NewWordsSession({ count, sourceId, onExit }: Props) {
  const { t } = useI18n();
  const [status, setStatus] = useState<Status>('loading');
  const [cards, setCards] = useState<ReviewCardData[]>([]);
  const [idx, setIdx] = useState(0);
  const [learned, setLearned] = useState(0);
  const [known, setKnown] = useState(0);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const qs = new URLSearchParams({ new: '1', limit: String(count) });
      if (sourceId) qs.set('source_id', sourceId);
      const res = await fetch(`/api/review/queue?${qs}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const list: ReviewCardData[] = data.queue ?? [];
      setCards(list); setIdx(0); setLearned(0); setKnown(0);
      setStatus(list.length ? 'active' : 'empty');
    } catch {
      setStatus('error');
    }
  }, [count, sourceId]);

  useEffect(() => { load(); }, [load]);

  const current = status === 'active' ? cards[idx] : null;

  const advance = useCallback(() => {
    if (idx + 1 >= cards.length) setStatus('done');
    else setIdx((i) => i + 1);
  }, [idx, cards.length]);

  const decide = useCallback(async (action: 'learn' | 'known' | 'skip') => {
    if (!current || busy) return;
    if (action === 'skip') { advance(); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/review/answer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: current.id, rating: action === 'learn' ? 3 : 4 }),
      });
      if (!res.ok) throw new Error();
      if (action === 'learn') setLearned((n) => n + 1); else setKnown((n) => n + 1);
      advance();
    } catch {
      toast.error(t('review_save_error'));
    } finally {
      setBusy(false);
    }
  }, [current, busy, advance, t]);

  // Tastatur: Enter = Lernen, K = Kenne ich, → = Überspringen
  useEffect(() => {
    if (status !== 'active') return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); decide('learn'); }
      else if (e.key.toLowerCase() === 'k') decide('known');
      else if (e.key === 'ArrowRight') decide('skip');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [status, decide]);

  if (status === 'loading')
    return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  if (status === 'error' || status === 'empty' || status === 'done')
    return (
      <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-background p-6 text-center">
        {status === 'done' ? (
          <>
            <div className="text-5xl">📌</div>
            <div className="space-y-1">
              <p className="text-2xl font-semibold tabular-nums">{learned} {t('new_done_learn')}</p>
              {known > 0 && <p className="text-muted-foreground tabular-nums">{known} {t('new_done_known')}</p>}
              {learned > 0 && <p className="text-sm text-muted-foreground">{t('new_done_next')}</p>}
            </div>
          </>
        ) : (
          <h1 className="text-2xl font-semibold">{status === 'empty' ? t('new_empty') : t('review_save_error')}</h1>
        )}
        <div className="flex flex-wrap justify-center gap-3">
          {status !== 'empty' && <Button onClick={load}><RotateCw className="size-4 mr-2" />{t('new_more')}</Button>}
          {status === 'empty' && <Button asChild><Link href="/upload">{t('cards_upload_btn')}</Link></Button>}
          <Button variant="outline" onClick={onExit}><Home className="size-4 mr-2" />{t('gramex_back')}</Button>
        </div>
      </div>
    );

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" onClick={onExit} aria-label={t('review_close_label')}><X className="size-5" /></Button>
        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">{idx + 1} / {cards.length}</span>
        <span className="text-sm tabular-nums text-muted-foreground">📌 {learned}</span>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          <ReviewCard key={current.id} card={current} flipped />
        </div>
      </main>

      <footer className="shrink-0 border-t p-4 sm:p-6 bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Button size="lg" onClick={() => decide('learn')} disabled={busy}>{t('new_learn')}</Button>
            <Button size="lg" variant="outline" onClick={() => decide('known')} disabled={busy}>{t('new_known')}</Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => decide('skip')} disabled={busy} className="text-muted-foreground">
            {t('new_skip')} →
          </Button>
          <p className="text-center text-xs text-muted-foreground">{t('new_hint')}</p>
        </div>
      </footer>
    </div>
  );
}

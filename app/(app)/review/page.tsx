'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, X, RotateCw, Home, FlipHorizontal2, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ReviewCard, CardForms, CardExtras, type ReviewCardData } from '@/components/review-card';
import { stripArticle } from '@/lib/utils';
import { SwipeCard } from '@/components/swipe-card';
import { RatingButtons, type RatingIntervals } from '@/components/rating-buttons';
import { TypingInput } from '@/components/typing-input';
import { GenderDrill } from '@/components/gender-drill';
import { VerbFormsDrill } from '@/components/verb-forms-drill';
import { VerbRecognitionDrill } from '@/components/verb-recognition-drill';
import { VerbPatterns } from '@/components/verb-patterns';
import { VerbPrepDrill } from '@/components/verb-prep-drill';
import { DeckClozeSession } from '@/components/deck-cloze-session';
import { NewWordsSession } from '@/components/new-words-session';
import { PronounDrill, type PronMode } from '@/components/pronoun-drill';
import { FORM_ITEMS, SENTENCE_ITEMS } from '@/lib/pronouns/data';
import { GrammarDrill } from '@/components/grammar-drill';
import { DRILL_TOPICS, itemsFor, type DrillTopic } from '@/lib/grammar-drills/data';
import type { Grade } from 'ts-fsrs';
import { useI18n } from '@/lib/i18n/context';

type QueueCard = ReviewCardData & {
  intervals: RatingIntervals | null;
};

type QueueResponse = {
  queue: QueueCard[];
  due_count_total: number;
};

type Status = 'lobby' | 'loading' | 'empty' | 'active' | 'done' | 'error' | 'gender' | 'verbforms' | 'verbrecognition' | 'verbpatterns' | 'verbpreps' | 'cloze' | 'newwords' | 'pronouns' | 'grammar';
type VerbDir = 'forms' | 'recognition';
type PrepMode = 'recall' | 'cloze';
type Mode = 'cards' | 'typing';
type Direction = 'de-ru' | 'ru-de';
type Training = 'words' | 'new' | 'gender' | 'leeches' | 'verbforms' | 'verbpreps' | 'pronouns' | 'grammar';

export default function ReviewPage() {
  return (
    <Suspense>
      <ReviewInner />
    </Suspense>
  );
}

function ReviewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceId = searchParams.get('source_id');
  const { t } = useI18n();
  // ?cloze=1 из колоды — сразу открываем текст с пропусками
  const [status, setStatus] = useState<Status>(
    searchParams.get('cloze') === '1' && sourceId ? 'cloze' : 'lobby',
  );
  const [queue, setQueue] = useState<QueueCard[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('cards');
  const [direction, setDirection] = useState<Direction>('de-ru');
  const [training, setTraining] = useState<Training>('words');
  const [verbPattern, setVerbPattern] = useState<string | null>(null);
  const [verbDir, setVerbDir] = useState<VerbDir>('forms');
  const [prepMode, setPrepMode] = useState<PrepMode>('recall');
  const [prepHard, setPrepHard] = useState(false);
  const [pronMode, setPronMode] = useState<PronMode>('sentences');
  const [gTopic, setGTopic] = useState<DrillTopic | 'all'>('all');
  const [totalNew, setTotalNew] = useState<number | null>(null);
  const [limit, setLimit] = useState<number>(sourceId ? 500 : 20);
  const [totalDue, setTotalDue] = useState<number | null>(null);
  const [totalLeeches, setTotalLeeches] = useState<number | null>(null);
  const [totalVerbs, setTotalVerbs] = useState<number | null>(null);
  const [totalVerbPreps, setTotalVerbPreps] = useState<number | null>(null);
  const [totalVerbPrepsHard, setTotalVerbPrepsHard] = useState<number | null>(null);
  const [totalVerbPrepsCloze, setTotalVerbPrepsCloze] = useState<number | null>(null);
  const [totalVerbPrepsClozeHard, setTotalVerbPrepsClozeHard] = useState<number | null>(null);

  // Fetch due + leech counts in background when lobby is shown
  useEffect(() => {
    if (status !== 'lobby') return;
    const base = new URLSearchParams({ limit: '1' });
    if (sourceId) base.set('source_id', sourceId);
    // Слова: для колоды считаем ВСЮ колоду (all=1), для общей тренировки — только созревшие
    const wordsQs = new URLSearchParams(base);
    if (sourceId) wordsQs.set('all', '1');
    fetch(`/api/review/queue?${wordsQs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.due_count_total === 'number') setTotalDue(data.due_count_total);
      })
      .catch(() => {});
    // Neue Wörter (noch nie geübt) — kommen nur bewusst über «Neue Wörter» ins Lernen
    const newQs = new URLSearchParams(base);
    newQs.set('new', '1');
    fetch(`/api/review/queue?${newQs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.due_count_total === 'number') setTotalNew(data.due_count_total);
      })
      .catch(() => {});
    // Трудные слова
    const leechQs = new URLSearchParams(base);
    leechQs.set('leeches', '1');
    fetch(`/api/review/queue?${leechQs}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.due_count_total === 'number') setTotalLeeches(data.due_count_total);
      })
      .catch(() => {});
    // Глаголы с формами
    fetch(`/api/review/verbs?${base}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === 'number') setTotalVerbs(data.total);
      })
      .catch(() => {});
    // Глаголы с предлогом
    fetch(`/api/review/verb-preps?${base}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.total === 'number') setTotalVerbPreps(data.total);
        if (data && typeof data.hardTotal === 'number') setTotalVerbPrepsHard(data.hardTotal);
        if (data && typeof data.clozeTotal === 'number') setTotalVerbPrepsCloze(data.clozeTotal);
        if (data && typeof data.clozeHardTotal === 'number') setTotalVerbPrepsClozeHard(data.clozeHardTotal);
      })
      .catch(() => {});
  }, [status, sourceId]);

  const loadQueue = useCallback(async (selectedLimit: number, leeches = false) => {
    setStatus('loading');
    setError(null);
    try {
      const qs = new URLSearchParams({ limit: String(selectedLimit) });
      if (sourceId) qs.set('source_id', sourceId);
      if (leeches) qs.set('leeches', '1');
      // Колода: тренируем все карты, даже если 0 «созрели» по расписанию
      else if (sourceId) qs.set('all', '1');
      const res = await fetch(`/api/review/queue?${qs}`);
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
  }, [sourceId, t]);

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

  // Клавиши — только в режиме карточек (или когда grammar_rule принудительно в cards)
  useEffect(() => {
    if (status !== 'active') return;
    const card = queue[idx];
    const isCards = mode === 'cards' ||
      (mode === 'typing' && (card?.kind === 'grammar_rule' || card?.kind === 'sentence'));
    if (!isCards) return;
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

  // ── Gender drill ─────────────────────────────────────────────────────────────
  if (status === 'gender') {
    return (
      <GenderDrill
        count={limit}
        sourceId={sourceId}
        onExit={() => setStatus('lobby')}
      />
    );
  }

  // ── Verb forms drill ─────────────────────────────────────────────────────────
  if (status === 'verbforms') {
    return (
      <VerbFormsDrill
        count={limit}
        sourceId={sourceId}
        pattern={verbPattern}
        onExit={() => setStatus('lobby')}
      />
    );
  }

  // ── Neue Wörter kennenlernen ─────────────────────────────────────────────────
  if (status === 'newwords') {
    return <NewWordsSession count={limit} sourceId={sourceId} onExit={() => setStatus('lobby')} />;
  }

  // ── Pronomen-Trainer ─────────────────────────────────────────────────────────
  if (status === 'pronouns') {
    return <PronounDrill count={limit} mode={pronMode} onExit={() => setStatus('lobby')} />;
  }

  // ── Grammatik-Trainer ────────────────────────────────────────────────────────
  if (status === 'grammar') {
    return <GrammarDrill count={limit} topic={gTopic} onExit={() => setStatus('lobby')} />;
  }

  // ── Verb-mit-Präposition-Drill ───────────────────────────────────────────────
  if (status === 'verbpreps') {
    return (
      <VerbPrepDrill
        count={limit}
        sourceId={sourceId}
        mode={prepMode}
        hardOnly={prepHard}
        onExit={() => setStatus('lobby')}
      />
    );
  }

  // ── Verb recognition drill (форма → инфинитив) ───────────────────────────────
  if (status === 'verbrecognition') {
    return (
      <VerbRecognitionDrill
        count={limit}
        sourceId={sourceId}
        pattern={verbPattern}
        onExit={() => setStatus('lobby')}
      />
    );
  }

  // ── Текст с пропусками по колоде ─────────────────────────────────────────────
  if (status === 'cloze' && sourceId) {
    return <DeckClozeSession sourceId={sourceId} onExit={() => setStatus('lobby')} />;
  }

  // ── Verb ablaut patterns (обзор + запуск дрилла по группе) ────────────────────
  if (status === 'verbpatterns') {
    return (
      <VerbPatterns
        sourceId={sourceId}
        onExit={() => setStatus('lobby')}
        onDrill={(pattern) => {
          setVerbPattern(pattern);
          setStatus(verbDir === 'recognition' ? 'verbrecognition' : 'verbforms');
        }}
      />
    );
  }

  // ── Lobby ────────────────────────────────────────────────────────────────────
  if (status === 'lobby') {
    const LIMIT_OPTIONS = [10, 20, 30, 50];
    // Satz-Modus zählt nur Verben mit brauchbarem Beispielsatz
    const prepCount = prepMode === 'cloze'
      ? (prepHard ? totalVerbPrepsClozeHard : totalVerbPrepsCloze)
      : (prepHard ? totalVerbPrepsHard : totalVerbPreps);
    const prepHardAvailable = prepMode === 'cloze' ? totalVerbPrepsClozeHard : totalVerbPrepsHard;
    const prepNoExample = totalVerbPreps != null && totalVerbPrepsCloze != null
      ? totalVerbPreps - totalVerbPrepsCloze : 0;
    return (
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
        <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/" aria-label={t('review_close_label')}>
              <X className="size-5" />
            </Link>
          </Button>
          <span className="flex-1 text-center text-sm font-medium">{t('nav_review')}</span>
          <div className="size-9" />
        </header>

        <main className="flex-1 flex flex-col items-center justify-center gap-6 p-6 text-center">
          {sourceId && (
            <div className="flex flex-col items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                {t('review_from_deck')}
              </span>
              {/* Текст с пропусками — доступен только для колоды */}
              <Button variant="outline" size="sm" onClick={() => setStatus('cloze')}>
                {t('cloze_btn')}
              </Button>
            </div>
          )}

          {/* Тип тренировки */}
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">{t('review_train_label')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {([
                ['words', t('review_train_words')],
                ['new', t('review_train_new')],
                ['gender', t('review_train_gender')],
                ['verbforms', t('review_train_verbforms')],
                ['verbpreps', t('review_train_verbpreps')],
                ['pronouns', t('review_train_pronouns')],
                ['grammar', t('review_train_grammar')],
                ['leeches', t('review_train_leeches')],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setTraining(value)}
                  className={`rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    training === value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {training === 'words' && (
            <p className="text-muted-foreground text-sm">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {totalDue ?? '...'}
              </span>{' '}
              {sourceId ? t('review_lobby_deck_count') : t('review_lobby_due')}
            </p>
          )}
          {/* Nichts zu wiederholen, aber neue Wörter da → dorthin lenken */}
          {training === 'words' && !sourceId && totalDue === 0 && !!totalNew && (
            <Button variant="outline" size="sm" onClick={() => setTraining('new')}>
              {t('review_goto_new')} ({totalNew})
            </Button>
          )}
          {training === 'new' && (
            <div className="flex flex-col items-center gap-2 max-w-sm text-center">
              <p className="text-muted-foreground text-sm">
                <span className="text-2xl font-bold text-foreground tabular-nums">{totalNew ?? '...'}</span>{' '}
                {t('review_lobby_new_count')}
              </p>
              <p className="text-xs text-muted-foreground">{t('new_hint')}</p>
            </div>
          )}
          {training === 'pronouns' && (
            <div className="flex flex-col items-center gap-3">
              <div className="flex rounded-md border overflow-hidden">
                {(['sentences', 'forms'] as const).map((m, i) => (
                  <button
                    key={m}
                    onClick={() => setPronMode(m)}
                    className={`px-3 py-1.5 text-xs transition-colors ${i ? 'border-l' : ''} ${
                      pronMode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {m === 'forms' ? t('pron_mode_forms') : t('pron_mode_sentences')}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-center">
                {pronMode === 'forms' ? t('pron_mode_forms_desc') : t('pron_mode_sentences_desc')}
              </p>
            </div>
          )}
          {training === 'grammar' && (
            <div className="flex flex-col items-center gap-3 max-w-md">
              <div className="flex flex-wrap justify-center gap-2">
                {(['all', ...DRILL_TOPICS] as const).map((tp) => (
                  <button
                    key={tp}
                    onClick={() => setGTopic(tp)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      gTopic === tp ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {t(`gdrill_topic_${tp}`)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground max-w-xs text-center">{t('gdrill_desc')}</p>
            </div>
          )}
          {training === 'leeches' && (
            <p className="text-muted-foreground text-sm">
              <span className="text-2xl font-bold text-foreground tabular-nums">
                {totalLeeches ?? '...'}
              </span>{' '}
              {t('review_lobby_leech_count')}
            </p>
          )}
          {training === 'verbforms' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground text-sm">
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {totalVerbs ?? '...'}
                </span>{' '}
                {t('review_lobby_verb_count')}
              </p>
              {/* Направление: пишу формы / узнаю инфинитив */}
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={() => setVerbDir('forms')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    verbDir === 'forms' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('verbdir_forms')}
                </button>
                <button
                  onClick={() => setVerbDir('recognition')}
                  className={`px-3 py-1.5 text-xs transition-colors border-l ${
                    verbDir === 'recognition' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('verbdir_recognition')}
                </button>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStatus('verbpatterns')}>
                {t('review_verb_patterns_btn')}
              </Button>
            </div>
          )}
          {training === 'verbpreps' && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-muted-foreground text-sm">
                <span className="text-2xl font-bold text-foreground tabular-nums">
                  {prepCount ?? '...'}
                </span>{' '}
                {prepHard ? t('verbprep_hard_count') : t('review_lobby_verbprep_count')}
              </p>
              {/* Режим: предлог+падеж / предложение с пропуском */}
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={() => setPrepMode('recall')}
                  className={`px-3 py-1.5 text-xs transition-colors ${
                    prepMode === 'recall' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('verbprep_recall')}
                </button>
                <button
                  onClick={() => setPrepMode('cloze')}
                  className={`px-3 py-1.5 text-xs transition-colors border-l ${
                    prepMode === 'cloze' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('verbprep_cloze')}
                </button>
              </div>
              {prepMode === 'cloze' && prepNoExample > 0 && (
                <p className="text-xs text-muted-foreground">
                  {prepNoExample} {t('verbprep_no_example')}
                </p>
              )}
              {/* Nur Verben, bei denen man sich oft irrt */}
              <button
                onClick={() => setPrepHard((v) => !v)}
                disabled={!prepHard && !prepHardAvailable}
                className={`px-3 py-1.5 text-xs rounded-md border transition-colors disabled:opacity-40 ${
                  prepHard ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {t('verbprep_hard_toggle')}
              </button>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <p className="text-lg font-semibold">{t('review_lobby_how_many')}</p>
            <div className="flex flex-wrap justify-center gap-2">
              {LIMIT_OPTIONS.map((n) => (
                <Button
                  key={n}
                  variant={limit === n ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLimit(n)}
                  className="min-w-[3.5rem]"
                >
                  {n}
                </Button>
              ))}
              {(() => {
                const lobbyTotal =
                  training === 'leeches' ? totalLeeches
                  : training === 'verbforms' ? totalVerbs
                  : training === 'verbpreps' ? prepCount
                  : training === 'new' ? totalNew
                  : training === 'grammar' ? itemsFor(gTopic).length
                  : training === 'pronouns' ? (pronMode === 'forms' ? FORM_ITEMS.length : SENTENCE_ITEMS.length)
                  : totalDue;
                return (
                  <Button
                    variant={limit === (lobbyTotal ?? 500) ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setLimit(lobbyTotal ?? 500)}
                    className="min-w-[3.5rem]"
                  >
                    {t('review_lobby_all')} {lobbyTotal != null ? lobbyTotal : ''}
                  </Button>
                );
              })()}
            </div>
          </div>

          {/* Направление перевода — только для слов и трудных */}
          {(training === 'words' || training === 'leeches') && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">{t('review_dir_label')}</p>
              <div className="flex rounded-md border overflow-hidden">
                <button
                  onClick={() => setDirection('de-ru')}
                  className={`px-4 py-1.5 text-sm transition-colors ${
                    direction === 'de-ru'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('review_dir_de_ru')}
                </button>
                <button
                  onClick={() => setDirection('ru-de')}
                  className={`px-4 py-1.5 text-sm transition-colors border-l ${
                    direction === 'ru-de'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {t('review_dir_ru_de')}
                </button>
              </div>
            </div>
          )}

          <Button
            size="lg"
            onClick={() => {
              if (training === 'gender') setStatus('gender');
              else if (training === 'verbforms') {
                setVerbPattern(null);
                setStatus(verbDir === 'recognition' ? 'verbrecognition' : 'verbforms');
              }
              else if (training === 'verbpreps') setStatus('verbpreps');
              else if (training === 'new') setStatus('newwords');
              else if (training === 'pronouns') setStatus('pronouns');
              else if (training === 'grammar') setStatus('grammar');
              else loadQueue(limit, training === 'leeches');
            }}
            className="mt-2 min-w-[160px]"
          >
            {t('review_lobby_start')} →
          </Button>
        </main>
      </div>
    );
  }

  // ── Loading ──────────────────────────────────────────────────────────────────
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
        <Button onClick={() => loadQueue(limit)}>
          <RotateCw className="size-4 mr-2" />
          {t('upload_retry')}
        </Button>
      </div>
    );
  }

  if (status === 'empty') {
    // Для трудных слов — своё сообщение и возврат в лобби
    if (training === 'leeches') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
          <h1 className="text-2xl font-semibold">{t('review_leeches_empty')}</h1>
          <div className="flex gap-3 mt-2">
            <Button variant="outline" onClick={() => setStatus('lobby')}>{t('gramex_back')}</Button>
            <Button asChild>
              <Link href="/">{t('btn_home')}</Link>
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">{t('review_empty')}</h1>
        <p className="text-muted-foreground max-w-md">{t('review_empty_desc')}</p>
        <div className="flex flex-wrap justify-center gap-3 mt-2">
          {/* Nichts fällig, aber neue Wörter vorhanden → direkt zum Kennenlernen */}
          {!!totalNew && (
            <Button onClick={() => { setTraining('new'); setStatus('newwords'); }}>
              {t('review_goto_new')} ({totalNew})
            </Button>
          )}
          <Button asChild variant={totalNew ? 'outline' : 'default'}>
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
          <Button onClick={() => setStatus('lobby')}>
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

  // Для grammar_rule и sentence — всегда режим карточки (ввод не применим)
  const effectiveMode: Mode =
    mode === 'typing' && (current.kind === 'grammar_rule' || current.kind === 'sentence')
      ? 'cards'
      : mode;

  // RU→DE только для слов и фраз — правило/предложение переворачивать бессмысленно
  const reversed =
    direction === 'ru-de' && (current.kind === 'vocab' || current.kind === 'phrase');

  return (
    // fixed inset-0 вырывается из layout (pb-16), полностью перекрывает viewport
    // и не даёт браузеру показывать page-level scroll
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <header className="shrink-0 flex items-center gap-2 border-b px-4 py-3 sm:px-6">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/" aria-label={t('review_close_label')}>
            <X className="size-5" />
          </Link>
        </Button>

        <span className="flex-1 text-center text-sm tabular-nums text-muted-foreground">
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
      <main className="flex-1 min-h-0 overflow-y-auto [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <div className="flex flex-col items-center justify-center min-h-full p-4 gap-6">
          {/* Карточка — в режиме ввода показываем только лицевую сторону до проверки */}
          {effectiveMode === 'cards' ? (
            <SwipeCard
              onSwipeLeft={flipped ? () => handleRate(1) : undefined}
              onSwipeRight={flipped ? () => handleRate(4) : () => setFlipped(true)}
              leftLabel={flipped ? `✗ ${t('review_again')}` : undefined}
              rightLabel={flipped ? `✓ ${t('review_easy')}` : `👁 ${t('review_answer')}`}
              disabled={submitting}
            >
              <ReviewCard card={current} flipped={flipped} reversed={reversed} />
            </SwipeCard>
          ) : (
            <ReviewCard card={current} flipped={false} reversed={reversed} />
          )}

          {effectiveMode === 'cards' && !flipped && (
            <Button size="lg" onClick={() => setFlipped(true)}>
              {t('review_show_answer')}
              <kbd className="ml-2 rounded bg-black/20 px-1.5 py-0.5 text-xs font-mono hidden sm:inline">Space</kbd>
            </Button>
          )}

          {effectiveMode === 'typing' && (
            <TypingInput
              key={current.id}
              correctAnswer={reversed ? current.front : current.back}
              hint={reversed ? t('review_type_hint_de') : t('review_type_hint')}
              intervals={current.intervals}
              onRate={handleRate}
              disabled={submitting}
              extra={(
                <div className="flex flex-col gap-4">
                  <div className="rounded-lg border bg-card p-4">
                    <p className="text-lg font-medium">
                      {current.gender ? `${current.gender} ` : ''}{current.gender ? stripArticle(current.front) : current.front}
                      {current.plural && <span className="text-sm text-muted-foreground"> · {t('revcard_plural')} {current.plural}</span>}
                    </p>
                    <CardForms card={current} />
                  </div>
                  <CardExtras card={current} />
                </div>
              )}
            />
          )}
        </div>
      </main>

      {/* Оценки — всегда внизу экрана, не в скролл-зоне */}
      {effectiveMode === 'cards' && flipped && (
        <footer className="shrink-0 border-t p-4 sm:p-6 bg-background/95 backdrop-blur">
          <div className="max-w-3xl mx-auto">
            <RatingButtons intervals={current.intervals} onRate={handleRate} disabled={submitting} />
          </div>
        </footer>
      )}
    </div>
  );
}

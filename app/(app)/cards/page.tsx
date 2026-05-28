'use client';

import React, { useEffect, useState, useCallback, Fragment, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2, ChevronLeft, ChevronRight, X, Check, ExternalLink, Plus, Sparkles, ScanSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatInterval } from '@/lib/format/intervals';
import { CreateCardDialog } from '@/components/create-card-dialog';
import { useI18n } from '@/lib/i18n/context';

type CardKind = 'vocab' | 'phrase' | 'grammar_rule' | 'sentence';

type Card = {
  id: string;
  kind: CardKind;
  front: string;
  back: string;
  word_type: string | null;
  gender: string | null;
  plural: string | null;
  examples: { de: string; ru: string }[] | null;
  due_at: string | null;
  reps: number;
  lapses: number;
  created_at: string;
  tags: string[];
  source_id: string | null;
};

type CardsResponse = {
  cards: Card[];
  total: number;
  page: number;
  limit: number;
};

type EditDraft = { front: string; back: string; tags: string };

const KIND_BADGE_CLASS: Record<CardKind, string> = {
  vocab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  phrase: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  grammar_rule: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  sentence: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const LIMIT = 50;

export default function CardsPage() {
  const { t } = useI18n();

  const KIND_LABELS: Record<string, string> = {
    all: t('cards_kind_all'),
    vocab: t('cards_kind_vocab'),
    phrase: t('cards_kind_phrase'),
    grammar_rule: t('cards_kind_grammar'),
    sentence: t('cards_kind_sentence'),
  };

  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [kind, setKind] = useState<string>('all');
  const [tag, setTag] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Duplicates
  type DupePair = {
    id1: string; front1: string; back1: string; kind1: string;
    id2: string; front2: string; back2: string; kind2: string;
    score: number;
  };
  const [dupesOpen, setDupesOpen] = useState(false);
  const [dupesLoading, setDupesLoading] = useState(false);
  const [dupePairs, setDupePairs] = useState<DupePair[]>([]);
  const [dupesError, setDupesError] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichingBatch, setEnrichingBatch] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ front: '', back: '', tags: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  // `/` key focuses search
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== '/') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchCards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (kind !== 'all') params.set('kind', kind);
      if (tag) params.set('tag', tag);

      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CardsResponse = await res.json();
      setCards(data.cards);
      setTotal(data.total);
    } catch (e) {
      toast.error(t('cards_load_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, kind, tag, t]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [kind, tag]);

  // ── Inline edit helpers ──────────────────────────────────────────────────────

  function startEdit(card: Card) {
    setEditingId(card.id);
    setEditDraft({
      front: card.front,
      back: card.back,
      tags: (card.tags ?? []).join(', '),
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(card: Card) {
    const frontChanged = editDraft.front.trim() !== card.front;
    const backChanged = editDraft.back.trim() !== card.back;

    if (
      (frontChanged || backChanged) &&
      !window.confirm(t('cards_fsrs_confirm'))
    ) {
      return;
    }

    setSavingEdit(true);
    try {
      const tags = editDraft.tags
        .split(',')
        .map((tg) => tg.trim())
        .filter(Boolean);

      const res = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          front: editDraft.front.trim(),
          back: editDraft.back.trim(),
          tags,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...data.card } : c)));
      toast.success(t('cards_saved'));
      setEditingId(null);
    } catch (e) {
      toast.error(t('cards_save_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setSavingEdit(false);
    }
  }

  // ── Enrich (single) ─────────────────────────────────────────────────────────

  async function handleEnrich(card: Card) {
    setEnrichingId(card.id);
    try {
      const res = await fetch(`/api/cards/${card.id}/enrich`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, ...data.card } : c)));
      toast.success(t('cards_enrich_ok'), {
        description: `${data.card.word_type ?? ''} ${data.card.gender ?? ''} ${card.front}`.trim(),
      });
    } catch (e) {
      toast.error(t('cards_enrich_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setEnrichingId(null);
    }
  }

  // ── Enrich (batch) ───────────────────────────────────────────────────────────

  async function handleEnrichBatch() {
    const unenriched = cards.filter((c) => !c.examples?.length);
    if (!unenriched.length) {
      toast.info(t('cards_enrich_all_done'));
      return;
    }
    const n = unenriched.length;
    const estSec = Math.round(n * 4.5);
    const estMin = estSec >= 60 ? `~${Math.ceil(estSec / 60)} мин` : `~${estSec}с`;
    toast.info(`${t('cards_enriching')} ${n} (${estMin})`, { duration: estSec * 1000 });
    setEnrichingBatch(true);
    try {
      const res = await fetch('/api/cards/enrich-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: unenriched.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);

      type BatchResult = { id: string; ok: boolean; error?: string };

      if (data.succeeded === 0) {
        const firstErr = data.results?.find((r: BatchResult) => !r.ok)?.error;
        toast.error(t('cards_enrich_batch_fail'), { description: firstErr ?? t('cards_check_gemini') });
      } else {
        toast.success(`${t('cards_enrich_ok')} ${data.succeeded} / ${data.total}`);
        const failed: BatchResult[] = (data.results ?? []).filter((r: BatchResult) => !r.ok);
        if (failed.length > 0) {
          const names = failed
            .map((r) => unenriched.find((c) => c.id === r.id)?.front ?? '?')
            .slice(0, 5)
            .join(', ');
          const uniqueErrors = [...new Set(failed.map((r) => r.error).filter(Boolean))];
          toast.warning(`${failed.length} ${t('cards_enrich_batch_fail')}`, {
            description: names + (failed.length > 5 ? '…' : '') + (uniqueErrors.length ? ` — ${uniqueErrors[0]}` : ''),
            duration: 12000,
          });
        }
      }
      fetchCards();
    } catch (e) {
      toast.error(t('cards_enrich_batch_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setEnrichingBatch(false);
    }
  }

  // ── Find duplicates ──────────────────────────────────────────────────────────

  async function openDupes() {
    setDupesOpen(true);
    setDupesError(false);
    setDupesLoading(true);
    try {
      const res = await fetch('/api/cards/duplicates');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDupePairs(data.pairs ?? []);
    } catch {
      setDupesError(true);
    } finally {
      setDupesLoading(false);
    }
  }

  async function deleteDupe(id: string) {
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setDupePairs((prev) => prev.filter((p) => p.id1 !== id && p.id2 !== id));
      toast.success(t('cards_deleted'));
      fetchCards();
    } catch {
      toast.error(t('cards_delete_error'));
    }
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!window.confirm(t('cards_delete_confirm'))) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(t('cards_deleted'));
      fetchCards();
    } catch (e) {
      toast.error(t('cards_delete_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  function highlight(text: string, query: string): React.ReactNode {
    if (!query) return text;
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const splitRegex = new RegExp(`(${escaped})`, 'gi');
    const matchRegex = new RegExp(`^${escaped}$`, 'i');
    const parts = text.split(splitRegex);
    return parts.map((part, i) =>
      matchRegex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200/80 dark:bg-yellow-800/60 rounded-sm px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  }

  const unenrichedCount = cards.filter((c) => !c.examples?.length).length;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t('cards_title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('cards_subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {cards.length > 0 && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={openDupes}
                title={t('cards_find_dupes')}
              >
                <ScanSearch className="size-4 mr-1.5" />
                {t('cards_find_dupes')}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleEnrichBatch}
                disabled={enrichingBatch || loading}
              >
                {enrichingBatch ? (
                  <Loader2 className="size-4 mr-1.5 animate-spin" />
                ) : (
                  <Sparkles className="size-4 mr-1.5" />
                )}
                {enrichingBatch
                  ? t('cards_enriching')
                  : `${t('cards_enrich_batch')}${unenrichedCount ? ` (${unenrichedCount})` : ''}`}
              </Button>
            </>
          )}
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4 mr-1.5" />
            {t('cards_add')}
          </Button>
        </div>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:max-w-xs">
          <Input
            ref={searchRef}
            placeholder={t('cards_search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn('pr-8', search && 'pr-8')}
          />
          {search && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                searchRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={t('cards_clear_search')}
            >
              <X className="size-4" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(KIND_LABELS).map(([k, label]) => (
            <Button
              key={k}
              variant={kind === k ? 'default' : 'outline'}
              size="sm"
              onClick={() => setKind(k)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Active tag chip */}
      {tag && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('cards_tag_label')}</span>
          <Badge
            variant="secondary"
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => setTag('')}
          >
            {tag}
            <X className="size-3" />
          </Badge>
        </div>
      )}

      {/* Count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          {total === 0 ? t('cards_none') : `${t('cards_found')} ${total}`}
        </p>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      ) : cards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <p className="text-lg font-medium">{t('cards_none')}</p>
          <p className="text-sm text-muted-foreground">{t('cards_empty_subtitle')}</p>
          <Button asChild>
            <Link href="/upload">{t('cards_upload_btn')}</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">{t('cards_col_type')}</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">{t('cards_col_word')}</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">{t('cards_col_translation')}</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">{t('cards_col_tags')}</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">{t('cards_col_due')}</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">{t('cards_col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cards.map((card) => (
                <Fragment key={card.id}>
                  {/* ── Card row ── */}
                  <tr
                    className={cn(
                      'hover:bg-muted/30 transition-colors',
                      editingId === card.id && 'bg-primary/5',
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASS[card.kind] ?? ''}`}
                      >
                        {KIND_LABELS[card.kind] ?? card.kind}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-medium max-w-[180px] truncate">
                      {debouncedSearch ? highlight(card.front, debouncedSearch) : card.front}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[180px] truncate">
                      {debouncedSearch ? highlight(card.back, debouncedSearch) : card.back}
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {card.tags?.map((tg) => (
                          <Badge
                            key={tg}
                            variant="outline"
                            className="text-xs cursor-pointer hover:bg-primary/20"
                            onClick={() => {
                              setTag(tg);
                              setPage(0);
                            }}
                          >
                            {tg}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell tabular-nums">
                      {card.due_at ? formatInterval(card.due_at) : '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-1">
                        {/* AI Enrich */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'size-7',
                            card.examples?.length
                              ? 'text-muted-foreground/50 hover:text-amber-400'
                              : 'text-amber-500 hover:text-amber-400',
                          )}
                          onClick={() => handleEnrich(card)}
                          disabled={enrichingId === card.id || enrichingBatch}
                          aria-label={t('cards_enrich_ai')}
                          title={card.examples?.length ? t('cards_enrich_again') : t('cards_enrich_new')}
                        >
                          {enrichingId === card.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="size-3.5" />
                          )}
                        </Button>
                        {/* Inline edit toggle */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'size-7',
                            editingId === card.id && 'text-primary bg-primary/10',
                          )}
                          onClick={() => (editingId === card.id ? cancelEdit() : startEdit(card))}
                          aria-label={editingId === card.id ? t('cards_edit_close') : t('cards_edit_open')}
                        >
                          {editingId === card.id ? (
                            <X className="size-3.5" />
                          ) : (
                            <Pencil className="size-3.5" />
                          )}
                        </Button>
                        {/* Delete */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(card.id)}
                          disabled={deletingId === card.id}
                          aria-label={t('cards_delete')}
                        >
                          {deletingId === card.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* ── Inline edit panel ── */}
                  {editingId === card.id && (
                    <tr>
                      <td colSpan={6} className="bg-muted/20 px-3 py-4 border-b border-primary/10">
                        <div className="flex flex-col gap-3 max-w-2xl">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                {t('cards_edit_label_front')}
                              </label>
                              <Input
                                value={editDraft.front}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, front: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(card);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                                autoFocus
                              />
                            </div>
                            <div className="grid gap-1">
                              <label className="text-xs font-medium text-muted-foreground">
                                {t('cards_edit_label_back')}
                              </label>
                              <Input
                                value={editDraft.back}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, back: e.target.value }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit(card);
                                  if (e.key === 'Escape') cancelEdit();
                                }}
                              />
                            </div>
                          </div>
                          <div className="grid gap-1">
                            <label className="text-xs font-medium text-muted-foreground">
                              {t('cards_edit_label_tags')}
                            </label>
                            <Input
                              value={editDraft.tags}
                              onChange={(e) =>
                                setEditDraft((d) => ({ ...d, tags: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdit(card);
                                if (e.key === 'Escape') cancelEdit();
                              }}
                              placeholder={t('cards_edit_tags_placeholder')}
                              className="sm:max-w-xs"
                            />
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => saveEdit(card)}
                              disabled={savingEdit || !editDraft.front.trim() || !editDraft.back.trim()}
                            >
                              {savingEdit ? (
                                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Check className="size-3.5 mr-1.5" />
                              )}
                              {t('cards_edit_save')}
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEdit}>
                              {t('cards_edit_cancel')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="ml-auto text-muted-foreground text-xs gap-1"
                              asChild
                            >
                              <Link href={`/cards/${card.id}`}>
                                {t('cards_edit_advanced')}
                                <ExternalLink className="size-3" />
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || loading}
          >
            <ChevronLeft className="size-4 mr-1" />
            {t('cards_prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('cards_page_label')} {page + 1} {t('cards_page_of')} {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            {t('cards_next')}
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      )}

      <CreateCardDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchCards}
      />

      {/* ── Duplicates dialog ── */}
      <Dialog open={dupesOpen} onOpenChange={setDupesOpen}>
        <DialogContent showCloseButton className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('cards_dupes_title')}</DialogTitle>
            <DialogDescription>{t('cards_dupes_subtitle')}</DialogDescription>
          </DialogHeader>

          {dupesLoading && (
            <div className="flex items-center justify-center gap-2 py-10">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">{t('cards_dupes_scanning')}</span>
            </div>
          )}

          {!dupesLoading && dupesError && (
            <p className="text-sm text-destructive py-6 text-center">{t('cards_dupes_error')}</p>
          )}

          {!dupesLoading && !dupesError && dupePairs.length === 0 && (
            <p className="text-center py-10 text-muted-foreground">{t('cards_dupes_empty')}</p>
          )}

          {!dupesLoading && !dupesError && dupePairs.length > 0 && (
            <div className="flex flex-col divide-y">
              {dupePairs.map((pair) => (
                <div key={`${pair.id1}-${pair.id2}`} className="py-3 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      {Math.round(pair.score * 100)}% {t('cards_dupes_similarity')}
                    </span>
                  </div>
                  {/* Карточка 1 */}
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{pair.front1}</p>
                      <p className="text-xs text-muted-foreground truncate">{pair.back1}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteDupe(pair.id1)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                  {/* Карточка 2 */}
                  <div className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{pair.front2}</p>
                      <p className="text-xs text-muted-foreground truncate">{pair.back2}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteDupe(pair.id2)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

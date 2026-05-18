'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, Pencil, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatInterval } from '@/lib/format/intervals';

type CardKind = 'vocab' | 'phrase' | 'grammar_rule' | 'sentence';

type Card = {
  id: string;
  kind: CardKind;
  front: string;
  back: string;
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

const KIND_LABELS: Record<string, string> = {
  all: 'Все',
  vocab: 'Слова',
  phrase: 'Фразы',
  grammar_rule: 'Грамматика',
  sentence: 'Предложения',
};

const KIND_BADGE_CLASS: Record<CardKind, string> = {
  vocab: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  phrase: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  grammar_rule: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  sentence: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const LIMIT = 50;

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [kind, setKind] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      const res = await fetch(`/api/cards?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: CardsResponse = await res.json();
      setCards(data.cards);
      setTotal(data.total);
    } catch (e) {
      toast.error('Не удалось загрузить карты', {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, kind]);

  useEffect(() => {
    fetchCards();
  }, [fetchCards]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [kind]);

  async function handleDelete(id: string) {
    if (!window.confirm('Удалить карту? Это действие нельзя отменить.')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success('Карта удалена');
      fetchCards();
    } catch (e) {
      toast.error('Не удалось удалить карту', {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setDeletingId(null);
    }
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Карты</h1>
        <p className="mt-1 text-sm text-muted-foreground">Все флешкарты базы данных</p>
      </header>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Поиск по слову или переводу..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
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

      {/* Count */}
      {!loading && (
        <p className="text-sm text-muted-foreground">
          {total === 0 ? 'Нет карт' : `Найдено: ${total}`}
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
          <p className="text-lg font-medium">Нет карт</p>
          <p className="text-sm text-muted-foreground">Загрузи скрин учебника — приложение создаст карточки.</p>
          <Button asChild>
            <Link href="/upload">Загрузить скрин</Link>
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Тип</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Слово</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden sm:table-cell">Перевод</th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground hidden md:table-cell">До повтора</th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${KIND_BADGE_CLASS[card.kind] ?? ''}`}
                    >
                      {KIND_LABELS[card.kind] ?? card.kind}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 font-medium max-w-[180px] truncate">{card.front}</td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell max-w-[180px] truncate">
                    {card.back}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell tabular-nums">
                    {card.due_at ? formatInterval(card.due_at) : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" asChild className="size-7">
                        <Link href={`/cards/${card.id}`} aria-label="Редактировать">
                          <Pencil className="size-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(card.id)}
                        disabled={deletingId === card.id}
                        aria-label="Удалить"
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
            Назад
          </Button>
          <span className="text-sm text-muted-foreground">
            Страница {page + 1} из {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1 || loading}
          >
            Вперёд
            <ChevronRight className="size-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

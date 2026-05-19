'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { BookOpen, ChevronLeft, Dumbbell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { GrammarExerciseSession } from '@/components/grammar-exercise-session';
import { GrammarSentenceBuilder } from '@/components/grammar-sentence-builder';
import { cn } from '@/lib/utils';

type GrammarNote = {
  id: string;
  title: string;
  explanation: string;
  examples: { de: string; ru: string }[] | null;
  tags: string[];
  source_id: string | null;
  created_at: string;
};

type Tab = 'rules' | 'exercises';
type ExerciseMode = 'fill' | 'builder';

/** Простой markdown-рендер: параграфы по \n\n, **bold** */
function renderMarkdown(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const content = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      const lines = part.split('\n');
      return (
        <span key={j}>
          {lines.map((line, k) => (
            <span key={k}>
              {line}
              {k < lines.length - 1 && <br />}
            </span>
          ))}
        </span>
      );
    });
    return <p key={i} className="not-last:mb-3">{content}</p>;
  });
}

export default function GrammarPage() {
  const [notes, setNotes] = useState<GrammarNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('rules');
  const [activeNote, setActiveNote] = useState<{ id: string; title: string } | null>(null);
  const [exerciseMode, setExerciseMode] = useState<ExerciseMode | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/grammar');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setNotes(data.grammar_notes ?? []);
      } catch (e) {
        toast.error('Не удалось загрузить грамматику', {
          description: e instanceof Error ? e.message : '',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = search
    ? notes.filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.explanation.toLowerCase().includes(search.toLowerCase()),
      )
    : notes;

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Грамматика</h1>
        <p className="mt-1 text-sm text-muted-foreground">Правила и интерактивные упражнения</p>
      </header>

      {/* ── Tab switcher ── */}
      <div className="flex rounded-lg border overflow-hidden w-fit">
        <button
          onClick={() => { setTab('rules'); setActiveNote(null); setExerciseMode(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm transition-colors',
            tab === 'rules'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <BookOpen className="size-3.5" />
          Правила
        </button>
        <button
          onClick={() => { setTab('exercises'); setActiveNote(null); setExerciseMode(null); }}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm transition-colors border-l',
            tab === 'exercises'
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted',
          )}
        >
          <Dumbbell className="size-3.5" />
          Упражнения
        </button>
      </div>

      {/* ══════════════════════════ TAB: ПРАВИЛА ══════════════════════════════ */}
      {tab === 'rules' && (
        <>
          <Input
            placeholder="Поиск по заголовку или тексту..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />

          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-lg font-medium">
                {notes.length === 0 ? 'Грамматических заметок пока нет.' : 'Ничего не найдено.'}
              </p>
              {notes.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Загрузи скрин страницы учебника с грамматикой.
                </p>
              )}
            </div>
          ) : (
            <Accordion type="multiple" className="rounded-lg border divide-y">
              {filtered.map((note) => (
                <AccordionItem key={note.id} value={note.id} className="border-0 px-4">
                  <AccordionTrigger className="text-base font-medium py-3.5">
                    {note.title}
                    {note.tags.length > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {note.tags.join(', ')}
                      </span>
                    )}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="text-sm text-foreground/90 leading-relaxed">
                      {renderMarkdown(note.explanation)}
                    </div>

                    {note.examples && note.examples.length > 0 && (
                      <div className="mt-4 flex flex-col gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Примеры
                        </p>
                        {note.examples.map((ex, i) => (
                          <div key={i} className="text-sm">
                            <span className="font-medium">{ex.de}</span>
                            <span className="text-muted-foreground"> · {ex.ru}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick-launch exercises from within the rule */}
                    <div className="mt-4 pt-3 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveNote({ id: note.id, title: note.title });
                          setExerciseMode(null);
                          setTab('exercises');
                        }}
                      >
                        <Dumbbell className="size-3.5 mr-1.5" />
                        Потренироваться
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </>
      )}

      {/* ════════════════════════ TAB: УПРАЖНЕНИЯ ════════════════════════════ */}
      {tab === 'exercises' && (
        <>
          {/* Fill-in-the-blank session */}
          {activeNote && exerciseMode === 'fill' && (
            <GrammarExerciseSession
              noteId={activeNote.id}
              noteTitle={activeNote.title}
              onBack={() => { setExerciseMode(null); }}
            />
          )}

          {/* Sentence builder session */}
          {activeNote && exerciseMode === 'builder' && (
            <GrammarSentenceBuilder
              noteId={activeNote.id}
              noteTitle={activeNote.title}
              onBack={() => { setExerciseMode(null); }}
            />
          )}

          {/* Mode picker — shown when topic selected but no mode yet */}
          {activeNote && exerciseMode === null && (
            <div className="flex flex-col gap-5 max-w-sm">
              <div>
                <p className="text-sm text-muted-foreground">Тема:</p>
                <p className="font-medium mt-0.5">{activeNote.title}</p>
              </div>
              <p className="text-sm font-medium">Выбери режим:</p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setExerciseMode('fill')}
                  className="flex-1 flex flex-col items-center gap-2 rounded-xl border px-5 py-4 text-sm font-medium hover:bg-muted/60 transition-colors"
                >
                  <span className="text-2xl">📝</span>
                  Заполни пропуск
                </button>
                <button
                  onClick={() => setExerciseMode('builder')}
                  className="flex-1 flex flex-col items-center gap-2 rounded-xl border px-5 py-4 text-sm font-medium hover:bg-muted/60 transition-colors"
                >
                  <span className="text-2xl">🔀</span>
                  Составь предложение
                </button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="self-start"
                onClick={() => { setActiveNote(null); setExerciseMode(null); }}
              >
                <ChevronLeft className="size-4 mr-1" />
                К темам
              </Button>
            </div>
          )}

          {/* Topic picker — shown when no active note */}
          {!activeNote && (
            <div className="flex flex-col gap-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))
              ) : notes.length === 0 ? (
                <div className="py-20 text-center">
                  <p className="text-lg font-medium">Нет грамматических тем</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Загрузи скрин учебника, чтобы создать первые правила.
                  </p>
                </div>
              ) : (
                notes.map((note) => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{note.title}</p>
                      {note.tags.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {note.tags.join(', ')}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        setActiveNote({ id: note.id, title: note.title });
                        setExerciseMode(null);
                      }}
                    >
                      <Dumbbell className="size-3.5 mr-1.5" />
                      Тренировать
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

type GrammarNote = {
  id: string;
  title: string;
  explanation: string;
  examples: { de: string; ru: string }[] | null;
  tags: string[];
  source_id: string | null;
  created_at: string;
};

/** Простой markdown-рендер: параграфы по \n\n, **bold** */
function renderMarkdown(text: string): React.ReactNode[] {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.map((para, i) => {
    // Replace **text** with <strong>
    const parts = para.split(/(\*\*[^*]+\*\*)/g);
    const content = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      }
      // Preserve single line breaks
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
        <p className="mt-1 text-sm text-muted-foreground">Грамматические правила и заметки</p>
      </header>

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
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}

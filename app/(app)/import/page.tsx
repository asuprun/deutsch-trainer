'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

type PreviewRow = { front: string; back: string; example: string; tags: string[] };

type Preview = {
  total: number;
  separator: string;
  preview: PreviewRow[];
};

type ExportJson = {
  source_title?: string;
  cards?: { front: string; back: string; examples?: { de: string; ru: string }[] | null; tags?: string[] | null }[];
  grammar_notes?: { title: string; explanation: string; examples?: { de: string; ru: string }[] | null; tags?: string[] | null }[];
};

/** Блок ```json … ``` из чата → объект, иначе null (тогда это обычный список слов) */
function parseExportJson(text: string): ExportJson | null {
  const s = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
  if (!s.startsWith('{')) return null;
  try {
    const o = JSON.parse(s);
    return Array.isArray(o.cards) || Array.isArray(o.grammar_notes) ? o : null;
  } catch {
    return null;
  }
}

type Stage = 'idle' | 'previewing' | 'preview' | 'importing' | 'done';

export default function ImportPage() {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imported, setImported] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [pasted, setPasted] = useState('');
  // JSON из команды /export в чате Claude — идёт напрямую в bulk-create
  const [jsonBody, setJsonBody] = useState<ExportJson | null>(null);

  const sepLabel: Record<string, string> = {
    tab: t('import_sep_tab'),
    ',': t('import_sep_comma'),
    ';': t('import_sep_semicolon'),
    '|': t('import_sep_pipe'),
  };

  async function handleFile(f: File) {
    setFile(f);
    setStage('previewing');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const res = await fetch('/api/import/csv?preview=1', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      setPreview(data);
      setStage('preview');
    } catch (e) {
      toast.error(t('import_read_error'), {
        description: e instanceof Error ? e.message : '',
      });
      setStage('idle');
      setFile(null);
    }
  }

  function handlePasted() {
    const j = parseExportJson(pasted);
    if (!j) {
      handleFile(new File([pasted], t('import_pasted_name'), { type: 'text/plain' }));
      return;
    }
    const cards = j.cards ?? [];
    const notes = j.grammar_notes ?? [];
    setJsonBody(j);
    setFile(null);
    setPreview({
      total: cards.length + notes.length,
      separator: 'JSON',
      preview: [
        ...notes.map((g) => ({ front: g.title, back: g.explanation.slice(0, 120), example: g.examples?.[0]?.de ?? '', tags: g.tags ?? [] })),
        ...cards.map((c) => ({ front: c.front, back: c.back, example: c.examples?.[0]?.de ?? '', tags: c.tags ?? [] })),
      ].slice(0, 10),
    });
    setStage('preview');
  }

  async function handleImport() {
    if (jsonBody) {
      setStage('importing');
      try {
        const res = await fetch('/api/cards/bulk-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(jsonBody),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
        setImported(data.counts.cards);
        setStage('done');
      } catch (e) {
        toast.error(t('import_error'), { description: e instanceof Error ? e.message : '' });
        setStage('preview');
      }
      return;
    }
    if (!file) return;
    setStage('importing');
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/import/csv', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      setImported(data.imported);
      setStage('done');
    } catch (e) {
      toast.error(t('import_error'), {
        description: e instanceof Error ? e.message : '',
      });
      setStage('preview');
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{t('import_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('import_subtitle_html').split('<strong>').map((chunk, i) => {
            if (i === 0) return chunk;
            const [bold, rest] = chunk.split('</strong>');
            return <span key={i}><strong>{bold}</strong>{rest}</span>;
          })}
        </p>
      </header>

      {/* Format hint */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
        <p className="font-medium">{t('import_format_title')}</p>
        <pre className="mt-2 text-xs text-muted-foreground font-mono bg-background rounded p-2 overflow-x-auto">{`Hund\tсобака\tnoun::A1
gehen\tидти\tverb
der Drucker | принтер | Der Drucker druckt nicht.`}</pre>
        <p className="text-muted-foreground pt-1">
          {t('import_format_hint')} <strong>{t('import_format_col1')}</strong> | <strong>{t('import_format_col2')}</strong> | {t('import_format_col3')}
        </p>
      </div>

      {/* Drop zone */}
      {stage === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 cursor-pointer transition-colors',
            dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30',
          )}
        >
          <FileText className="size-10 text-muted-foreground" />
          <div className="text-center">
            <p className="font-medium">{t('import_drop_label')}</p>
            <p className="text-sm text-muted-foreground mt-1">{t('import_drop_hint')}</p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.tsv,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>
      )}

      {/* Вставка списка из чата — превращаем в файл и идём тем же путём */}
      {stage === 'idle' && (
        <div className="flex flex-col gap-2">
          <textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={t('import_paste_placeholder')}
            aria-label={t('import_paste_placeholder')}
            rows={6}
            className="w-full rounded-md border bg-background p-3 font-mono text-sm"
          />
          <Button
            variant="outline"
            className="self-start"
            disabled={!pasted.trim()}
            onClick={handlePasted}
          >
            {t('import_paste_button')}
          </Button>
        </div>
      )}

      {/* Previewing */}
      {stage === 'previewing' && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {t('import_reading')}
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && preview && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline">{preview.total} {t('import_cards_count')}</Badge>
            <Badge variant="outline">{t('import_sep_label')} {sepLabel[preview.separator] ?? preview.separator}</Badge>
            <span className="text-sm text-muted-foreground">{file?.name}</span>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('import_col_german')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">{t('import_col_translation')}</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">{t('import_col_tags')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.preview.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{row.front}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.back}
                      {row.example && <div className="text-xs italic">{row.example}</div>}
                    </td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {row.tags.map((tg) => (
                        <Badge key={tg} variant="outline" className="text-xs mr-1">{tg}</Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.total > 10 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                {t('import_more_rows')} {preview.total - 10} {t('import_cards_count')}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleImport}>
              <Upload className="size-4 mr-2" />
              {t('import_do_import')} {preview.total} {t('import_cards_count')}
            </Button>
            <Button variant="outline" onClick={() => { setStage('idle'); setFile(null); setPreview(null); setJsonBody(null); }}>
              {t('import_choose_other')}
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          {t('import_importing')}
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <div>
            <p className="text-xl font-semibold">{t('import_done_title')}</p>
            <p className="text-muted-foreground mt-1">{t('import_done_added')} {imported}</p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button onClick={() => router.push('/cards')}>{t('import_view_cards')}</Button>
            <Button variant="outline" onClick={() => { setStage('idle'); setFile(null); setPreview(null); setJsonBody(null); setImported(0); }}>
              {t('import_import_more')}
            </Button>
          </div>
        </div>
      )}

      {/* Hint about FSRS */}
      {stage === 'idle' && (
        <div className="flex gap-2 text-sm text-muted-foreground items-start rounded-md bg-muted/30 p-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <p>
            {t('import_fsrs_note').split('<strong>').map((chunk, i) => {
              if (i === 0) return chunk;
              const [bold, rest] = chunk.split('</strong>');
              return <span key={i}><strong>{bold}</strong>{rest}</span>;
            })}
          </p>
        </div>
      )}
    </div>
  );
}

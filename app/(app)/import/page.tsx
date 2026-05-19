'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Upload, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type PreviewRow = { front: string; back: string; tags: string[] };

type Preview = {
  total: number;
  separator: string;
  preview: PreviewRow[];
};

type Stage = 'idle' | 'previewing' | 'preview' | 'importing' | 'done';

export default function ImportPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [imported, setImported] = useState(0);
  const [dragOver, setDragOver] = useState(false);

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
      toast.error('Не удалось прочитать файл', {
        description: e instanceof Error ? e.message : '',
      });
      setStage('idle');
      setFile(null);
    }
  }

  async function handleImport() {
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
      toast.error('Ошибка импорта', {
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

  const sepLabel: Record<string, string> = { tab: 'табуляция (TSV)', ',': 'запятая (CSV)', ';': 'точка с запятой' };

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-3xl">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Импорт из Anki</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Экспортируй колоду из Anki: <strong>File → Export → Notes in Plain Text (.txt)</strong>,
          убери галочку «HTML», нажми Export. Затем загрузи файл сюда.
        </p>
      </header>

      {/* Инструкция */}
      <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-1">
        <p className="font-medium">Ожидаемый формат файла:</p>
        <pre className="mt-2 text-xs text-muted-foreground font-mono bg-background rounded p-2 overflow-x-auto">{`Hund\tсобака\tnoun::A1
gehen\tидти\tverb
auf jeden Fall\tв любом случае`}</pre>
        <p className="text-muted-foreground pt-1">
          Колонки: <strong>Немецкий</strong> | <strong>Перевод</strong> | Теги (необязательно, через ::)
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
            <p className="font-medium">Перетащи файл или нажми для выбора</p>
            <p className="text-sm text-muted-foreground mt-1">.txt, .tsv, .csv</p>
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

      {/* Previewing */}
      {stage === 'previewing' && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Читаю файл…
        </div>
      )}

      {/* Preview */}
      {stage === 'preview' && preview && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge variant="outline">{preview.total} карт</Badge>
            <Badge variant="outline">Разделитель: {sepLabel[preview.separator] ?? preview.separator}</Badge>
            <span className="text-sm text-muted-foreground">{file?.name}</span>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Немецкий</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Перевод</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground hidden sm:table-cell">Теги</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.preview.map((row, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    <td className="px-3 py-2 font-medium">{row.front}</td>
                    <td className="px-3 py-2 text-muted-foreground">{row.back}</td>
                    <td className="px-3 py-2 hidden sm:table-cell">
                      {row.tags.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs mr-1">{t}</Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.total > 10 && (
              <p className="px-3 py-2 text-xs text-muted-foreground border-t">
                …и ещё {preview.total - 10} карт
              </p>
            )}
          </div>

          <div className="flex gap-3">
            <Button onClick={handleImport}>
              <Upload className="size-4 mr-2" />
              Импортировать {preview.total} карт
            </Button>
            <Button variant="outline" onClick={() => { setStage('idle'); setFile(null); setPreview(null); }}>
              Выбрать другой файл
            </Button>
          </div>
        </div>
      )}

      {/* Importing */}
      {stage === 'importing' && (
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
          Импортирую карты…
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="flex flex-col items-center gap-4 py-10 text-center">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <div>
            <p className="text-xl font-semibold">Импорт завершён</p>
            <p className="text-muted-foreground mt-1">Добавлено карт: {imported}</p>
          </div>
          <div className="flex gap-3 mt-2">
            <Button onClick={() => router.push('/cards')}>Смотреть карты</Button>
            <Button variant="outline" onClick={() => { setStage('idle'); setFile(null); setPreview(null); setImported(0); }}>
              Импортировать ещё
            </Button>
          </div>
        </div>
      )}

      {/* Hint about FSRS */}
      {stage === 'idle' && (
        <div className="flex gap-2 text-sm text-muted-foreground items-start rounded-md bg-muted/30 p-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" />
          <p>
            Импортированные карты создаются как <strong>новые</strong> — прогресс повторений из Anki не переносится.
            Все карты будут в очереди на повторение с сегодняшнего дня.
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Sparkles, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UploadZone } from '@/components/upload-zone';
import { ExtractPreview, type Selection } from '@/components/extract-preview';
import type { ExtractPayload } from '@/lib/gemini/prompts';
import { useI18n } from '@/lib/i18n/context';

type ExtractResponse = {
  source_id: string;
  image_path: string;
  image_hash: string;
  preview: ExtractPayload;
  cached: boolean;
};

type Status = 'idle' | 'extracting' | 'preview' | 'saving' | 'error';

function defaultSelection(preview: ExtractPayload): Selection {
  const all = (n: number) => new Set(Array.from({ length: n }, (_, i) => i));
  return {
    words: all(preview.words.length),
    phrases: all(preview.phrases.length),
    grammar: all(preview.grammar.length),
    sentences: all(preview.sentences.length),
  };
}

function totalSelected(s: Selection): number {
  return s.words.size + s.phrases.size + s.grammar.size + s.sentences.size;
}

function buildBody(extract: ExtractResponse, sel: Selection) {
  const cards = [
    ...Array.from(sel.words)
      .sort((a, b) => a - b)
      .map((i) => {
        const w = extract.preview.words[i];
        const tags = w.level ? [w.level] : [];
        return {
          kind: 'vocab' as const,
          front: w.de,
          back: w.ru,
          word_type: w.word_type || null,
          gender: w.gender || null,
          plural: w.plural || null,
          forms: w.forms ?? null,
          tags,
        };
      }),
    ...Array.from(sel.phrases)
      .sort((a, b) => a - b)
      .map((i) => {
        const p = extract.preview.phrases[i];
        return {
          kind: 'phrase' as const,
          front: p.de,
          back: p.ru,
          tags: p.level ? [p.level] : [],
        };
      }),
    ...Array.from(sel.sentences)
      .sort((a, b) => a - b)
      .map((i) => {
        const s = extract.preview.sentences[i];
        return {
          kind: 'sentence' as const,
          front: s.de,
          back: s.ru,
        };
      }),
  ];

  const grammar_notes = Array.from(sel.grammar)
    .sort((a, b) => a - b)
    .map((i) => {
      const g = extract.preview.grammar[i];
      return {
        title: g.title,
        explanation: g.explanation_md,
        examples: g.examples ?? null,
      };
    });

  return { source_id: extract.source_id, cards, grammar_notes };
}

export default function UploadPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [extract, setExtract] = useState<ExtractResponse | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);

  async function handleFile(file: File) {
    setLastFile(file);
    setStatus('extracting');
    setError(null);
    const fd = new FormData();
    fd.append('image', file);
    try {
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data: ExtractResponse = await res.json();
      setExtract(data);
      setSelection(defaultSelection(data.preview));
      setStatus('preview');
      if (data.cached) toast.info(t('upload_cached'));
    } catch (e) {
      setStatus('error');
      const msg = e instanceof Error ? e.message : t('upload_unknown_error');
      setError(msg);
      toast.error(t('upload_extract_error'), { description: msg });
    }
  }

  function resetAll() {
    setExtract(null);
    setSelection(null);
    setStatus('idle');
    setError(null);
    setLastFile(null);
  }

  async function handleSave() {
    if (!extract || !selection) return;
    const body = buildBody(extract, selection);
    if (body.cards.length === 0 && body.grammar_notes.length === 0) {
      toast.error(t('upload_select_min'));
      return;
    }
    setStatus('saving');
    setError(null);
    try {
      const res = await fetch('/api/cards/bulk-create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      toast.success(`${t('upload_saved')} ${data.counts.cards} ${t('upload_saved_cards')} ${data.counts.grammar} ${t('upload_saved_grammar')}`);
      router.push(`/cards?source_id=${extract.source_id}`);
    } catch (e) {
      setStatus('preview');
      const msg = e instanceof Error ? e.message : t('upload_unknown_error');
      setError(msg);
      toast.error(`${t('upload_save_error')} ${msg}`);
    }
  }

  const selectedCount = selection ? totalSelected(selection) : 0;

  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">{t('upload_title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t('upload_subtitle')}
        </p>
      </header>

      {status === 'idle' && (
        <UploadZone onFile={handleFile} />
      )}

      {status === 'extracting' && (
        <Alert>
          <Loader2 className="size-4 animate-spin" />
          <AlertDescription>
            {t('upload_extracting')}
          </AlertDescription>
        </Alert>
      )}

      {status === 'error' && (
        <div className="flex flex-col gap-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <div className="flex gap-3">
            <Button
              onClick={() => lastFile && handleFile(lastFile)}
              disabled={!lastFile}
            >
              {t('upload_retry')}
            </Button>
            <Button variant="outline" onClick={resetAll}>
              {t('upload_another')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {t('upload_error_hint')}
          </p>
        </div>
      )}

      {(status === 'preview' || status === 'saving') && extract && selection && (
        <>
          <ExtractPreview preview={extract.preview} selection={selection} onChange={setSelection} />

          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="sticky bottom-0 -mx-6 px-6 py-3 border-t bg-background/95 backdrop-blur flex items-center gap-3">
            <Button
              variant="outline"
              onClick={resetAll}
              disabled={status === 'saving'}
            >
              {t('upload_another')}
            </Button>
            <div className="flex-1" />
            <Button onClick={handleSave} disabled={status === 'saving' || selectedCount === 0}>
              {status === 'saving' ? (
                <>
                  <Loader2 className="size-4 animate-spin mr-2" />
                  {t('upload_saving')}
                </>
              ) : (
                <>
                  <Save className="size-4 mr-2" />
                  {t('upload_save_btn')} {selectedCount}
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

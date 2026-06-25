'use client';

import { useState } from 'react';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { useI18n } from '@/lib/i18n/context';

type GeneratedCard = {
  front: string;
  back: string;
  word_type?: string | null;
  gender?: string | null;
  plural?: string | null;
  forms?: Record<string, string> | null;
  examples?: { de: string; ru: string }[] | null;
  tags?: string[] | null;
};

type Step = 'input' | 'preview';

interface QuickAddWordsProps {
  open: boolean;
  onClose: () => void;
  onSaved: (count: number) => void;
}

export function QuickAddWords({ open, onClose, onSaved }: QuickAddWordsProps) {
  const { t } = useI18n();
  const [step, setStep] = useState<Step>('input');
  const [text, setText] = useState('');
  const [cards, setCards] = useState<GeneratedCard[]>([]);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const words = text
    .split('\n')
    .map((w) => w.trim())
    .filter(Boolean)
    .slice(0, 30);

  async function handleGenerate() {
    if (words.length === 0) return;
    setGenerating(true);
    setGenError(null);
    try {
      const res = await fetch('/api/cards/generate-from-words', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      setCards(data.cards ?? []);
      setStep('preview');
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t('quick_add_error'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (cards.length === 0) return;
    setSaving(true);
    try {
      const title = words.slice(0, 3).join(', ') + (words.length > 3 ? '…' : '');
      const res = await fetch('/api/cards/save-quick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, cards }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      // Reset state
      setText('');
      setCards([]);
      setStep('input');
      onSaved(data.count ?? cards.length);
      onClose();
    } catch (e) {
      setGenError(e instanceof Error ? e.message : t('quick_add_error'));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (generating || saving) return;
    setText('');
    setCards([]);
    setStep('input');
    setGenError(null);
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent side="bottom" className="h-[85vh] flex flex-col gap-0 p-0" showCloseButton={false}>
        <SheetHeader className="px-4 pt-4 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            {step === 'preview' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setStep('input')}
                disabled={saving}
                aria-label={t('quick_add_back')}
              >
                <ChevronLeft className="size-5" />
              </Button>
            )}
            <div className="flex-1">
              <SheetTitle>{t('quick_add_title')}</SheetTitle>
              {step === 'input' && (
                <SheetDescription className="mt-0.5">{t('quick_add_hint')}</SheetDescription>
              )}
              {step === 'preview' && (
                <SheetDescription className="mt-0.5">
                  {t('quick_add_preview')} · {cards.length} {t('quick_add_word_count')}
                </SheetDescription>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} disabled={generating || saving}>
              <span className="text-lg leading-none">×</span>
            </Button>
          </div>
        </SheetHeader>

        {step === 'input' && (
          <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {words.length > 0 ? `${words.length} ${t('quick_add_word_count')}` : ''}
              </span>
              <span className="text-xs text-muted-foreground">max 30</span>
            </div>
            <textarea
              className="flex-1 min-h-0 resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder={`fragen\ngehen\nder Hund\nschnell`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={generating}
            />
            {genError && (
              <p className="text-sm text-destructive">{genError}</p>
            )}
            <Button
              onClick={handleGenerate}
              disabled={words.length === 0 || generating}
              className="w-full"
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('quick_add_generating')}
                </>
              ) : (
                t('quick_add_generate')
              )}
            </Button>
          </div>
        )}

        {step === 'preview' && (
          <div className="flex flex-col flex-1 min-h-0 p-4 gap-4">
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-3 pr-1">
              {cards.map((card, i) => (
                <div key={i} className="rounded-lg border px-3 py-2.5 flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm leading-snug">{card.front}</p>
                    {card.word_type && (
                      <span className="text-xs text-muted-foreground shrink-0">{card.word_type}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{card.back}</p>
                  {card.tags && card.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {card.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs px-1.5 py-0">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {genError && (
              <p className="text-sm text-destructive">{genError}</p>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || cards.length === 0}
              className="w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  {t('quick_add_saving')}
                </>
              ) : (
                `${t('quick_add_save')} ${cards.length} ${t('quick_add_word_count')}`
              )}
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

'use client';

import React, { useState } from 'react';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n/context';

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
};

export function CreateCardDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useI18n();
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [kind, setKind] = useState<'vocab' | 'phrase' | 'grammar_rule' | 'sentence'>('vocab');
  const [gender, setGender] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);

  const KIND_OPTIONS = [
    { value: 'vocab', label: t('create_kind_vocab') },
    { value: 'phrase', label: t('create_kind_phrase') },
    { value: 'grammar_rule', label: t('create_kind_grammar') },
    { value: 'sentence', label: t('create_kind_sentence') },
  ];

  const GENDER_OPTIONS = [
    { value: '', label: '—' },
    { value: 'der', label: 'der' },
    { value: 'die', label: 'die' },
    { value: 'das', label: 'das' },
  ];

  function reset() {
    setFront('');
    setBack('');
    setKind('vocab');
    setGender('');
    setTags('');
  }

  function handleOpenChange(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!front.trim() || !back.trim()) return;

    setSaving(true);
    try {
      const tagsArr = tags
        .split(',')
        .map((tg) => tg.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        front: front.trim(),
        back: back.trim(),
        kind,
        tags: tagsArr,
      };

      if (kind === 'vocab' && gender) {
        body.gender = gender;
      }

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }

      toast.success(t('create_created'));
      onCreated();
      handleOpenChange(false);
    } catch (e) {
      toast.error(t('create_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('create_title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 py-2">
          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              {t('create_label_german')} <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder="das Haus, gehen..."
              value={front}
              onChange={(e) => setFront(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">
              {t('create_label_translation')} <span className="text-destructive">*</span>
            </label>
            <Input
              placeholder={t('create_translation_placeholder')}
              value={back}
              onChange={(e) => setBack(e.target.value)}
              required
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">{t('create_label_kind')}</label>
            <select
              value={kind}
              onChange={(e) =>
                setKind(e.target.value as 'vocab' | 'phrase' | 'grammar_rule' | 'sentence')
              }
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {KIND_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {kind === 'vocab' && (
            <div className="grid gap-1.5">
              <label className="text-sm font-medium">{t('create_label_article')}</label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {GENDER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid gap-1.5">
            <label className="text-sm font-medium">{t('create_label_tags')}</label>
            <Input
              placeholder={t('create_tags_placeholder')}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t('create_tags_hint')}</p>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              {t('create_cancel')}
            </Button>
            <Button
              type="submit"
              disabled={!front.trim() || !back.trim() || saving}
            >
              {saving && <Loader2 className="size-3.5 mr-1.5 animate-spin" />}
              {t('create_save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

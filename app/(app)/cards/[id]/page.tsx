'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Plus, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n/context';

type Example = { de: string; ru: string };

type Card = {
  id: string;
  kind: string;
  front: string;
  back: string;
  word_type: string | null;
  gender: string | null;
  plural: string | null;
  forms: Record<string, unknown> | null;
  examples: Example[] | null;
  mnemonic: string | null;
  tags: string[];
  due_at: string | null;
  reps: number;
  lapses: number;
  source_id: string | null;
};

type PageProps = { params: Promise<{ id: string }> };

export default function CardEditPage({ params }: PageProps) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();

  const [card, setCard] = useState<Card | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);

  // Form state
  const [front, setFront] = useState('');
  const [back, setBack] = useState('');
  const [wordType, setWordType] = useState('');
  const [gender, setGender] = useState('');
  const [plural, setPlural] = useState('');
  const [mnemonic, setMnemonic] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [examples, setExamples] = useState<Example[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cards/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const c: Card = data.card;
        setCard(c);
        setFront(c.front);
        setBack(c.back);
        setWordType(c.word_type ?? '');
        setGender(c.gender ?? '');
        setPlural(c.plural ?? '');
        setMnemonic(c.mnemonic ?? '');
        setTagsInput((c.tags ?? []).join(', '));
        setExamples(c.examples ?? []);
      } catch (e) {
        toast.error(t('card_load_error'), {
          description: e instanceof Error ? e.message : '',
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id, t]);

  async function handleSave() {
    if (!card) return;

    const frontChanged = front !== card.front;
    const backChanged = back !== card.back;

    if ((frontChanged || backChanged) && !window.confirm(t('cards_fsrs_confirm'))) {
      return;
    }

    setSaving(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((tg) => tg.trim())
        .filter(Boolean);

      const body: Record<string, unknown> = {
        front,
        back,
        word_type: wordType || null,
        gender: gender || null,
        plural: plural || null,
        mnemonic: mnemonic || null,
        tags,
        examples,
      };

      const res = await fetch(`/api/cards/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      setCard(data.card);
      toast.success(t('card_saved'));
    } catch (e) {
      toast.error(t('card_save_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleEnrich() {
    setEnriching(true);
    try {
      const res = await fetch(`/api/cards/${id}/enrich`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      const newExamples: Example[] = data.card?.examples ?? [];
      setExamples(newExamples);
      toast.success(t('card_generate_ok'));
    } catch (e) {
      toast.error(t('card_generate_error'), {
        description: e instanceof Error ? e.message : '',
      });
    } finally {
      setEnriching(false);
    }
  }

  function addExample() {
    setExamples((prev) => [...prev, { de: '', ru: '' }]);
  }

  function removeExample(idx: number) {
    setExamples((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateExample(idx: number, field: 'de' | 'ru', value: string) {
    setExamples((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: value } : ex)));
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6 max-w-2xl">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (!card) {
    return (
      <div className="p-6">
        <p className="text-destructive">{t('card_not_found')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/cards')}>
          ← {t('card_back_to_cards')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/cards" aria-label={t('card_back_to_cards')}>
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">{t('card_title')}</h1>
      </div>

      <div className="flex flex-col gap-4">
        {/* front */}
        <div className="grid gap-1.5">
          <Label htmlFor="front">{t('card_label_front')}</Label>
          <Input id="front" value={front} onChange={(e) => setFront(e.target.value)} />
        </div>

        {/* back */}
        <div className="grid gap-1.5">
          <Label htmlFor="back">{t('card_label_back')}</Label>
          <Input id="back" value={back} onChange={(e) => setBack(e.target.value)} />
        </div>

        {/* word_type */}
        <div className="grid gap-1.5">
          <Label htmlFor="word_type">{t('card_label_word_type')}</Label>
          <select
            id="word_type"
            value={wordType}
            onChange={(e) => setWordType(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{t('card_word_type_none')}</option>
            <option value="noun">{t('card_word_type_noun')}</option>
            <option value="verb">{t('card_word_type_verb')}</option>
            <option value="adjective">{t('card_word_type_adjective')}</option>
            <option value="adverb">{t('card_word_type_adverb')}</option>
            <option value="preposition">{t('card_word_type_preposition')}</option>
            <option value="conjunction">{t('card_word_type_conjunction')}</option>
            <option value="phrase">{t('card_word_type_phrase')}</option>
            <option value="other">{t('card_word_type_other')}</option>
          </select>
        </div>

        {/* gender */}
        <div className="grid gap-1.5">
          <Label htmlFor="gender">{t('card_label_gender')}</Label>
          <select
            id="gender"
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">{t('card_gender_none')}</option>
            <option value="der">{t('card_gender_der')}</option>
            <option value="die">{t('card_gender_die')}</option>
            <option value="das">{t('card_gender_das')}</option>
          </select>
        </div>

        {/* plural */}
        <div className="grid gap-1.5">
          <Label htmlFor="plural">{t('card_label_plural')}</Label>
          <Input id="plural" value={plural} onChange={(e) => setPlural(e.target.value)} placeholder="die Häuser" />
        </div>

        {/* mnemonic */}
        <div className="grid gap-1.5">
          <Label htmlFor="mnemonic">{t('card_label_mnemonic')}</Label>
          <Input id="mnemonic" value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} placeholder={t('card_mnemonic_placeholder')} />
        </div>

        {/* tags */}
        <div className="grid gap-1.5">
          <Label htmlFor="tags">{t('card_label_tags')}</Label>
          <Input
            id="tags"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder={t('card_tags_placeholder')}
          />
        </div>

        {/* Examples */}
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>{t('card_label_examples')}</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleEnrich}
              disabled={enriching}
            >
              {enriching ? (
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              ) : (
                <Sparkles className="size-3.5 mr-1.5" />
              )}
              {t('card_generate')}
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            {examples.map((ex, i) => (
              <div key={i} className="flex items-start gap-2 rounded-md border p-3">
                <div className="flex-1 flex flex-col gap-1.5">
                  <Input
                    value={ex.de}
                    onChange={(e) => updateExample(i, 'de', e.target.value)}
                    placeholder={t('card_de_placeholder')}
                    className="text-sm"
                  />
                  <Input
                    value={ex.ru}
                    onChange={(e) => updateExample(i, 'ru', e.target.value)}
                    placeholder={t('card_ru_placeholder')}
                    className="text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 mt-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => removeExample(i)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={addExample} className="w-fit">
            <Plus className="size-3.5 mr-1.5" />
            {t('card_add_example')}
          </Button>
        </div>

        {/* FSRS info */}
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          {t('card_reps')} {card.reps} · {t('card_lapses')} {card.lapses}
          {card.due_at && ` · ${t('card_due')} ${new Date(card.due_at).toLocaleDateString('ru-RU')}`}
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-2 animate-spin" />}
            {t('card_save')}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/cards">{t('card_cancel')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

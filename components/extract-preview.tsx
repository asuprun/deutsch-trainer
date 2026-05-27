'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type {
  ExtractPayload,
  ExtractedWord,
  ExtractedPhrase,
  ExtractedGrammar,
  ExtractedSentence,
} from '@/lib/gemini/prompts';
import { useI18n } from '@/lib/i18n/context';

export type Selection = {
  words: Set<number>;
  phrases: Set<number>;
  grammar: Set<number>;
  sentences: Set<number>;
};

type Props = {
  preview: ExtractPayload;
  selection: Selection;
  onChange: (next: Selection) => void;
};

function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

function toggle<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function toggleAll(indexes: number[], current: Set<number>): Set<number> {
  return indexes.every((i) => current.has(i)) ? new Set() : new Set(indexes);
}

const GENDER_COLOR: Record<string, string> = {
  der: 'text-blue-400',
  die: 'text-pink-400',
  das: 'text-emerald-400',
};

export function ExtractPreview({ preview, selection, onChange }: Props) {
  const { t } = useI18n();
  const counts = {
    words: preview.words.length,
    phrases: preview.phrases.length,
    grammar: preview.grammar.length,
    sentences: preview.sentences.length,
  };

  return (
    <div className="flex flex-col gap-4">
      {preview.summary && (
        <p className="text-sm text-muted-foreground">{preview.summary}</p>
      )}
      {preview.error && (
        <p className="text-sm text-destructive">⚠ {preview.error}</p>
      )}

      <Tabs defaultValue="words">
        <TabsList>
          <TabsTrigger value="words">{t('preview_tab_words')} · {counts.words}</TabsTrigger>
          <TabsTrigger value="phrases">{t('preview_tab_phrases')} · {counts.phrases}</TabsTrigger>
          <TabsTrigger value="grammar">{t('preview_tab_grammar')} · {counts.grammar}</TabsTrigger>
          <TabsTrigger value="sentences">{t('preview_tab_sentences')} · {counts.sentences}</TabsTrigger>
        </TabsList>

        <TabsContent value="words" className="mt-4">
          <WordsList
            words={preview.words}
            selected={selection.words}
            onToggle={(i) => onChange({ ...selection, words: toggle(selection.words, i) })}
            onToggleAll={() => onChange({ ...selection, words: toggleAll(range(counts.words), selection.words) })}
            selectedLabel={t('preview_selected_of')}
            ofLabel={t('preview_of')}
            deselectAllLabel={t('preview_deselect_all')}
            selectAllLabel={t('preview_select_all')}
            emptyLabel={t('preview_empty_words')}
            pluralLabel={t('preview_plural_label')}
            verbSepLabel={t('preview_verb_sep')}
          />
        </TabsContent>
        <TabsContent value="phrases" className="mt-4">
          <PhrasesList
            phrases={preview.phrases}
            selected={selection.phrases}
            onToggle={(i) => onChange({ ...selection, phrases: toggle(selection.phrases, i) })}
            onToggleAll={() => onChange({ ...selection, phrases: toggleAll(range(counts.phrases), selection.phrases) })}
            selectedLabel={t('preview_selected_of')}
            ofLabel={t('preview_of')}
            deselectAllLabel={t('preview_deselect_all')}
            selectAllLabel={t('preview_select_all')}
            emptyLabel={t('preview_empty_phrases')}
          />
        </TabsContent>
        <TabsContent value="grammar" className="mt-4">
          <GrammarList
            grammar={preview.grammar}
            selected={selection.grammar}
            onToggle={(i) => onChange({ ...selection, grammar: toggle(selection.grammar, i) })}
            onToggleAll={() => onChange({ ...selection, grammar: toggleAll(range(counts.grammar), selection.grammar) })}
            selectedLabel={t('preview_selected_of')}
            ofLabel={t('preview_of')}
            deselectAllLabel={t('preview_deselect_all')}
            selectAllLabel={t('preview_select_all')}
            emptyLabel={t('preview_empty_grammar')}
          />
        </TabsContent>
        <TabsContent value="sentences" className="mt-4">
          <SentencesList
            sentences={preview.sentences}
            selected={selection.sentences}
            onToggle={(i) => onChange({ ...selection, sentences: toggle(selection.sentences, i) })}
            onToggleAll={() => onChange({ ...selection, sentences: toggleAll(range(counts.sentences), selection.sentences) })}
            selectedLabel={t('preview_selected_of')}
            ofLabel={t('preview_of')}
            deselectAllLabel={t('preview_deselect_all')}
            selectAllLabel={t('preview_select_all')}
            emptyLabel={t('preview_empty_sentences')}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionHeader({
  total,
  selected,
  onToggleAll,
  selectedLabel,
  ofLabel,
  deselectAllLabel,
  selectAllLabel,
}: {
  total: number;
  selected: number;
  onToggleAll: () => void;
  selectedLabel: string;
  ofLabel: string;
  deselectAllLabel: string;
  selectAllLabel: string;
}) {
  if (total === 0) return null;
  return (
    <div className="flex items-center justify-between border-b pb-2 mb-2 text-sm text-muted-foreground">
      <span>{selectedLabel} {selected} {ofLabel} {total}</span>
      <button onClick={onToggleAll} className="hover:underline">
        {selected === total ? deselectAllLabel : selectAllLabel}
      </button>
    </div>
  );
}

function EmptyState({ kind }: { kind: string }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{kind}</p>;
}

function WordsList({
  words,
  selected,
  onToggle,
  onToggleAll,
  selectedLabel,
  ofLabel,
  deselectAllLabel,
  selectAllLabel,
  emptyLabel,
  pluralLabel,
  verbSepLabel,
}: {
  words: ExtractedWord[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: () => void;
  selectedLabel: string;
  ofLabel: string;
  deselectAllLabel: string;
  selectAllLabel: string;
  emptyLabel: string;
  pluralLabel: string;
  verbSepLabel: string;
}) {
  if (words.length === 0) return <EmptyState kind={emptyLabel} />;
  return (
    <div>
      <SectionHeader
        total={words.length}
        selected={selected.size}
        onToggleAll={onToggleAll}
        selectedLabel={selectedLabel}
        ofLabel={ofLabel}
        deselectAllLabel={deselectAllLabel}
        selectAllLabel={selectAllLabel}
      />
      <ul className="flex flex-col gap-1">
        {words.map((w, i) => {
          const genderClass = w.gender && GENDER_COLOR[w.gender];
          const id = `word-${i}`;
          return (
            <li key={i} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/30">
              <Checkbox id={id} checked={selected.has(i)} onCheckedChange={() => onToggle(i)} className="mt-1" />
              <label htmlFor={id} className="flex-1 cursor-pointer min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  {w.gender && <span className={genderClass}>{w.gender}</span>}
                  <span className="font-medium">{w.de}</span>
                  {w.plural && <span className="text-xs text-muted-foreground">{pluralLabel} {w.plural}</span>}
                  {w.level && <Badge variant="outline" className="ml-auto text-xs">{w.level}</Badge>}
                </div>
                <div className="text-sm text-muted-foreground">{w.ru}</div>
                {w.forms?.infinitiv && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {w.forms.infinitiv} · {w.forms.praeteritum} · {w.forms.partizip_2}
                    {w.forms.hilfsverb && ` · ${w.forms.hilfsverb}`}
                    {w.forms.trennbar && ` · ${verbSepLabel}`}
                  </div>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PhrasesList({
  phrases,
  selected,
  onToggle,
  onToggleAll,
  selectedLabel,
  ofLabel,
  deselectAllLabel,
  selectAllLabel,
  emptyLabel,
}: {
  phrases: ExtractedPhrase[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: () => void;
  selectedLabel: string;
  ofLabel: string;
  deselectAllLabel: string;
  selectAllLabel: string;
  emptyLabel: string;
}) {
  if (phrases.length === 0) return <EmptyState kind={emptyLabel} />;
  return (
    <div>
      <SectionHeader
        total={phrases.length}
        selected={selected.size}
        onToggleAll={onToggleAll}
        selectedLabel={selectedLabel}
        ofLabel={ofLabel}
        deselectAllLabel={deselectAllLabel}
        selectAllLabel={selectAllLabel}
      />
      <ul className="flex flex-col gap-1">
        {phrases.map((p, i) => {
          const id = `phrase-${i}`;
          return (
            <li key={i} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/30">
              <Checkbox id={id} checked={selected.has(i)} onCheckedChange={() => onToggle(i)} className="mt-1" />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <div className="font-medium">{p.de}</div>
                <div className="text-sm text-muted-foreground">{p.ru}</div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function GrammarList({
  grammar,
  selected,
  onToggle,
  onToggleAll,
  selectedLabel,
  ofLabel,
  deselectAllLabel,
  selectAllLabel,
  emptyLabel,
}: {
  grammar: ExtractedGrammar[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: () => void;
  selectedLabel: string;
  ofLabel: string;
  deselectAllLabel: string;
  selectAllLabel: string;
  emptyLabel: string;
}) {
  if (grammar.length === 0) return <EmptyState kind={emptyLabel} />;
  return (
    <div>
      <SectionHeader
        total={grammar.length}
        selected={selected.size}
        onToggleAll={onToggleAll}
        selectedLabel={selectedLabel}
        ofLabel={ofLabel}
        deselectAllLabel={deselectAllLabel}
        selectAllLabel={selectAllLabel}
      />
      <ul className="flex flex-col gap-2">
        {grammar.map((g, i) => {
          const id = `grammar-${i}`;
          return (
            <li key={i} className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox id={id} checked={selected.has(i)} onCheckedChange={() => onToggle(i)} className="mt-1" />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <div className="font-semibold">{g.title}</div>
                <div className="mt-1 text-sm whitespace-pre-wrap">{g.explanation_md}</div>
                {g.examples && g.examples.length > 0 && (
                  <ul className="mt-2 flex flex-col gap-1 text-sm">
                    {g.examples.map((e, j) => (
                      <li key={j}>
                        <span className="font-medium">{e.de}</span>
                        <span className="text-muted-foreground"> — {e.ru}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SentencesList({
  sentences,
  selected,
  onToggle,
  onToggleAll,
  selectedLabel,
  ofLabel,
  deselectAllLabel,
  selectAllLabel,
  emptyLabel,
}: {
  sentences: ExtractedSentence[];
  selected: Set<number>;
  onToggle: (i: number) => void;
  onToggleAll: () => void;
  selectedLabel: string;
  ofLabel: string;
  deselectAllLabel: string;
  selectAllLabel: string;
  emptyLabel: string;
}) {
  if (sentences.length === 0) return <EmptyState kind={emptyLabel} />;
  return (
    <div>
      <SectionHeader
        total={sentences.length}
        selected={selected.size}
        onToggleAll={onToggleAll}
        selectedLabel={selectedLabel}
        ofLabel={ofLabel}
        deselectAllLabel={deselectAllLabel}
        selectAllLabel={selectAllLabel}
      />
      <ul className="flex flex-col gap-1">
        {sentences.map((s, i) => {
          const id = `sentence-${i}`;
          return (
            <li key={i} className="flex items-start gap-3 rounded-md p-2 hover:bg-muted/30">
              <Checkbox id={id} checked={selected.has(i)} onCheckedChange={() => onToggle(i)} className="mt-1" />
              <label htmlFor={id} className="flex-1 cursor-pointer">
                <div className="font-medium">{s.de}</div>
                <div className="text-sm text-muted-foreground">{s.ru}</div>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

'use client';

import { useEffect } from 'react';
import { TTSButton } from '@/components/tts-button';
import { Badge } from '@/components/ui/badge';
import { useTTSContext } from '@/lib/tts-context';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n/context';

const GENDER_COLOR: Record<string, string> = {
  der: 'text-blue-400',
  die: 'text-pink-400',
  das: 'text-emerald-400',
};

export type ReviewCardData = {
  id: string;
  kind: 'vocab' | 'phrase' | 'grammar_rule' | 'sentence';
  front: string;
  back: string;
  word_type?: string | null;
  gender?: string | null;
  plural?: string | null;
  forms?: Record<string, unknown> | null;
  examples?: Array<{ de: string; ru: string }> | null;
  mnemonic?: string | null;
  tags?: string[] | null;
};

type Props = {
  card: ReviewCardData;
  flipped: boolean;
  autoTts?: boolean;
};

export function ReviewCard({ card, flipped, autoTts = true }: Props) {
  const { t } = useI18n();
  const { speak } = useTTSContext();

  // Word type abbreviation labels
  const WORD_TYPE_LABEL: Record<string, string> = {
    noun:  t('revcard_wt_noun'),
    verb:  t('revcard_wt_verb'),
    adj:   t('revcard_wt_adj'),
    adv:   t('revcard_wt_adv'),
    prep:  t('revcard_wt_prep'),
    conj:  t('revcard_wt_conj'),
    pron:  t('revcard_wt_pron'),
    num:   t('revcard_wt_num'),
    interj: t('revcard_wt_interj'),
    other: '',
  };

  useEffect(() => {
    if (flipped && autoTts && card.front) {
      const timer = setTimeout(() => speak(card.front), 150);
      return () => clearTimeout(timer);
    }
  }, [flipped, card.id, card.front, speak, autoTts]);

  const genderClass = card.gender ? GENDER_COLOR[card.gender] : undefined;
  const wordTypeLabel = card.word_type ? WORD_TYPE_LABEL[card.word_type] : '';
  const forms = card.forms as
    | {
        infinitiv?: string;
        praeteritum?: string;
        partizip_2?: string;
        hilfsverb?: string;
        trennbar?: boolean;
        komparativ?: string;
        superlativ?: string;
      }
    | null
    | undefined;

  return (
    <div className="w-full [perspective:1200px]">
      {/* Flip container */}
      <div
        className={cn(
          'relative w-full transition-transform duration-500 [transform-style:preserve-3d]',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        {/* FRONT */}
        <div className="w-full [backface-visibility:hidden] bg-background">
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-baseline justify-center gap-3 flex-wrap text-center w-full">
              {card.gender && (
                <span className={cn('font-serif text-3xl sm:text-4xl', genderClass)}>{card.gender}</span>
              )}
              <h2 className="font-serif font-medium leading-tight tracking-tight min-w-0 [overflow-wrap:anywhere] [font-size:clamp(1.25rem,7vw,3rem)]">
                {card.front}
              </h2>
              <TTSButton text={card.front} size="icon" />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {wordTypeLabel && <span>{wordTypeLabel}</span>}
              {card.plural && <span>· {t('revcard_plural')} {card.plural}</span>}
              {card.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 w-full [backface-visibility:hidden] [transform:rotateY(180deg)] bg-background">
          <div className="flex flex-col items-center gap-6 w-full">
            <div className="flex items-baseline justify-center gap-3 flex-wrap text-center w-full">
              {card.gender && (
                <span className={cn('font-serif text-3xl sm:text-4xl', genderClass)}>{card.gender}</span>
              )}
              <h2 className="font-serif font-medium leading-tight tracking-tight min-w-0 [overflow-wrap:anywhere] [font-size:clamp(1.25rem,7vw,3rem)]">
                {card.front}
              </h2>
              <TTSButton text={card.front} size="icon" />
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {wordTypeLabel && <span>{wordTypeLabel}</span>}
              {card.plural && <span>· {t('revcard_plural')} {card.plural}</span>}
              {card.tags?.map((tag) => (
                <Badge key={tag} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>

            <div className="w-full max-w-xl rounded-lg border bg-card p-4">
              <p className="text-xl">{card.back}</p>

              {forms?.infinitiv && (
                <div className="mt-3 text-sm text-muted-foreground border-t pt-3">
                  {forms.infinitiv} · {forms.praeteritum} · {forms.partizip_2}
                  {forms.hilfsverb && ` · ${forms.hilfsverb}`}
                  {forms.trennbar && ` · ${t('revcard_verb_sep')}`}
                </div>
              )}
              {forms?.komparativ && (
                <div className="mt-3 text-sm text-muted-foreground border-t pt-3">
                  {forms.komparativ} · {forms.superlativ}
                </div>
              )}
            </div>

            {card.examples && card.examples.length > 0 && (
              <div className="w-full max-w-xl space-y-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('revcard_examples')}</p>
                {card.examples.map((ex, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <TTSButton text={ex.de} size="icon" className="size-7 mt-0.5 shrink-0" />
                    <div className="flex flex-col gap-0.5">
                      <div className="font-medium text-[15px] leading-snug">{ex.de}</div>
                      <div className="text-muted-foreground text-[13px]">{ex.ru}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {card.mnemonic && (
              <div className="w-full max-w-xl rounded-md bg-amber-500/10 border border-amber-500/30 p-3 text-sm">
                💡 {card.mnemonic}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

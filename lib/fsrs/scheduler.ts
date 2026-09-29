import 'server-only';
import {
  fsrs as createFsrs,
  generatorParameters,
  Rating,
  type Card,
  type Grade,
} from 'ts-fsrs';

const scheduler = createFsrs(
  generatorParameters({
    enable_fuzz: true,
    request_retention: 0.9,
    // Без шагов обучения в минутах — интервалы сразу в днях
    // (иначе новые карты первые повторения идут через 1м/10м)
    learning_steps: [],
    relearning_steps: [],
  }),
);

/**
 * Сериализованное FSRS состояние в JSONB (даты — ISO строки).
 */
export type CardJson = {
  due: string;
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  state: number;
  last_review?: string | null;
  /** Lernphase: Anzahl erledigter Stufen von LEARN_LADDER_DAYS (fehlt = reines FSRS) */
  ladder?: number | null;
};

/**
 * Lernphase für neue Wörter («1-3-7-14-30»): die ersten Wiederholungen folgen einer
 * festen Leiter (1 Tag → 3 Tage → 1 Woche), danach übernimmt FSRS allein.
 * Grund: FSRS schickt ein frisch gelerntes Wort nach «Gut» sonst für
 * 2 → 11 → 46 Tage weg — zu schnell. FSRS rechnet bei jeder Antwort trotzdem
 * mit (Stabilität/Schwierigkeit); während der Leiter wird nur das Fälligkeits-
 * datum gedeckelt. Die ts-fsrs-learning_steps in Tagen greifen hier nicht.
 */
export const LEARN_LADDER_DAYS = [1, 3, 7, 14, 30] as const;
const DAY_MS = 86_400_000;

// Fällig ab Tagesbeginn (UTC), damit «morgen» auch morgen früh schon zählt
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function applyLadder(prev: CardJson, rating: Grade, next: CardJson, now: Date): CardJson {
  const inLadder = prev.reps === 0 || typeof prev.ladder === 'number';
  if (!inLadder) return next; // bereits vorher gelernte Karten: reines FSRS
  const step = prev.reps === 0 ? 0 : (prev.ladder as number);
  const done = LEARN_LADDER_DAYS.length;
  // Leiter abgeschlossen oder «Leicht»/«Kenne ich schon» → FSRS übernimmt
  if (step >= done || rating === Rating.Easy) return { ...next, ladder: done };

  let cap: number;
  let nextStep: number;
  if (rating === Rating.Again) {
    // vergessen → morgen wieder, danach 3 → 7 Tage
    cap = LEARN_LADDER_DAYS[0];
    nextStep = step >= 1 ? 1 : 0;
  } else if (rating === Rating.Hard) {
    // mit Mühe → Stufe wiederholen statt aufsteigen
    cap = LEARN_LADDER_DAYS[Math.max(step - 1, 0)];
    nextStep = step;
  } else {
    cap = LEARN_LADDER_DAYS[step];
    nextStep = step + 1;
  }
  const capDue = startOfUtcDay(new Date(now.getTime() + cap * DAY_MS));
  const fsrsDue = new Date(next.due);
  const due = fsrsDue < capDue ? fsrsDue : capDue;
  return {
    ...next,
    due: due.toISOString(),
    scheduled_days: Math.max(1, Math.round((due.getTime() - now.getTime()) / DAY_MS)),
    ladder: nextStep,
  };
}

export function jsonToCard(j: CardJson): Card {
  return {
    due: new Date(j.due),
    stability: j.stability,
    difficulty: j.difficulty,
    elapsed_days: j.elapsed_days,
    scheduled_days: j.scheduled_days,
    reps: j.reps,
    lapses: j.lapses,
    state: j.state,
    last_review: j.last_review ? new Date(j.last_review) : undefined,
  } as Card;
}

export function cardToJson(c: Card): CardJson {
  return {
    due: c.due.toISOString(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    state: c.state,
    last_review: c.last_review ? c.last_review.toISOString() : null,
  };
}

export type LogJson = {
  rating: number;
  state: number;
  due: string;
  stability: number;
  difficulty: number;
  scheduled_days: number;
  review: string;
};

export type NextStateResult = {
  state: CardJson;
  due: Date;
  scheduled_days: number;
  log: LogJson;
};

/**
 * Рассчитать новое состояние карты на основе оценки пользователя.
 */
export function nextState(state: CardJson, rating: Grade, now: Date = new Date()): NextStateResult {
  const card = jsonToCard(state);
  const result = scheduler.next(card, now, rating);
  const next = applyLadder(state, rating, cardToJson(result.card), now);
  return {
    state: next,
    due: new Date(next.due),
    scheduled_days: next.scheduled_days,
    log: {
      rating: result.log.rating,
      state: result.log.state,
      due: result.log.due.toISOString(),
      stability: result.log.stability,
      difficulty: result.log.difficulty,
      scheduled_days: result.log.scheduled_days,
      review: result.log.review.toISOString(),
    },
  };
}

/**
 * Превью интервалов для всех 4 ratings — показываются на кнопках UI.
 */
export type IntervalPreview = {
  [K in 1 | 2 | 3 | 4]: { due: string; scheduled_days: number };
};

export function previewIntervals(state: CardJson, now: Date = new Date()): IntervalPreview {
  const card = jsonToCard(state);
  const previews = scheduler.repeat(card, now);
  // gleiche Lernphasen-Logik wie nextState, damit die Buttons die echten Tage zeigen
  const make = (g: Grade) => {
    const next = applyLadder(state, g, cardToJson(previews[g].card), now);
    return { due: next.due, scheduled_days: next.scheduled_days };
  };
  return {
    1: make(Rating.Again),
    2: make(Rating.Hard),
    3: make(Rating.Good),
    4: make(Rating.Easy),
  };
}

export { Rating };
export type { Grade };

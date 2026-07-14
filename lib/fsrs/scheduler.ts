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
};

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
  return {
    state: cardToJson(result.card),
    due: result.card.due,
    scheduled_days: result.card.scheduled_days,
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
  const make = (g: Grade) => ({
    due: previews[g].card.due.toISOString(),
    scheduled_days: previews[g].card.scheduled_days,
  });
  return {
    1: make(Rating.Again),
    2: make(Rating.Hard),
    3: make(Rating.Good),
    4: make(Rating.Easy),
  };
}

export { Rating };
export type { Grade };

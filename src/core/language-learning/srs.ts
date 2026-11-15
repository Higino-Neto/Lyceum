import type { ExerciseType, ReviewItem } from "./model";

/**
 * SuperMemo-2 scheduling (Wozniak, 1990). Grades: 0-5, where < 3 is a lapse.
 * The UI exposes four buttons mapped to 1 (again), 3 (hard), 4 (good), 5 (easy).
 */
export const GRADE = { again: 1, hard: 3, good: 4, easy: 5 } as const;
export type GradeName = keyof typeof GRADE;

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_EASE = 1.3;

export interface ScheduleResult {
  item: ReviewItem;
  intervalBefore: number;
  correct: boolean;
}

export function scheduleReview(item: ReviewItem, grade: number, now: Date = new Date()): ScheduleResult {
  const quality = Math.max(0, Math.min(5, Math.round(grade)));
  const correct = quality >= 3;
  let { easeFactor, intervalDays, repetitions, lapses } = item;
  const intervalBefore = intervalDays;

  if (!correct) {
    repetitions = 0;
    intervalDays = 0;
    lapses += 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(intervalDays * easeFactor);
  }
  easeFactor = Math.max(MIN_EASE, easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  // Lapsed items come back within the same session (10 minutes).
  const dueMs = correct ? now.getTime() + intervalDays * DAY_MS : now.getTime() + 10 * 60 * 1000;

  return {
    correct,
    intervalBefore,
    item: {
      ...item,
      easeFactor: Number(easeFactor.toFixed(3)),
      intervalDays,
      repetitions,
      lapses,
      dueAt: new Date(dueMs).toISOString(),
      lastReviewedAt: now.toISOString(),
    },
  };
}

export function createReviewItem(
  input: Pick<ReviewItem, "language" | "key" | "itemType" | "label"> &
    Partial<Pick<ReviewItem, "translation" | "context" | "contextForm" | "documentId" | "sentenceId">>,
  now: Date = new Date(),
  id: string = `${input.language}:${input.key}`,
): ReviewItem {
  return {
    id,
    language: input.language,
    key: input.key,
    itemType: input.itemType,
    label: input.label,
    translation: input.translation ?? null,
    context: input.context ?? null,
    contextForm: input.contextForm ?? null,
    documentId: input.documentId ?? null,
    sentenceId: input.sentenceId ?? null,
    easeFactor: 2.5,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    dueAt: now.toISOString(),
    createdAt: now.toISOString(),
    lastReviewedAt: null,
  };
}

export function isDue(item: ReviewItem, now: Date = new Date()) {
  return Date.parse(item.dueAt) <= now.getTime();
}

export function dueItems(items: ReviewItem[], now: Date = new Date()) {
  return items.filter((item) => isDue(item, now)).sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));
}

export type RetentionState = "new" | "learning" | "young" | "mature";

export function retentionState(item: ReviewItem): RetentionState {
  if (item.repetitions === 0 && !item.lastReviewedAt) return "new";
  if (item.intervalDays < 1) return "learning";
  if (item.intervalDays < 21) return "young";
  return "mature";
}

export interface ExerciseCapabilities {
  speech: boolean;
}

/** Exercise types that can be built honestly from the data the item has. */
export function availableExercises(item: ReviewItem, capabilities: ExerciseCapabilities): ExerciseType[] {
  const types: ExerciseType[] = ["recognition"];
  if (item.translation) types.push("recall");
  if (item.context && item.contextForm && clozeSentence(item.context, item.contextForm)) types.push("cloze");
  if (capabilities.speech && item.itemType === "lexeme") types.push("listening");
  types.push("production");
  return types;
}

/** Picks an exercise, progressing from recognition to production with maturity. */
export function chooseExercise(item: ReviewItem, capabilities: ExerciseCapabilities, random = Math.random): ExerciseType {
  const types = availableExercises(item, capabilities);
  if (item.repetitions === 0) return "recognition";
  const advanced = types.filter((type) => type !== "recognition");
  const pool = item.repetitions >= 3 ? advanced : types;
  return pool[Math.floor(random() * pool.length)] ?? "recognition";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replaces the first whole-word occurrence of `form` by a gap. */
export function clozeSentence(sentence: string, form: string): { before: string; after: string; answer: string } | null {
  if (!form) return null;
  const pattern = new RegExp(`(^|[^\\p{L}])(${escapeRegExp(form)})(?![\\p{L}])`, "iu");
  const match = pattern.exec(sentence);
  if (!match) return null;
  const start = (match.index ?? 0) + (match[1]?.length ?? 0);
  const answer = match[2] ?? form;
  return { before: sentence.slice(0, start), after: sentence.slice(start + answer.length), answer };
}

function foldAnswer(value: string) {
  return value.normalize("NFC").trim().toLocaleLowerCase().replace(/\s+/g, " ").replace(/[.!?,;:]+$/, "");
}

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/\p{M}/gu, "").replace(/ß/g, "ss");
}

export function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0] ?? 0;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j] ?? 0;
      row[j] = Math.min((row[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length] ?? 0;
}

export type AnswerVerdict = "correct" | "accent" | "typo" | "wrong";

/** Checks a typed answer; accents and single typos are reported, not hidden. */
export function checkAnswer(expected: string | string[], given: string): AnswerVerdict {
  const candidates = (Array.isArray(expected) ? expected : [expected]).map(foldAnswer).filter(Boolean);
  const answer = foldAnswer(given);
  if (!answer) return "wrong";
  if (candidates.includes(answer)) return "correct";
  if (candidates.some((candidate) => stripDiacritics(candidate) === stripDiacritics(answer))) return "accent";
  if (candidates.some((candidate) => candidate.length > 3 && editDistance(candidate, answer) === 1)) return "typo";
  return "wrong";
}

/** Suggested grade for an automatically checked exercise. */
export function gradeForVerdict(verdict: AnswerVerdict): number {
  if (verdict === "correct") return GRADE.good;
  if (verdict === "accent" || verdict === "typo") return GRADE.hard;
  return GRADE.again;
}

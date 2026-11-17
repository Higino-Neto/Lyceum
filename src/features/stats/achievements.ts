/** Milestones computed from reading, library and vocabulary totals. */
export interface AchievementInputs {
  totalPages: number;
  activeDays: number;
  longestStreak: number;
  bestDayPages: number;
  booksFinished: number;
  knownWords: number;
  languages: number;
  annotations: number;
}

export type AchievementGroup = "volume" | "habit" | "books" | "languages";

interface AchievementDefinition {
  id: string;
  group: AchievementGroup;
  metric: keyof AchievementInputs;
  target: number;
}

const DEFINITIONS: AchievementDefinition[] = [
  { id: "pages1k", group: "volume", metric: "totalPages", target: 1_000 },
  { id: "pages10k", group: "volume", metric: "totalPages", target: 10_000 },
  { id: "pages50k", group: "volume", metric: "totalPages", target: 50_000 },
  { id: "marathon", group: "volume", metric: "bestDayPages", target: 200 },
  { id: "streak7", group: "habit", metric: "longestStreak", target: 7 },
  { id: "streak30", group: "habit", metric: "longestStreak", target: 30 },
  { id: "streak100", group: "habit", metric: "longestStreak", target: 100 },
  { id: "days365", group: "habit", metric: "activeDays", target: 365 },
  { id: "books1", group: "books", metric: "booksFinished", target: 1 },
  { id: "books10", group: "books", metric: "booksFinished", target: 10 },
  { id: "books50", group: "books", metric: "booksFinished", target: 50 },
  { id: "annotator", group: "books", metric: "annotations", target: 100 },
  { id: "words1k", group: "languages", metric: "knownWords", target: 1_000 },
  { id: "words5k", group: "languages", metric: "knownWords", target: 5_000 },
  { id: "polyglot", group: "languages", metric: "languages", target: 2 },
];

export interface Achievement {
  id: string;
  group: AchievementGroup;
  current: number;
  target: number;
  ratio: number;
  unlocked: boolean;
}

export function computeAchievements(inputs: AchievementInputs): Achievement[] {
  return DEFINITIONS.map((definition) => {
    const current = Math.max(0, inputs[definition.metric]);
    return {
      id: definition.id,
      group: definition.group,
      current,
      target: definition.target,
      ratio: Math.min(1, current / definition.target),
      unlocked: current >= definition.target,
    };
  });
}

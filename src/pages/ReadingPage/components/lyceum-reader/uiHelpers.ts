import { createContext } from "react";
import type { KnowledgeState } from "../../../../core/language-learning";
import type { Translate, TranslationKey } from "../../../../i18n";

/** Dynamic i18n key with fallback (keys built from data codes). */
export function dynamicT(t: Translate, key: string, options?: Record<string, unknown>, fallback?: string): string {
  return (t as unknown as (k: string, o?: Record<string, unknown>) => string)(key, { defaultValue: fallback ?? "", ...(options ?? {}) });
}

export const STATE_ORDER: KnowledgeState[] = ["unknown", "learning", "known", "ignored"];

const STATE_LABELS: Record<KnowledgeState, TranslationKey> = {
  unknown: "learning:states.unknown",
  learning: "learning:states.learning",
  known: "learning:states.known",
  ignored: "learning:states.ignored",
};

export function stateLabelKey(state: KnowledgeState): TranslationKey {
  return STATE_LABELS[state];
}

export const STATE_DOT: Record<KnowledgeState, string> = {
  unknown: "bg-info",
  learning: "bg-warning",
  known: "bg-success",
  ignored: "bg-foreground-subtle",
};

export function posLabel(t: Translate, pos?: string) {
  return pos ? dynamicT(t, `learning:pos.${pos}`, undefined, pos) : null;
}

export function percent(value: number) {
  return `${value.toFixed(value >= 10 || value === 0 ? 0 : 1)}%`;
}

/** Lets word lookups offer the matching offline dictionary when none is installed. */
export interface DictionaryOfferValue {
  source: string;
  target: string;
  onInstalled(): void;
}

export const DictionaryOfferContext = createContext<DictionaryOfferValue | null>(null);

import { useCallback } from "react";
import type { PackEntry } from "../../../../core/dictionary-packs";
import { useTranslation } from "../../../../i18n";
import { dynamicT } from "./uiHelpers";

let currentAudio: HTMLAudioElement | null = null;

/** Plays a Wiktionary pronunciation recording (one at a time). Resolves false if it cannot play. */
export function playAudio(url: string): Promise<boolean> {
  currentAudio?.pause();
  currentAudio = new Audio(url);
  return currentAudio.play().then(() => true, () => false);
}

/** Localized grammatical label for a Wiktionary tag (`plural` → "plural", `first-person` → "1ª pessoa"). */
export function useDictionaryTag() {
  const { t } = useTranslation();
  return useCallback((tag: string) => dynamicT(t, `learning:dictionary.tags.${tag}`, undefined, tag.replace(/-/g, " ")), [t]);
}

/** Synonyms or antonyms of an entry: sense-level lists first (they are the most specific), then entry-level. */
export function entryRelation(entry: PackEntry, name: string, limit = 16) {
  const words: string[] = [];
  const add = (list?: string[]) => {
    for (const word of list ?? []) if (!words.includes(word) && word !== entry.word) words.push(word);
  };
  for (const sense of entry.senses) add(sense.relations[name]);
  add(entry.relations[name]);
  return words.slice(0, limit);
}

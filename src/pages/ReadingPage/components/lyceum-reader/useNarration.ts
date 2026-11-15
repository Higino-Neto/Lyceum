import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sentenceText, type LinguisticDocument, type OccurrenceIndex } from "../../../../core/language-learning";
import { getSpeechProvider } from "../../../../features/language-learning/speech";

export type NarrationStatus = "idle" | "playing" | "paused";

interface NarrationOptions {
  document: LinguisticDocument | null;
  index: OccurrenceIndex | null;
  lang: string | null;
  rate: number;
  onFollow(sentenceId: string, chapterIndex: number): void;
}

/**
 * Sentence-by-sentence narration with synchronized highlighting. Pause is
 * implemented as stop + resume-from-sentence because platform pause support
 * in speech engines is unreliable.
 */
export function useNarration({ document, index, lang, rate, onFollow }: NarrationOptions) {
  const provider = useMemo(() => getSpeechProvider(), []);
  const [available, setAvailable] = useState(false);
  const [status, setStatus] = useState<NarrationStatus>("idle");
  const [sentenceId, setSentenceId] = useState<string | null>(null);
  const [wordOrdinal, setWordOrdinal] = useState<number | null>(null);
  const runRef = useRef(0);
  const rateRef = useRef(rate);
  rateRef.current = rate;
  const followRef = useRef(onFollow);
  followRef.current = onFollow;

  useEffect(() => {
    let cancelled = false;
    setAvailable(false);
    if (!lang) return;
    provider.hasVoice(lang).then((value) => { if (!cancelled) setAvailable(value); }).catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [lang, provider]);

  const order = useMemo(() => {
    if (!document) return [] as string[];
    const ids: string[] = [];
    for (const chapter of document.chapters) for (const block of chapter.blocks) for (const sentence of block.sentences) ids.push(sentence.id);
    return ids;
  }, [document]);

  const stop = useCallback(() => {
    runRef.current += 1;
    provider.cancel();
    setStatus("idle");
    setSentenceId(null);
    setWordOrdinal(null);
  }, [provider]);

  useEffect(() => stop, [stop]);

  const playFrom = useCallback(async (startId: string, single = false) => {
    if (!index || !lang) return;
    const run = ++runRef.current;
    provider.cancel();
    setStatus("playing");
    let position = order.indexOf(startId);
    while (position >= 0 && position < order.length && runRef.current === run) {
      const id = order[position];
      const located = id ? index.sentence(id) : null;
      if (!id || !located) break;
      setSentenceId(id);
      followRef.current(id, located.chapterIndex);
      const text = sentenceText(located.block, located.sentence);
      const first = index.firstOrdinalOf(id) ?? 0;
      try {
        await provider.speak(text, {
          lang,
          rate: rateRef.current,
          onBoundary: (charIndex) => {
            const absolute = located.sentence.start + charIndex;
            const tokenIndex = located.sentence.tokens.findIndex(([start, end]) => absolute >= start && absolute < end);
            if (tokenIndex >= 0) setWordOrdinal(first + tokenIndex);
          },
        });
      } catch {
        break;
      }
      if (single) break;
      position += 1;
    }
    if (runRef.current === run) {
      setStatus("idle");
      setWordOrdinal(null);
    }
  }, [index, lang, order, provider]);

  const pause = useCallback(() => {
    runRef.current += 1;
    provider.cancel();
    setStatus("paused");
    setWordOrdinal(null);
  }, [provider]);

  const resume = useCallback(() => {
    if (sentenceId) void playFrom(sentenceId);
  }, [playFrom, sentenceId]);

  const repeat = useCallback(() => {
    if (sentenceId) void playFrom(sentenceId, status !== "playing");
  }, [playFrom, sentenceId, status]);

  const step = useCallback((delta: number) => {
    const position = sentenceId ? order.indexOf(sentenceId) : -1;
    const next = order[Math.max(0, Math.min(order.length - 1, position + delta))];
    if (next) void playFrom(next, status !== "playing");
  }, [order, playFrom, sentenceId, status]);

  const speakText = useCallback(async (text: string) => {
    if (!lang) return;
    runRef.current += 1;
    try {
      await provider.speak(text, { lang, rate: rateRef.current });
    } catch {
      // Unavailable voice is reflected by `available`.
    }
  }, [lang, provider]);

  return { available, status, sentenceId, wordOrdinal, playFrom, pause, resume, stop, repeat, step, speakText };
}

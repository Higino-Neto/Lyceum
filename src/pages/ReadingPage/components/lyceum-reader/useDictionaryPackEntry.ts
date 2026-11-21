import { useEffect, useState } from "react";
import type { PackLookupResult } from "../../../../core/dictionary-packs";
import { installedPackLanguages, lookupDictionaryPack } from "../../../../features/language-learning/dictionaryPacks";

export type PackState =
  | { status: "loading" }
  | { status: "no-pack" }
  | { status: "done"; result: PackLookupResult | null };

/** Runs a pack lookup for the clicked word; `revision` changes after a pack is installed. */
export function useDictionaryPackEntry(form: string | null, lemma: string | null, source: string, target: string, revision = 0): PackState {
  const [state, setState] = useState<PackState>({ status: "loading" });
  useEffect(() => {
    if (!form && !lemma) {
      setState({ status: "done", result: null });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      const installed = await installedPackLanguages();
      const base = source.toLowerCase().split(/[-_]/)[0] ?? "";
      if (!installed.has(base)) {
        if (!cancelled) setState({ status: "no-pack" });
        return;
      }
      const result = await lookupDictionaryPack(form ?? lemma ?? "", lemma, source, target).catch(() => null);
      if (!cancelled) setState({ status: "done", result });
    })();
    return () => {
      cancelled = true;
    };
  }, [form, lemma, source, target, revision]);
  return state;
}

import { useEffect, useState } from "react";
import type {
  TranslationKind,
  TranslationOutcome,
  TranslationService,
} from "../../../../features/language-learning/translation";

export type LookupState = { status: "idle" } | { status: "loading" } | TranslationOutcome;

/** Runs a translation request when inputs change; never fabricates output. */
export function useTranslationLookup(
  service: TranslationService,
  text: string | null,
  source: string,
  target: string,
  kind: TranslationKind,
  enabled = true,
  /** Changes when provider settings change, to retry. */
  revision = 0,
  /** The word as written on the page, when `text` is its lemma. */
  form?: string | null,
): LookupState {
  const [state, setState] = useState<LookupState>({ status: "idle" });

  useEffect(() => {
    if (!text || !enabled) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    service.translate({ text, source, target, kind, ...(form ? { form } : {}) }).then((outcome) => {
      if (!cancelled) setState(outcome);
    }).catch((error: unknown) => {
      if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, form, kind, revision, service, source, target, text]);

  return state;
}

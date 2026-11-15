import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  OccurrenceIndex,
  computeFormStates,
  createReviewItem,
  emptySnapshot,
  formKey,
  getLanguageModule,
  sentenceText,
  stateAfterAddingToVocabulary,
  type KnowledgeBucket,
  type KnowledgeSnapshot,
  type KnowledgeState,
  type LearningAnnotation,
  type LearningReadingState,
  type LinguisticDocument,
  type ReviewItem,
} from "../../../../core/language-learning";
import { createDesktopLearningClient, LOCAL_USER_ID, type LearningClient } from "../../../../features/language-learning/learningClient";
import { useAuth } from "../../../../contexts/AuthContext";
import { translate } from "../../../../i18n";
import { createElement } from "react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** A vocabulary bucket (other language label or signed-out profile) that overlaps this book. */
export interface StrayBucket extends KnowledgeBucket {
  overlap: number;
}

export type SessionStatus = "loading" | "ready" | "error";

export interface LearningSessionInput {
  fileHash: string;
  filePath?: string;
  language: string | null;
}

/** Vocabulary buckets elsewhere (other language label, signed-out profile) that overlap this book. */
async function detectStrayBuckets(client: LearningClient, userId: string, target: LinguisticDocument): Promise<StrayBucket[]> {
  try {
    const keys = new Set(target.lexicon.map((entry) => entry.key));
    const buckets = await client.knowledgeBuckets();
    return buckets
      .filter((bucket) => bucket.userId !== userId || bucket.language !== target.language)
      .map((bucket) => ({ ...bucket, overlap: bucket.keys.filter((candidate) => keys.has(candidate)).length }))
      .filter((bucket) => bucket.overlap >= 3 && bucket.overlap >= bucket.count * 0.2)
      .sort((a, b) => b.overlap - a.overlap);
  } catch (cause) {
    console.error("[LearningReader] buckets", cause);
    return [];
  }
}

export function useLearningUserId() {
  const { user } = useAuth();
  return user?.id ?? LOCAL_USER_ID;
}

export function useLearningSession({ fileHash, filePath, language }: LearningSessionInput) {
  const userId = useLearningUserId();
  const client: LearningClient = useMemo(() => createDesktopLearningClient(userId), [userId]);

  const [status, setStatus] = useState<SessionStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ value: number; stage: string }>({ value: 0, stage: "" });
  const [document, setDocument] = useState<LinguisticDocument | null>(null);
  const [metadataLanguage, setMetadataLanguage] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<KnowledgeSnapshot>(emptySnapshot);
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([]);
  const [annotations, setAnnotations] = useState<LearningAnnotation[]>([]);
  const [readingState, setReadingState] = useState<LearningReadingState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [strayBuckets, setStrayBuckets] = useState<StrayBucket[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const inflight = useRef(0);

  /** Wraps every write so the UI can show "saving / saved / not saved". */
  const persist = useCallback(async <T,>(write: () => Promise<T>): Promise<T> => {
    inflight.current += 1;
    setSaveStatus("saving");
    try {
      const result = await write();
      inflight.current -= 1;
      if (inflight.current === 0) setSaveStatus((current) => (current === "error" ? current : "saved"));
      return result;
    } catch (cause) {
      inflight.current -= 1;
      setSaveStatus("error");
      throw cause;
    }
  }, []);

  useEffect(() => {
    return window.api.onLanguageLearningProgress?.((data) => {
      if (data.fileHash === fileHash) setProgress({ value: data.progress, stage: data.stage });
    });
  }, [fileHash]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setProgress({ value: 0, stage: "" });
    if (!filePath) {
      setStatus("error");
      setError("FILE_NOT_FOUND");
      return;
    }
    void (async () => {
      const result = await window.api.languageLearningOpen({ filePath, fileHash, language: language ?? undefined });
      if (cancelled) return;
      if (!result.success) {
        setStatus("error");
        setError("error" in result ? result.error : "UNKNOWN");
        return;
      }
      const [knowledge, items, notes, state] = await Promise.all([
        client.loadKnowledge(result.language),
        client.listReviewItems(result.language),
        client.listAnnotations(result.document.documentId),
        client.getReadingState(result.document.documentId),
      ]);
      if (cancelled) return;
      setDocument(result.document);
      setMetadataLanguage(result.metadataLanguage);
      setSnapshot(knowledge);
      setReviewItems(items);
      setAnnotations(notes);
      setReadingState(state);
      setStatus("ready");
      void detectStrayBuckets(client, userId, result.document).then((buckets) => {
        if (!cancelled) setStrayBuckets(buckets);
      });
    })().catch((cause: unknown) => {
      if (cancelled) return;
      setStatus("error");
      setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => {
      cancelled = true;
    };
  }, [client, fileHash, filePath, language, reloadToken, userId]);

  const mergeStrayBucket = useCallback(async (bucket: StrayBucket) => {
    if (!document) return;
    try {
      const result = await persist(() => client.mergeKnowledge(bucket.userId, bucket.language, document.language));
      const [knowledge, items] = await Promise.all([client.loadKnowledge(document.language), client.listReviewItems(document.language)]);
      setSnapshot(knowledge);
      setReviewItems(items);
      setStrayBuckets((current) => current.filter((item) => item !== bucket));
      toast.success(translate("learning:recovery.merged", { count: result.moved + result.merged }));
    } catch (cause) {
      console.error("[LearningReader] merge", cause);
      toast.error(translate("learning:errors.saveFailed"));
    }
  }, [client, document, persist]);

  const dismissStrayBucket = useCallback((bucket: StrayBucket) => {
    setStrayBuckets((current) => current.filter((item) => item !== bucket));
  }, []);

  const index = useMemo(() => (document ? new OccurrenceIndex(document) : null), [document]);
  const module = useMemo(() => (document ? getLanguageModule(document.language) : null), [document]);
  const formStates = useMemo(() => (document ? computeFormStates(document, snapshot) : []), [document, snapshot]);

  const lookups = useMemo(() => {
    const result: Record<string, number> = {};
    for (const record of Object.values(snapshot.lemmas)) if (record.lookupCount) result[record.key] = record.lookupCount;
    return result;
  }, [snapshot]);
  const lapses = useMemo(() => {
    const result: Record<string, number> = {};
    for (const item of reviewItems) if (item.lapses) result[item.key] = item.lapses;
    return result;
  }, [reviewItems]);

  const fail = useCallback((cause: unknown) => {
    console.error("[LearningReader]", cause);
    toast.error(translate("learning:errors.saveFailed"));
  }, []);

  /** Sets the lemma state, or a per-form override when `form` is given. */
  const setKnowledge = useCallback(async (key: string, label: string, state: KnowledgeState, form?: string) => {
    if (!document) return;
    const previous = snapshotRef.current;
    const now = new Date().toISOString();
    if (form !== undefined) {
      const next: KnowledgeSnapshot = {
        ...previous,
        forms: { ...previous.forms, [formKey(key, form)]: { language: document.language, key, form, state, updatedAt: now } },
      };
      setSnapshot(next);
      try {
        await persist(() => client.setFormState({ language: document.language, key, form, state }));
      } catch (cause) {
        setSnapshot(previous);
        fail(cause);
      }
      return;
    }
    const existing = previous.lemmas[key];
    setSnapshot({
      ...previous,
      lemmas: {
        ...previous.lemmas,
        [key]: { language: document.language, key, label, state, translation: existing?.translation ?? null, note: existing?.note ?? null, lookupCount: existing?.lookupCount ?? 0, updatedAt: now },
      },
    });
    try {
      const saved = await persist(() => client.setLemmaState({ language: document.language, key, label, state }));
      setSnapshot((current) => ({ ...current, lemmas: { ...current.lemmas, [key]: saved } }));
    } catch (cause) {
      setSnapshot(previous);
      fail(cause);
    }
  }, [client, document, fail, persist]);

  const clearFormOverride = useCallback(async (key: string, form: string) => {
    if (!document) return;
    const previous = snapshotRef.current;
    const forms = { ...previous.forms };
    delete forms[formKey(key, form)];
    setSnapshot({ ...previous, forms });
    try {
      await persist(() => client.clearFormState(document.language, key, form));
    } catch (cause) {
      setSnapshot(previous);
      fail(cause);
    }
  }, [client, document, fail, persist]);

  const recordLookup = useCallback((key: string, label: string) => {
    if (!document) return;
    setSnapshot((current) => {
      const existing = current.lemmas[key];
      return {
        ...current,
        lemmas: {
          ...current.lemmas,
          [key]: existing
            ? { ...existing, lookupCount: existing.lookupCount + 1 }
            : { language: document.language, key, label, state: "unknown", translation: null, note: null, lookupCount: 1, updatedAt: new Date().toISOString() },
        },
      };
    });
    client.recordLookup(document.language, key, label).catch(fail);
  }, [client, document, fail]);

  const saveTranslation = useCallback(async (key: string, label: string, translation: string | null) => {
    if (!document) return;
    setSnapshot((current) => {
      const existing = current.lemmas[key];
      return {
        ...current,
        lemmas: {
          ...current.lemmas,
          [key]: existing
            ? { ...existing, translation }
            : { language: document.language, key, label, state: "unknown", translation, note: null, lookupCount: 0, updatedAt: new Date().toISOString() },
        },
      };
    });
    try {
      await persist(() => client.setTranslation(document.language, key, label, translation));
      setReviewItems((items) => items.map((item) => (item.key === key ? { ...item, translation } : item)));
      const item = reviewItems.find((candidate) => candidate.key === key);
      if (item) await persist(() => client.upsertReviewItem({ ...item, translation }));
    } catch (cause) {
      fail(cause);
    }
  }, [client, document, fail, persist, reviewItems]);

  const reviewItemsRef = useRef(reviewItems);
  reviewItemsRef.current = reviewItems;

  /** Undo for an automatic or manual add: restores the previous state and drops the new review item. */
  const undoAdd = useCallback(async (key: string, label: string, previousState: KnowledgeState, createdItemId: string | null) => {
    await setKnowledge(key, label, previousState);
    if (!createdItemId) return;
    setReviewItems((items) => items.filter((item) => item.id !== createdItemId));
    try {
      await persist(() => client.deleteReviewItem(createdItemId));
    } catch (cause) {
      fail(cause);
    }
  }, [client, fail, persist, setKnowledge]);

  /**
   * Adds a lexeme or expression to the vocabulary: starts learning and
   * creates a review item with its context sentence from this document.
   */
  const addToVocabulary = useCallback(async (args: {
    key: string;
    label: string;
    itemType: "lexeme" | "expression";
    sentenceId?: string;
    contextForm?: string;
    /** Automatic add (clicking an unknown word): quieter toast with undo. */
    automatic?: boolean;
  }) => {
    if (!document || !index) return;
    const existing = reviewItemsRef.current.find((item) => item.key === args.key);
    const located = args.sentenceId ? index.sentence(args.sentenceId) : null;
    const item = existing ?? createReviewItem({
      language: document.language,
      key: args.key,
      itemType: args.itemType,
      label: args.label,
      translation: snapshotRef.current.lemmas[args.key]?.translation ?? null,
      context: located ? sentenceText(located.block, located.sentence) : null,
      contextForm: args.contextForm ?? null,
      documentId: document.documentId,
      sentenceId: args.sentenceId ?? null,
    });
    const currentState = snapshotRef.current.lemmas[args.key]?.state ?? "unknown";
    const nextState = stateAfterAddingToVocabulary(currentState);
    await setKnowledge(args.key, args.label, nextState);
    if (!existing) {
      setReviewItems((items) => [...items, item]);
      try {
        await persist(() => client.upsertReviewItem(item));
      } catch (cause) {
        setReviewItems((items) => items.filter((candidate) => candidate.id !== item.id));
        fail(cause);
        return;
      }
    }
    if (existing && currentState === nextState) return;
    const createdId = existing ? null : item.id;
    toast((toastItem) => createElement(
      "span",
      { className: "flex items-center gap-3 text-sm" },
      translate(args.automatic ? "learning:toasts.autoLearning" : "learning:toasts.added", { word: args.label }),
      createElement("button", {
        type: "button",
        className: "rounded-sm px-2 py-0.5 text-xs font-semibold text-primary hover:bg-surface-muted cursor-pointer",
        onClick: () => {
          toast.dismiss(toastItem.id);
          void undoAdd(args.key, args.label, currentState, createdId);
        },
      }, translate("learning:actions.undo")),
    ), { id: `ll-add-${args.key}`, duration: args.automatic ? 2500 : 4000 });
  }, [client, document, fail, index, persist, setKnowledge, undoAdd]);

  /** Sets one state for many lemmas at once (word list bulk actions). */
  const setManyStates = useCallback(async (entries: Array<{ key: string; label: string }>, state: KnowledgeState) => {
    if (!document || entries.length === 0) return;
    const previous = snapshotRef.current;
    const now = new Date().toISOString();
    const lemmas = { ...previous.lemmas };
    for (const { key, label } of entries) {
      const existing = lemmas[key];
      lemmas[key] = existing
        ? { ...existing, state, updatedAt: now }
        : { language: document.language, key, label, state, translation: null, note: null, lookupCount: 0, updatedAt: now };
    }
    setSnapshot({ ...previous, lemmas });
    try {
      await persist(() => client.setLemmaStates(entries.map(({ key, label }) => ({ language: document.language, key, label, state }))));
    } catch (cause) {
      setSnapshot(previous);
      fail(cause);
    }
  }, [client, document, fail, persist]);

  const saveAnnotation = useCallback(async (annotation: LearningAnnotation) => {
    setAnnotations((items) => [...items.filter((item) => item.id !== annotation.id), annotation]);
    try {
      await persist(() => client.saveAnnotation(annotation));
    } catch (cause) {
      setAnnotations((items) => items.filter((item) => item.id !== annotation.id));
      fail(cause);
    }
  }, [client, fail, persist]);

  const deleteAnnotation = useCallback(async (id: string) => {
    const previous = annotations;
    setAnnotations((items) => items.filter((item) => item.id !== id));
    try {
      await persist(() => client.deleteAnnotation(id));
    } catch (cause) {
      setAnnotations(previous);
      fail(cause);
    }
  }, [annotations, client, fail, persist]);

  const reload = useCallback(() => setReloadToken((value) => value + 1), []);

  return {
    userId,
    client,
    status,
    error,
    progress,
    document,
    index,
    module,
    metadataLanguage,
    snapshot,
    setSnapshot,
    formStates,
    lookups,
    lapses,
    reviewItems,
    setReviewItems,
    annotations,
    readingState,
    setReadingState,
    setKnowledge,
    clearFormOverride,
    recordLookup,
    saveTranslation,
    addToVocabulary,
    setManyStates,
    saveStatus,
    persist,
    strayBuckets,
    mergeStrayBucket,
    dismissStrayBucket,
    saveAnnotation,
    deleteAnnotation,
    reload,
  };
}

export type LearningSession = ReturnType<typeof useLearningSession>;

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

/** Where a word was met, for the context sentence of its review card. */
export interface ReviewContext {
  sentenceId?: string;
  contextForm?: string;
  itemType?: "lexeme" | "expression";
}

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

  const reviewItemsRef = useRef(reviewItems);
  reviewItemsRef.current = reviewItems;
  const lexemeByKey = useMemo(() => {
    const result = new Map<string, number>();
    document?.lexicon.forEach((entry, position) => result.set(entry.key, position));
    return result;
  }, [document]);

  /**
   * Builds a review item for a lexeme or expression with a context sentence
   * from this document (the given one, or the first occurrence).
   */
  const buildReviewItem = useCallback((key: string, label: string, context?: ReviewContext): ReviewItem | null => {
    if (!document || !index) return null;
    let sentenceId = context?.sentenceId;
    let contextForm = context?.contextForm;
    let itemType: ReviewItem["itemType"] = context?.itemType ?? "lexeme";
    if (!sentenceId) {
      const lexeme = lexemeByKey.get(key);
      const ordinal = lexeme === undefined ? undefined : index.lexemeOccurrences(lexeme)[0];
      const resolved = ordinal === undefined ? null : index.resolve(ordinal);
      if (resolved) {
        sentenceId = resolved.sentence.id;
        contextForm = resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]);
      } else {
        const expression = document.expressions.findIndex((entry) => entry.key === key);
        const occurrence = expression >= 0 ? document.expressionOccurrences.find((item) => item.expression === expression) : undefined;
        if (occurrence) {
          sentenceId = occurrence.sentenceId;
          itemType = "expression";
        }
      }
    }
    const located = sentenceId ? index.sentence(sentenceId) : null;
    return createReviewItem({
      language: document.language,
      key,
      itemType,
      label,
      translation: snapshotRef.current.lemmas[key]?.translation ?? null,
      context: located ? sentenceText(located.block, located.sentence) : null,
      contextForm: contextForm ?? null,
      documentId: document.documentId,
      sentenceId: sentenceId ?? null,
    });
  }, [document, index, lexemeByKey]);

  /** Learning words are the review queue: make sure each one has a review item. */
  const ensureReviewItems = useCallback(async (entries: Array<{ key: string; label: string; context?: ReviewContext }>) => {
    const existing = new Set(reviewItemsRef.current.map((item) => item.key));
    const created = entries
      .filter((entry) => !existing.has(entry.key))
      .map((entry) => buildReviewItem(entry.key, entry.label, entry.context))
      .filter((item): item is ReviewItem => item !== null);
    if (created.length === 0) return;
    setReviewItems((items) => [...items, ...created]);
    try {
      await persist(async () => {
        if (created.length === 1) await client.upsertReviewItem(created[0]!);
        else await client.upsertReviewItems(created);
      });
    } catch (cause) {
      const ids = new Set(created.map((item) => item.id));
      setReviewItems((items) => items.filter((item) => !ids.has(item.id)));
      fail(cause);
    }
  }, [buildReviewItem, client, fail, persist]);

  /**
   * Sets the lemma state, or a per-form override when `form` is given.
   * Marking something as Learning also puts it in the review queue.
   */
  const setKnowledge = useCallback(async (key: string, label: string, state: KnowledgeState, form?: string, context?: ReviewContext) => {
    if (!document) return;
    const previous = snapshotRef.current;
    const now = new Date().toISOString();
    if (state === "learning") void ensureReviewItems([{ key, label, context }]);
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
  }, [client, document, ensureReviewItems, fail, persist]);

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
      const item = reviewItemsRef.current.find((candidate) => candidate.key === key);
      if (item) await persist(() => client.upsertReviewItem({ ...item, translation }));
    } catch (cause) {
      fail(cause);
    }
  }, [client, document, fail, persist]);

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
    if (state === "learning") void ensureReviewItems(entries);
    try {
      await persist(() => client.setLemmaStates(entries.map(({ key, label }) => ({ language: document.language, key, label, state }))));
    } catch (cause) {
      setSnapshot(previous);
      fail(cause);
    }
  }, [client, document, ensureReviewItems, fail, persist]);

  /** Review items whose word is currently in Learning: the review queue. */
  const activeReviewItems = useMemo(
    () => reviewItems.filter((item) => (snapshot.lemmas[item.key]?.state ?? "unknown") === "learning"),
    [reviewItems, snapshot],
  );

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
    setManyStates,
    activeReviewItems,
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

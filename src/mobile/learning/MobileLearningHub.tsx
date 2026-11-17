import { startTransition, useDeferredValue, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { BookOpenCheck, Check, Circle, EyeOff, Search, Sprout, Trash2 } from "lucide-react";
import {
  computeCoverage,
  dueItems,
  hardestChapters,
  rankDifficultWords,
  recommendWordsToLearn,
  retentionState,
  summarizeChapters,
  type DifficultWord,
  type KnowledgeState,
} from "../../core/language-learning";
import { useTranslation } from "../../i18n";
import type { LearningReaderSettings } from "../../features/language-learning/settings";
import type { LearningSession } from "../../pages/ReadingPage/components/lyceum-reader/useLearningSession";
import type { LearningTab } from "../../pages/ReadingPage/components/lyceum-reader/LearningPanel";
import { buildWordRows, fold, sortWordRows, type WordRow, type WordScope, type WordSort } from "../../pages/ReadingPage/components/lyceum-reader/wordRows";
import { dynamicT, percent, STATE_DOT, STATE_ORDER, stateLabelKey } from "../../pages/ReadingPage/components/lyceum-reader/uiHelpers";
import { ReviewSession } from "../../pages/ReadingPage/components/lyceum-reader/ReviewSession";

/**
 * Phone version of the learning panel (words, progress, chapters, review,
 * notes): thumb-sized targets, one column, and work deferred so the sheet
 * opens at once. Shares every computation with the desktop panel.
 */
interface MobileLearningHubProps {
  session: LearningSession;
  settings: LearningReaderSettings;
  chapterIndex: number;
  tab: LearningTab;
  speechAvailable: boolean;
  onTab(tab: LearningTab): void;
  onWord(word: Pick<DifficultWord, "lexeme">): void;
  onChapter(chapterIndex: number): void;
  onAnnotation(id: string): void;
  onSpeak(text: string): void;
}

const TABS: LearningTab[] = ["words", "progress", "chapters", "review", "notes"];
const WORD_ROW_HEIGHT = 64;
const WORD_OVERSCAN = 6;
const STATE_ICON = { unknown: Circle, learning: Sprout, known: Check, ignored: EyeOff } as const;
const STATE_ACTIVE: Record<KnowledgeState, string> = {
  unknown: "bg-info/20 text-info",
  learning: "bg-warning/20 text-warning",
  known: "bg-success/20 text-success",
  ignored: "bg-surface-muted text-foreground",
};

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-foreground-subtle">{children}</h3>;
}

function CoverageBar({ known, learning, unknown, tall = false }: { known: number; learning: number; unknown: number; tall?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-full bg-surface-muted ${tall ? "h-2.5" : "h-1.5"}`} aria-hidden>
      <div className="bg-success" style={{ width: `${known}%` }} />
      <div className="bg-warning" style={{ width: `${learning}%` }} />
      <div className="bg-info/70" style={{ width: `${unknown}%` }} />
    </div>
  );
}

function HubSkeleton() {
  return (
    <div className="space-y-3 px-4 py-4" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="mobile-skeleton-line h-14 rounded-2xl" />
      ))}
    </div>
  );
}

function StateButtons({ value, onChange }: { value: KnowledgeState; onChange(state: KnowledgeState): void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-shrink-0 items-center gap-1" role="radiogroup">
      {STATE_ORDER.map((state) => {
        const Icon = STATE_ICON[state];
        const active = state === value;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t(stateLabelKey(state))}
            onClick={(event) => {
              event.stopPropagation();
              onChange(state);
            }}
            className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${active ? STATE_ACTIVE[state] : "text-foreground-subtle active:bg-surface-muted"}`}
          >
            <Icon size={17} strokeWidth={active ? 2.5 : 2} />
          </button>
        );
      })}
    </div>
  );
}

function WordsTab({ session, chapterIndex, onWord }: MobileLearningHubProps) {
  const { t, i18n } = useTranslation();
  const { document } = session;
  // A chapter is a few hundred words; the whole book can be tens of thousands.
  const [scope, setScope] = useState<WordScope>("chapter");
  const [sort, setSort] = useState<WordSort>("relevance");
  const [filter, setFilter] = useState<KnowledgeState | "all">("all");
  const [query, setQuery] = useState("");
  const [hideNames, setHideNames] = useState(true);
  const [confirmBulk, setConfirmBulk] = useState<KnowledgeState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(560);

  const snapshot = useDeferredValue(session.snapshot);
  const formStates = useDeferredValue(session.formStates);
  const deferredQuery = useDeferredValue(query);
  const rows = useMemo(
    () => (document ? buildWordRows(document, { snapshot, formStates, lookups: session.lookups, lapses: session.lapses }, scope, chapterIndex) : []),
    [chapterIndex, document, formStates, scope, session.lapses, session.lookups, snapshot],
  );
  const counts = useMemo(() => {
    const result: Record<KnowledgeState | "all", number> = { all: 0, unknown: 0, learning: 0, known: 0, ignored: 0 };
    for (const row of rows) {
      if (hideNames && row.properNoun) continue;
      result.all += 1;
      result[row.state] += 1;
    }
    return result;
  }, [hideNames, rows]);
  const visible = useMemo(() => {
    const folded = fold(deferredQuery.trim());
    const filtered = rows.filter((row) =>
      (filter === "all" || row.state === filter)
      && (!hideNames || !row.properNoun)
      && (!folded || fold(row.label).includes(folded) || (row.translation ? fold(row.translation).includes(folded) : false)));
    return sortWordRows(filtered, sort, document?.language ?? i18n.language);
  }, [deferredQuery, document?.language, filter, hideNames, i18n.language, rows, sort]);

  useEffect(() => {
    setConfirmBulk(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [filter, deferredQuery, scope, sort, hideNames]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(element.clientHeight || 560));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!document) return null;
  const first = Math.max(0, Math.floor(scrollTop / WORD_ROW_HEIGHT) - WORD_OVERSCAN);
  const last = Math.min(visible.length, Math.ceil((scrollTop + viewport) / WORD_ROW_HEIGHT) + WORD_OVERSCAN);
  const scopes: WordScope[] = ["chapter", "book", "all"];
  const sorts: WordSort[] = scope === "all" ? ["recent", "relevance", "frequency", "alphabetical"] : ["relevance", "frequency", "alphabetical"];
  const bulkTargets = confirmBulk ? visible.filter((row) => row.state !== confirmBulk) : [];
  const setState = (row: WordRow, state: KnowledgeState) => void session.setKnowledge(row.key, row.label, state);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 space-y-2.5 px-4 pb-3">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-muted p-1">
          {scopes.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => startTransition(() => {
                setScope(value);
                if (value === "all" && sort === "relevance") setSort("recent");
                if (value !== "all" && sort === "recent") setSort("relevance");
              })}
              className={`min-h-10 rounded-xl px-2 text-[13px] font-semibold ${scope === value ? "bg-surface text-foreground shadow-sm" : "text-foreground-muted"}`}
            >
              {dynamicT(t, `learning:words.scopes.${value}`, undefined, value)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-border bg-surface-muted px-3">
            <Search size={17} className="flex-shrink-0 text-foreground-subtle" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("learning:words.search")}
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-input-placeholder"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as WordSort)}
            aria-label={t("learning:words.sortLabel")}
            className="h-11 max-w-[42%] rounded-2xl border border-border bg-surface-muted px-3 text-[13px] font-semibold text-foreground"
          >
            {sorts.map((value) => <option key={value} value={value}>{dynamicT(t, `learning:words.sort.${value}`, undefined, value)}</option>)}
          </select>
        </div>
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
          {(["all", ...STATE_ORDER] as Array<KnowledgeState | "all">).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => startTransition(() => setFilter(value))}
              className={`flex h-9 flex-shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] tabular-nums ${filter === value ? "border-primary bg-primary-muted text-primary" : "border-border text-foreground-muted"}`}
            >
              {value !== "all" && <span className={`h-2 w-2 rounded-full ${STATE_DOT[value]}`} />}
              {value === "all" ? t("learning:words.all") : t(stateLabelKey(value))}
              <span className="text-foreground-subtle">{counts[value]}</span>
            </button>
          ))}
        </div>
        <label className="flex min-h-9 items-center gap-2.5 text-[13px] text-foreground-muted">
          <input type="checkbox" className="h-5 w-5 accent-[var(--primary)]" checked={hideNames} onChange={(event) => setHideNames(event.target.checked)} />
          {t("learning:words.hideNames")}
        </label>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="list"
        aria-label={t("learning:words.title")}
      >
        {visible.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-foreground-subtle">
            {scope === "all" && rows.length === 0 ? t("learning:words.emptyAll") : t("learning:words.empty")}
          </p>
        ) : (
          <div style={{ height: visible.length * WORD_ROW_HEIGHT, position: "relative" }}>
            {visible.slice(first, last).map((row, offset) => (
              <div
                key={row.key}
                role="listitem"
                className="absolute inset-x-0 flex items-center gap-2 border-b border-border/60 pl-4 pr-2"
                style={{ top: (first + offset) * WORD_ROW_HEIGHT, height: WORD_ROW_HEIGHT }}
              >
                <button
                  type="button"
                  disabled={row.lexeme === null}
                  onClick={() => row.lexeme !== null && onWord({ lexeme: row.lexeme })}
                  className="min-w-0 flex-1 py-2 text-left"
                >
                  <span className="flex items-baseline gap-2">
                    <span className={`h-2 w-2 flex-shrink-0 self-center rounded-full ${STATE_DOT[row.state]}`} />
                    <span className="truncate text-[16px] text-foreground" lang={document.language}>{row.label}</span>
                    {row.frequency > 0 && <span className="flex-shrink-0 text-xs tabular-nums text-foreground-subtle">×{row.frequency}</span>}
                  </span>
                  <span className="mt-0.5 block truncate pl-4 text-[13px] text-foreground-subtle">
                    {row.translation ?? (row.lexeme === null ? t("learning:words.notInBook") : "")}
                  </span>
                </button>
                <StateButtons value={row.state} onChange={(state) => setState(row, state)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 border-t border-border px-4 pt-3">
        {confirmBulk ? (
          <div className="space-y-2">
            <p className="text-[13px] text-foreground">{t("learning:words.bulkConfirm", { count: bulkTargets.length, state: t(stateLabelKey(confirmBulk)) })}</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmBulk(null)} className="mobile-choice">{t("learning:actions.cancel")}</button>
              <button
                type="button"
                disabled={bulkTargets.length === 0}
                onClick={() => {
                  void session.setManyStates(bulkTargets.map((row) => ({ key: row.key, label: row.label })), confirmBulk);
                  setConfirmBulk(null);
                }}
                className="mobile-choice mobile-choice-active disabled:opacity-50"
              >
                {t("learning:words.bulkApply")}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-foreground-subtle">{t("learning:words.bulkLabel", { count: visible.length })}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {STATE_ORDER.map((state) => (
                <button key={state} type="button" disabled={visible.length === 0} onClick={() => setConfirmBulk(state)} className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-border px-1 text-xs font-semibold text-foreground disabled:opacity-40">
                  <span className={`h-2 w-2 rounded-full ${STATE_DOT[state]}`} />
                  <span className="truncate">{t(stateLabelKey(state))}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProgressTab({ session, chapterIndex, onWord, onTab }: MobileLearningHubProps) {
  const { t } = useTranslation();
  const { document, lookups, lapses } = session;
  const snapshot = useDeferredValue(session.snapshot);
  const formStates = useDeferredValue(session.formStates);
  const coverage = useMemo(() => (document ? computeCoverage(document, snapshot, formStates) : null), [document, formStates, snapshot]);
  const difficult = useMemo(
    () => (document ? rankDifficultWords(document, snapshot, formStates, { lookups, lapses }, undefined, 12) : []),
    [document, formStates, lapses, lookups, snapshot],
  );
  const recommendation = useMemo(
    () => (document ? recommendWordsToLearn(document, snapshot, formStates, { lookups, lapses }, [chapterIndex], 10) : null),
    [chapterIndex, document, formStates, lapses, lookups, snapshot],
  );
  if (!document || !coverage) return null;

  return (
    <div className="space-y-6 px-4 pb-4">
      <section className="grid grid-cols-2 gap-2">
        {([
          ["occurrenceCoverage", coverage.occurrenceCoverage],
          ["uniqueCoverage", coverage.uniqueCoverage],
        ] as const).map(([key, value]) => (
          <div key={key} className="rounded-2xl border border-border bg-surface-muted p-3">
            <p className="text-2xl font-semibold tabular-nums text-foreground">{percent(value.known)}</p>
            <p className="mb-2 mt-0.5 text-xs leading-4 text-foreground-muted">{t(`learning:progress.${key}`)}</p>
            <CoverageBar {...value} tall />
          </div>
        ))}
        <p className="col-span-2 text-xs leading-5 text-foreground-subtle">{t("learning:progress.coverageHint")}</p>
      </section>

      <section>
        <SectionTitle>{t("learning:progress.coverage")}</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {(["known", "learning", "unknown", "ignored"] as const).map((state) => (
            <div key={state} className="rounded-2xl border border-border p-3">
              <p className="flex items-center gap-2 text-[13px] text-foreground-muted"><span className={`h-2 w-2 rounded-full ${STATE_DOT[state]}`} />{t(stateLabelKey(state))}</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">{coverage.unique[state]}</p>
              <p className="text-xs tabular-nums text-foreground-subtle">{t("learning:progress.occurrences")}: {coverage.occurrences[state]}</p>
            </div>
          ))}
        </div>
      </section>

      {recommendation && recommendation.words.length > 0 && (
        <section>
          <SectionTitle>{t("learning:progress.recommendation")}</SectionTitle>
          <p className="mb-3 text-[13px] leading-5 text-foreground-muted">
            {t("learning:progress.recommendationText", {
              count: recommendation.words.length,
              from: percent(recommendation.currentCoverage),
              to: percent(recommendation.projectedCoverage),
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            {recommendation.words.map((word) => (
              <button key={word.lexeme} type="button" onClick={() => onWord(word)} className="h-10 rounded-full border border-border bg-surface-muted px-4 text-[15px] text-foreground active:border-primary" lang={document.language}>
                {word.lemma}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionTitle>{t("learning:progress.difficult")}</SectionTitle>
        {difficult.length === 0 ? (
          <p className="text-sm text-foreground-subtle">{t("learning:progress.noDifficult")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {difficult.map((word) => (
              <li key={word.lexeme}>
                <button type="button" onClick={() => onWord(word)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left active:bg-surface-muted">
                  <span className="flex min-w-0 items-center gap-2.5 text-[15px] text-foreground" lang={document.language}>
                    <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATE_DOT[word.state]}`} />
                    <span className="truncate">{word.lemma}</span>
                  </span>
                  <span className="flex-shrink-0 text-xs tabular-nums text-foreground-subtle">
                    ×{word.frequency}{word.unlocksSentences > 0 ? ` · +${word.unlocksSentences}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs leading-5 text-foreground-subtle">{t("learning:progress.difficultHint")}</p>
        <button type="button" onClick={() => onTab("words")} className="mt-2 min-h-11 text-sm font-semibold text-primary">
          {t("learning:words.seeAll")}
        </button>
      </section>
    </div>
  );
}

function ChaptersTab({ session, chapterIndex, onChapter, onWord }: MobileLearningHubProps) {
  const { t } = useTranslation();
  const { document, lookups, lapses, readingState } = session;
  const snapshot = useDeferredValue(session.snapshot);
  const formStates = useDeferredValue(session.formStates);
  const summaries = useMemo(
    () => (document ? summarizeChapters(document, snapshot, formStates, { lookups, lapses }, 4) : []),
    [document, formStates, lapses, lookups, snapshot],
  );
  const hardest = useMemo(() => new Set(hardestChapters(summaries, 3).map((summary) => summary.chapterIndex)), [summaries]);
  if (!document) return null;
  return (
    <ul className="space-y-2 px-4 pb-4">
      {summaries.map((summary) => {
        const current = summary.chapterIndex === chapterIndex;
        return (
          <li key={summary.chapterId} className={`rounded-2xl border p-3 ${current ? "border-primary bg-primary-muted/40" : "border-border"}`}>
            <button type="button" onClick={() => onChapter(summary.chapterIndex)} className="w-full text-left">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[15px] font-medium text-foreground">{summary.title}</span>
                <span className="flex flex-shrink-0 items-center gap-1.5 text-sm tabular-nums text-foreground-muted">
                  {readingState?.completedChapters.includes(summary.chapterId) && <BookOpenCheck size={16} className="text-success" />}
                  {percent(summary.coverage.occurrenceCoverage.known)}
                </span>
              </div>
              <div className="mt-2"><CoverageBar {...summary.coverage.occurrenceCoverage} tall /></div>
              <div className="mt-1.5 flex justify-between text-xs text-foreground-subtle">
                <span>{t("learning:chapters.unknownShare", { value: percent(summary.coverage.occurrenceCoverage.unknown) })}</span>
                {hardest.has(summary.chapterIndex) && summaries.length > 3 && <span className="text-warning">{t("learning:chapters.hardest")}</span>}
              </div>
            </button>
            {summary.topUnknown.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {summary.topUnknown.map((word) => (
                  <button key={word.lexeme} type="button" onClick={() => onWord(word)} className="h-9 rounded-full bg-surface-muted px-3 text-[13px] text-foreground" lang={document.language}>
                    {word.lemma} <span className="text-foreground-subtle">{word.frequency}</span>
                  </button>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ReviewTab(props: MobileLearningHubProps) {
  const { t } = useTranslation();
  const { session } = props;
  const [reviewing, setReviewing] = useState(false);
  const due = useMemo(() => dueItems(session.activeReviewItems), [session.activeReviewItems]);
  const counts = useMemo(() => {
    const result = { new: 0, learning: 0, young: 0, mature: 0 };
    for (const item of session.activeReviewItems) result[retentionState(item)] += 1;
    return result;
  }, [session.activeReviewItems]);
  const queue = useMemo(
    () => session.activeReviewItems.slice().sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).slice(0, 200),
    [session.activeReviewItems],
  );

  if (reviewing) {
    return (
      <div className="px-4 pb-4 text-base [&_button]:min-h-11 [&_input]:min-h-11 [&_input]:text-base">
        <ReviewSession session={session} speechAvailable={props.speechAvailable} nativeLanguage={props.settings.nativeLanguage} onSpeak={props.onSpeak} onDone={() => setReviewing(false)} />
      </div>
    );
  }

  return (
    <div className="space-y-5 px-4 pb-4">
      <div className="rounded-3xl border border-border bg-surface-muted p-4">
        <p className="text-4xl font-semibold tabular-nums text-foreground">{due.length}</p>
        <p className="mt-1 text-sm text-foreground-muted">{t("learning:review.due")}</p>
        <button type="button" disabled={due.length === 0} onClick={() => setReviewing(true)} className="mobile-primary-button mt-4 disabled:opacity-50">
          {t("learning:review.start")}
        </button>
        <p className="mt-2 text-xs leading-5 text-foreground-subtle">{t("learning:review.positionKept")}</p>
      </div>
      <dl className="grid grid-cols-4 gap-2 text-center">
        {(["new", "learning", "young", "mature"] as const).map((state) => (
          <div key={state} className="rounded-2xl border border-border px-1 py-2.5">
            <dd className="text-lg font-semibold tabular-nums text-foreground">{counts[state]}</dd>
            <dt className="truncate text-[11px] text-foreground-subtle">{dynamicT(t, `learning:review.retention.${state}`, undefined, state)}</dt>
          </div>
        ))}
      </dl>
      {queue.length === 0 ? (
        <p className="text-sm text-foreground-subtle">{t("learning:review.emptyQueue")}</p>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border">
          {queue.map((item) => (
            <li key={item.id} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-[15px] text-foreground">{item.label}</p>
                <p className="truncate text-[13px] text-foreground-subtle">{item.translation ?? t("learning:review.noTranslation")}</p>
              </div>
              <span className="flex-shrink-0 text-xs text-foreground-subtle">{dynamicT(t, `learning:review.retention.${retentionState(item)}`, undefined, "")}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotesTab({ session, onAnnotation }: MobileLearningHubProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState("");
  const categories = useMemo(() => Array.from(new Set(session.annotations.map((a) => a.category).filter(Boolean))).sort(), [session.annotations]);
  const visible = session.annotations.filter((annotation) => !filter || annotation.category === filter);
  if (session.annotations.length === 0) return <p className="px-6 py-10 text-center text-sm text-foreground-subtle">{t("learning:annotations.empty")}</p>;
  return (
    <div className="space-y-3 px-4 pb-4">
      {categories.length > 0 && (
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
          {["", ...categories].map((category) => (
            <button key={category || "all"} type="button" onClick={() => setFilter(category)} className={`h-9 flex-shrink-0 rounded-full border px-3 text-[13px] ${filter === category ? "border-primary bg-primary-muted text-primary" : "border-border text-foreground-muted"}`}>
              {category || t("learning:annotations.all")}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {visible.map((annotation) => (
          <li key={annotation.id} className="flex gap-2 rounded-2xl border border-border p-3">
            <button type="button" onClick={() => onAnnotation(annotation.id)} className="min-w-0 flex-1 text-left">
              <p className="line-clamp-3 font-serif text-[15px] leading-6 text-foreground-muted">“{annotation.quote}”</p>
              {annotation.note && <p className="mt-1.5 text-sm text-foreground">{annotation.note}</p>}
              <p className="mt-1.5 text-xs text-foreground-subtle">{annotation.category || dynamicT(t, `learning:annotations.targets.${annotation.targetType}`, undefined, annotation.targetType)}</p>
            </button>
            <button type="button" className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full text-foreground-subtle active:bg-surface-muted active:text-destructive" onClick={() => void session.deleteAnnotation(annotation.id)} aria-label={t("learning:actions.delete")}>
              <Trash2 size={17} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MobileLearningHub(props: MobileLearningHubProps) {
  const { t } = useTranslation();
  const dueCount = useMemo(() => dueItems(props.session.activeReviewItems).length, [props.session.activeReviewItems]);
  // Let the sheet slide in first; the heavy tab renders on the next frames.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  const tab = useDeferredValue(props.tab);
  const switching = tab !== props.tab;

  return (
    <div className="flex h-full min-h-0 flex-col" aria-label={t("learning:panel.title")}>
      <div role="tablist" className="flex flex-shrink-0 gap-1.5 overflow-x-auto px-4 pb-3 [scrollbar-width:none]">
        {TABS.map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={props.tab === value}
            onClick={() => props.onTab(value)}
            className={`flex h-10 flex-shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold ${props.tab === value ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground-muted"}`}
          >
            {dynamicT(t, `learning:panel.tabs.${value}`, undefined, value)}
            {value === "review" && dueCount > 0 && (
              <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${props.tab === value ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"}`}>{dueCount}</span>
            )}
          </button>
        ))}
      </div>
      {!ready ? (
        <HubSkeleton />
      ) : tab === "words" ? (
        <div className={`min-h-0 flex-1 transition-opacity ${switching ? "opacity-60" : ""}`}>
          <WordsTab {...props} tab={tab} />
        </div>
      ) : (
        <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain transition-opacity ${switching ? "opacity-60" : ""}`}>
          {tab === "progress" && <ProgressTab {...props} tab={tab} />}
          {tab === "chapters" && <ChaptersTab {...props} tab={tab} />}
          {tab === "review" && <ReviewTab {...props} tab={tab} />}
          {tab === "notes" && <NotesTab {...props} tab={tab} />}
        </div>
      )}
      <SaveStatus session={props.session} />
    </div>
  );
}

function SaveStatus({ session }: { session: LearningSession }) {
  const { t } = useTranslation();
  if (session.saveStatus !== "error") return null;
  return <p className="flex-shrink-0 border-t border-border px-4 py-2 text-xs text-destructive" role="status">{t("learning:save.error")}</p>;
}

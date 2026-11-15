import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { Check, Circle, EyeOff, Search, Sprout } from "lucide-react";
import type { KnowledgeState } from "../../../../core/language-learning";
import { buildWordRows, fold, sortWordRows, type WordRow, type WordScope, type WordSort } from "./wordRows";
import { useTranslation } from "../../../../i18n";
import type { LearningSession } from "./useLearningSession";
import { dynamicT, STATE_DOT, STATE_ORDER, stateLabelKey } from "./uiHelpers";

type StateFilter = KnowledgeState | "all";

interface WordListProps {
  session: LearningSession;
  chapterIndex: number;
  onOpenWord(lexeme: number): void;
}

const ROW_HEIGHT = 46;
const OVERSCAN = 8;
const STATE_ICON = { unknown: Circle, learning: Sprout, known: Check, ignored: EyeOff } as const;
const STATE_ACTIVE: Record<KnowledgeState, string> = {
  unknown: "bg-info/20 text-info",
  learning: "bg-warning/20 text-warning",
  known: "bg-success/20 text-success",
  ignored: "bg-surface-muted text-foreground",
};

function StateButtons({ value, onChange }: { value: KnowledgeState; onChange(state: KnowledgeState): void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-shrink-0 items-center gap-0.5" role="radiogroup">
      {STATE_ORDER.map((state) => {
        const Icon = STATE_ICON[state];
        const active = state === value;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={active}
            title={t(stateLabelKey(state))}
            aria-label={t(stateLabelKey(state))}
            onClick={(event) => {
              event.stopPropagation();
              onChange(state);
            }}
            className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors cursor-pointer ${
              active ? STATE_ACTIVE[state] : "text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <Icon size={13} strokeWidth={active ? 2.5 : 2} />
          </button>
        );
      })}
    </div>
  );
}

export function WordList({ session, chapterIndex, onOpenWord }: WordListProps) {
  const { t, i18n } = useTranslation();
  const { document } = session;
  const [scope, setScope] = useState<WordScope>("book");
  const [sort, setSort] = useState<WordSort>("relevance");
  const [filter, setFilter] = useState<StateFilter>("all");
  const [query, setQuery] = useState("");
  const [hideNames, setHideNames] = useState(true);
  const [confirmBulk, setConfirmBulk] = useState<KnowledgeState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(480);

  // Heavy recomputation follows state changes without blocking the click that caused them.
  const snapshot = useDeferredValue(session.snapshot);
  const formStates = useDeferredValue(session.formStates);
  const rows = useMemo(
    () => (document ? buildWordRows(document, { snapshot, formStates, lookups: session.lookups, lapses: session.lapses }, scope, chapterIndex) : []),
    [chapterIndex, document, formStates, scope, session.lapses, session.lookups, snapshot],
  );

  const counts = useMemo(() => {
    const result: Record<StateFilter, number> = { all: 0, unknown: 0, learning: 0, known: 0, ignored: 0 };
    for (const row of rows) {
      if (hideNames && row.properNoun) continue;
      result.all += 1;
      result[row.state] += 1;
    }
    return result;
  }, [hideNames, rows]);

  const visible = useMemo(() => {
    const folded = fold(query.trim());
    const filtered = rows.filter((row) =>
      (filter === "all" || row.state === filter)
      && (!hideNames || !row.properNoun)
      && (!folded || fold(row.label).includes(folded) || (row.translation ? fold(row.translation).includes(folded) : false)));
    return sortWordRows(filtered, sort, document?.language ?? i18n.language);
  }, [document?.language, filter, hideNames, i18n.language, query, rows, sort]);

  useEffect(() => {
    setConfirmBulk(null);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setScrollTop(0);
  }, [filter, query, scope, sort, hideNames]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(element.clientHeight || 480));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (!document) return null;

  const first = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const last = Math.min(visible.length, Math.ceil((scrollTop + viewport) / ROW_HEIGHT) + OVERSCAN);
  const slice = visible.slice(first, last);

  const setState = (row: WordRow, state: KnowledgeState) => {
    if (state === "learning" && row.state !== "learning" && row.lexeme !== null) {
      const ordinal = session.index?.lexemeOccurrences(row.lexeme)[0];
      const resolved = ordinal === undefined ? null : session.index?.resolve(ordinal);
      void session.addToVocabulary({
        key: row.key,
        label: row.label,
        itemType: "lexeme",
        sentenceId: resolved?.sentence.id,
        contextForm: resolved ? resolved.block.text.slice(resolved.tuple[0], resolved.tuple[1]) : undefined,
      });
      return;
    }
    void session.setKnowledge(row.key, row.label, state);
  };

  const applyBulk = (state: KnowledgeState) => {
    void session.setManyStates(visible.filter((row) => row.state !== state).map((row) => ({ key: row.key, label: row.label })), state);
    setConfirmBulk(null);
  };

  const scopes: WordScope[] = ["chapter", "book", "all"];
  const sorts: WordSort[] = scope === "all" ? ["recent", "relevance", "frequency", "alphabetical"] : ["relevance", "frequency", "alphabetical"];
  const bulkCount = confirmBulk ? visible.filter((row) => row.state !== confirmBulk).length : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-shrink-0 space-y-2 pb-2">
        <div role="tablist" className="grid grid-cols-3 gap-1 rounded-sm border border-border bg-background p-0.5">
          {scopes.map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={scope === value}
              onClick={() => {
                setScope(value);
                if (value === "all" && sort === "relevance") setSort("recent");
                if (value !== "all" && sort === "recent") setSort("relevance");
              }}
              className={`rounded-[3px] px-1.5 py-1 text-[11px] cursor-pointer ${scope === value ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:text-foreground"}`}
            >
              {dynamicT(t, `learning:words.scopes.${value}`, undefined, value)}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <label className="flex min-w-0 flex-1 items-center gap-1.5 rounded-sm border border-border bg-background px-2 focus-within:border-primary">
            <Search size={12} className="flex-shrink-0 text-foreground-subtle" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("learning:words.search")}
              className="h-7 min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none"
            />
          </label>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as WordSort)}
            aria-label={t("learning:words.sortLabel")}
            className="h-7 rounded-sm border border-border bg-background px-1.5 text-[11px] text-foreground"
          >
            {sorts.map((value) => <option key={value} value={value}>{dynamicT(t, `learning:words.sort.${value}`, undefined, value)}</option>)}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {(["all", ...STATE_ORDER] as StateFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
              className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular-nums cursor-pointer ${
                filter === value ? "border-primary/60 bg-surface-muted text-foreground" : "border-border text-foreground-muted hover:text-foreground"
              }`}
            >
              {value !== "all" && <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[value]}`} />}
              {value === "all" ? t("learning:words.all") : t(stateLabelKey(value))}
              <span className="text-foreground-subtle">{counts[value]}</span>
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-[11px] text-foreground-muted cursor-pointer">
            <input type="checkbox" checked={hideNames} onChange={(event) => setHideNames(event.target.checked)} className="accent-primary" />
            {t("learning:words.hideNames")}
          </label>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="relative min-h-0 flex-1 overflow-y-auto border-y border-border"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
        role="list"
        aria-label={t("learning:words.title")}
      >
        {visible.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-foreground-subtle">
            {scope === "all" && rows.length === 0 ? t("learning:words.emptyAll") : t("learning:words.empty")}
          </p>
        ) : (
          <div style={{ height: visible.length * ROW_HEIGHT, position: "relative" }}>
            {slice.map((row, offset) => (
              <div
                key={row.key}
                role="listitem"
                className="group absolute inset-x-0 flex items-center gap-2 border-b border-border/60 px-1 hover:bg-background"
                style={{ top: (first + offset) * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <button
                  type="button"
                  disabled={row.lexeme === null}
                  onClick={() => row.lexeme !== null && onOpenWord(row.lexeme)}
                  title={row.lexeme !== null ? t("learning:words.openInText") : t("learning:words.notInBook")}
                  className="min-w-0 flex-1 text-left enabled:cursor-pointer"
                >
                  <span className="flex items-baseline gap-1.5">
                    <span className={`h-1.5 w-1.5 flex-shrink-0 self-center rounded-full ${STATE_DOT[row.state]}`} />
                    <span className="truncate text-[13px] text-foreground" lang={document.language}>{row.label}</span>
                    {row.frequency > 0 && <span className="flex-shrink-0 text-[10px] tabular-nums text-foreground-subtle">×{row.frequency}</span>}
                  </span>
                  <span className="block truncate pl-3 text-[11px] text-foreground-subtle">
                    {row.translation ?? (row.lexeme === null ? t("learning:words.notInBook") : "")}
                  </span>
                </button>
                <StateButtons value={row.state} onChange={(state) => setState(row, state)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 pt-2 text-[11px] text-foreground-muted">
        {confirmBulk ? (
          <div className="flex flex-wrap items-center gap-2">
            <span>{t("learning:words.bulkConfirm", { count: bulkCount, state: t(stateLabelKey(confirmBulk)) })}</span>
            <button type="button" onClick={() => applyBulk(confirmBulk)} disabled={bulkCount === 0} className="rounded-sm bg-primary px-2 py-0.5 text-primary-foreground hover:bg-primary-hover disabled:opacity-50 cursor-pointer">{t("learning:words.bulkApply")}</button>
            <button type="button" onClick={() => setConfirmBulk(null)} className="rounded-sm px-2 py-0.5 hover:bg-surface-muted cursor-pointer">{t("learning:actions.cancel")}</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1">
            <span className="mr-1">{t("learning:words.bulkLabel", { count: visible.length })}</span>
            {STATE_ORDER.map((state) => (
              <button key={state} type="button" disabled={visible.length === 0} onClick={() => setConfirmBulk(state)} className="flex items-center gap-1 rounded-sm px-1.5 py-0.5 hover:bg-surface-muted disabled:opacity-40 cursor-pointer">
                <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />{t(stateLabelKey(state))}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

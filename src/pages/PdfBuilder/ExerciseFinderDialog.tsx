import { useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, ListChecks, X } from "lucide-react";
import AnimatedModal from "../../components/ui/AnimatedModal";
import { useTranslation } from "../../i18n/useTranslation";
import {
  visibleSections,
  type ExerciseAnalysis,
  type ExerciseSection,
  type ExerciseSensitivity,
} from "../../core/pdf/exercise-detection";
import { Segmented, ToolButton } from "./BuilderShared";
import { analyzePdfExercises, cachedExerciseAnalysis } from "../../lib/pdfExerciseAnalysis";

export type ExerciseApplyMode = "keep" | "remove" | "select";

export interface ExerciseFinderSource {
  id: string;
  path: string;
  name: string;
  pageCount: number;
}

function useExerciseAnalysis(path: string | null) {
  const [analysis, setAnalysis] = useState<ExerciseAnalysis | null>(() => (path ? cachedExerciseAnalysis(path) : null));
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState({ value: 0, message: "" });

  useEffect(() => {
    if (!path) return undefined;
    let cancelled = false;
    setError(null);
    setAnalysis(cachedExerciseAnalysis(path));
    setProgress({ value: 0, message: "" });
    void analyzePdfExercises(path, (value, message) => {
      if (!cancelled) setProgress({ value: Math.round(value * 100), message: message || "" });
    }).then((result) => {
      if (!cancelled) setAnalysis(result);
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { cancelled = true; };
  }, [path]);

  return { analysis, error, progress };
}

function pageRangeLabel(pages: number[]) {
  const first = pages[0]! + 1;
  const last = pages[pages.length - 1]! + 1;
  return first === last ? `${first}` : `${first}–${last}`;
}

function Check({ checked, indeterminate, onChange, label }: { checked: boolean; indeterminate?: boolean; onChange: () => void; label: string }) {
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={checked}
      ref={(node) => { if (node) node.indeterminate = Boolean(indeterminate); }}
      onChange={onChange}
      onClick={(event) => event.stopPropagation()}
      className="h-4 w-4 flex-shrink-0 cursor-pointer accent-primary"
    />
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-primary" />
      {label}
    </label>
  );
}

export function ExerciseFinderDialog({ source, onClose, onApply, renderThumb }: {
  source: ExerciseFinderSource | null;
  onClose: () => void;
  /** Zero-based page indices of the source, ascending. */
  onApply: (source: ExerciseFinderSource, pages: number[], mode: ExerciseApplyMode) => void;
  renderThumb: (source: ExerciseFinderSource, pageIndex: number) => ReactNode;
}) {
  const { t } = useTranslation();
  const { analysis, error, progress } = useExerciseAnalysis(source?.path ?? null);
  const [sensitivity, setSensitivity] = useState<ExerciseSensitivity>("balanced");
  const [includeSolutions, setIncludeSolutions] = useState(false);
  const [includeInline, setIncludeInline] = useState(false);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [excludedPages, setExcludedPages] = useState<Set<number>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const sections = useMemo(
    () => (analysis ? visibleSections(analysis, { sensitivity, includeSolutions, includeInline }) : []),
    [analysis, includeInline, includeSolutions, sensitivity],
  );

  // Every visible section starts selected; changing the filters resets the choice.
  useEffect(() => {
    setChosen(new Set(sections.map((section) => section.id)));
    setExcludedPages(new Set());
  }, [sections]);

  const groups = useMemo(() => {
    const byChapter = new Map<number, ExerciseSection[]>();
    for (const section of sections) byChapter.set(section.chapterIndex, [...(byChapter.get(section.chapterIndex) ?? []), section]);
    return [...byChapter.entries()].sort(([a], [b]) => a - b);
  }, [sections]);

  const selectedPages = useMemo(() => {
    const pages = new Set<number>();
    for (const section of sections) {
      if (!chosen.has(section.id)) continue;
      for (const page of section.pages) if (!excludedPages.has(page)) pages.add(page);
    }
    return [...pages].sort((a, b) => a - b);
  }, [chosen, excludedPages, sections]);

  const toggle = <T,>(set: Set<T>, value: T) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    return next;
  };

  const chapterTitle = (index: number) => (index < 0 || !analysis ? t("conversion:builder.exercises.noChapter") : analysis.chapters[index]?.title || "");
  const kindLabel = (section: ExerciseSection) => t(`conversion:builder.exercises.kinds.${section.kind}`);
  const confidenceLabel = (value: number) => t(value >= 0.8 ? "conversion:builder.exercises.confidence.high" : value >= 0.6 ? "conversion:builder.exercises.confidence.medium" : "conversion:builder.exercises.confidence.low");

  const apply = (mode: ExerciseApplyMode) => {
    if (source && selectedPages.length) onApply(source, selectedPages, mode);
  };

  return (
    <AnimatedModal
      open={Boolean(source)}
      onBackdropClick={onClose}
      ariaLabel={t("conversion:builder.exercises.title")}
      className="flex h-[min(82vh,760px)] w-[min(92vw,820px)] flex-col overflow-hidden rounded-sm border border-border bg-background text-foreground shadow-2xl"
    >
      <div className="flex items-start gap-3 border-b border-border px-4 py-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary-muted text-primary"><ListChecks size={16} /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">{t("conversion:builder.exercises.title")}</h2>
          <p className="truncate text-xs text-foreground-subtle" title={source?.path}>{source?.name}</p>
        </div>
        <button type="button" onClick={onClose} aria-label={t("conversion:builder.exercises.close")} className="rounded-sm p-1.5 text-foreground-muted hover:bg-surface-muted hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      {!analysis && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center" role="status">
          <p className="text-sm font-medium">{t("conversion:builder.exercises.analyzing")}</p>
          <div className="h-1.5 w-64 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${Math.max(3, progress.value)}%` }} />
          </div>
          <p className="text-xs text-foreground-subtle">{progress.message || t("conversion:builder.exercises.analyzingHint")}</p>
        </div>
      )}

      {error && (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive" role="alert">
          {t("conversion:builder.exercises.failed", { message: error })}
        </div>
      )}

      {analysis && (
        <>
          <div className="space-y-2 border-b border-border px-4 py-3">
            {analysis.textLayer !== "full" && (
              <p className="flex items-start gap-2 rounded-sm bg-warning-muted px-2.5 py-2 text-xs text-foreground">
                <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-warning" />
                {t(analysis.textLayer === "none" ? "conversion:builder.exercises.noText" : "conversion:builder.exercises.partialText")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <div className="w-64">
                <Segmented<ExerciseSensitivity>
                  label={t("conversion:builder.exercises.sensitivity")}
                  value={sensitivity}
                  onChange={setSensitivity}
                  options={[
                    { value: "strict", label: t("conversion:builder.exercises.sensitivities.strict"), hint: t("conversion:builder.exercises.sensitivityHints.strict") },
                    { value: "balanced", label: t("conversion:builder.exercises.sensitivities.balanced"), hint: t("conversion:builder.exercises.sensitivityHints.balanced") },
                    { value: "broad", label: t("conversion:builder.exercises.sensitivities.broad"), hint: t("conversion:builder.exercises.sensitivityHints.broad") },
                  ]}
                />
              </div>
              <Toggle checked={includeSolutions} onChange={setIncludeSolutions} label={t("conversion:builder.exercises.includeSolutions")} />
              <Toggle checked={includeInline} onChange={setIncludeInline} label={t("conversion:builder.exercises.includeInline")} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {sections.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm font-medium">{t("conversion:builder.exercises.none")}</p>
                <p className="max-w-md text-xs text-foreground-subtle">{t("conversion:builder.exercises.noneHint")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {groups.map(([chapterIndex, chapterSections]) => {
                  const chosenCount = chapterSections.filter((section) => chosen.has(section.id)).length;
                  return (
                    <section key={chapterIndex} className="rounded-sm border border-border">
                      <header className="flex items-center gap-2 border-b border-border bg-surface/50 px-3 py-2">
                        <Check
                          label={chapterTitle(chapterIndex)}
                          checked={chosenCount === chapterSections.length}
                          indeterminate={chosenCount > 0 && chosenCount < chapterSections.length}
                          onChange={() => setChosen((current) => {
                            const next = new Set(current);
                            const all = chosenCount === chapterSections.length;
                            for (const section of chapterSections) {
                              if (all) next.delete(section.id);
                              else next.add(section.id);
                            }
                            return next;
                          })}
                        />
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold">{chapterTitle(chapterIndex)}</span>
                      </header>
                      <ul>
                        {chapterSections.map((section) => {
                          const open = expanded.has(section.id);
                          const excluded = section.pages.filter((page) => excludedPages.has(page)).length;
                          return (
                            <li key={section.id} className="border-b border-border last:border-b-0">
                              <div
                                className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-surface-muted/60"
                                onClick={() => setExpanded((current) => toggle(current, section.id))}
                              >
                                <Check label={section.title || kindLabel(section)} checked={chosen.has(section.id)} onChange={() => setChosen((current) => toggle(current, section.id))} />
                                {open ? <ChevronDown size={14} className="text-foreground-subtle" /> : <ChevronRight size={14} className="text-foreground-subtle" />}
                                <span className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ${
                                  section.kind === "solution" ? "bg-success-muted text-success" : section.kind === "inline" ? "bg-surface-muted text-foreground-muted" : "bg-primary-muted text-primary"
                                }`}>
                                  {kindLabel(section)}
                                </span>
                                <span className="min-w-0 flex-1 truncate text-xs">{section.title || t(`conversion:builder.exercises.methods.${section.method}`)}</span>
                                <span className="text-[11px] tabular-nums text-foreground-subtle">
                                  {t("conversion:builder.exercises.pages", { count: section.pages.length - excluded, range: pageRangeLabel(section.pages) })}
                                </span>
                                <span
                                  className={`h-2 w-2 flex-shrink-0 rounded-full ${section.confidence >= 0.8 ? "bg-success" : section.confidence >= 0.6 ? "bg-warning" : "bg-destructive"}`}
                                  title={`${confidenceLabel(section.confidence)} · ${t(`conversion:builder.exercises.methods.${section.method}`)}`}
                                />
                              </div>
                              {open && (
                                <div className="space-y-2 px-3 pb-3">
                                  <p className="text-[11px] text-foreground-subtle">
                                    {[
                                      t(`conversion:builder.exercises.methods.${section.method}`),
                                      confidenceLabel(section.confidence),
                                      section.itemCount ? t("conversion:builder.exercises.items", { count: section.itemCount }) : null,
                                      section.startsMidPage ? t("conversion:builder.exercises.startsMid") : null,
                                      section.endsMidPage ? t("conversion:builder.exercises.endsMid") : null,
                                    ].filter(Boolean).join(" · ")}
                                  </p>
                                  <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
                                    {section.pages.map((page) => {
                                      const off = excludedPages.has(page);
                                      return (
                                        <button
                                          key={page}
                                          type="button"
                                          onClick={() => setExcludedPages((current) => toggle(current, page))}
                                          title={t(off ? "conversion:builder.exercises.includePage" : "conversion:builder.exercises.excludePage")}
                                          className={`relative rounded-sm border p-1 text-left transition-colors ${off ? "border-border opacity-40 grayscale" : "border-primary/60"}`}
                                        >
                                          {source && renderThumb(source, page)}
                                          <span className="absolute left-1.5 top-1.5 rounded-sm bg-overlay px-1 text-[10px] font-semibold tabular-nums">{page + 1}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface/40 px-4 py-3">
            <span className="mr-auto text-xs text-foreground-muted">
              {t("conversion:builder.exercises.selectedPages", { count: selectedPages.length, total: analysis.pageCount })}
            </span>
            <ToolButton variant="ghost" onClick={() => apply("select")} disabled={!selectedPages.length} title={t("conversion:builder.exercises.selectHint")}>
              {t("conversion:builder.exercises.select")}
            </ToolButton>
            <ToolButton onClick={() => apply("remove")} disabled={!selectedPages.length} title={t("conversion:builder.exercises.removeHint")}>
              {t("conversion:builder.exercises.remove")}
            </ToolButton>
            <ToolButton variant="primary" onClick={() => apply("keep")} disabled={!selectedPages.length}>
              {t("conversion:builder.exercises.keep")}
            </ToolButton>
          </div>
        </>
      )}
    </AnimatedModal>
  );
}

import { useDeferredValue, useMemo, useState } from "react";
import { AlertTriangle, Archive, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";
import {
  computeCoverage,
  dueItems,
  hardestChapters,
  rankDifficultWords,
  recommendWordsToLearn,
  retentionState,
  summarizeChapters,
  type DifficultWord,
} from "../../../../core/language-learning";
import { useTranslation } from "../../../../i18n";
import type { LearningSession } from "./useLearningSession";
import { IconButton } from "./parts";
import { dynamicT, percent, STATE_DOT, stateLabelKey } from "./uiHelpers";
import { ReviewSession } from "./ReviewSession";
import { WordList } from "./WordList";
import type { LearningReaderSettings } from "../../../../features/language-learning/settings";

export type LearningTab = "words" | "progress" | "chapters" | "review" | "notes";

interface LearningPanelProps {
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
  onClose(): void;
}

function CoverageBar({ known, learning, unknown }: { known: number; learning: number; unknown: number }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-muted" aria-hidden>
      <div className="bg-success" style={{ width: `${known}%` }} />
      <div className="bg-warning" style={{ width: `${learning}%` }} />
      <div className="bg-info/70" style={{ width: `${unknown}%` }} />
    </div>
  );
}


function ProgressTab({ session, chapterIndex, onWord, onTab }: LearningPanelProps) {
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
    <div className="space-y-5">
      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("learning:progress.coverage")}</h3>
        <div className="space-y-3">
          <div>
            <div className="mb-1 flex justify-between text-xs"><span className="text-foreground-muted">{t("learning:progress.occurrenceCoverage")}</span><span className="tabular-nums text-foreground">{percent(coverage.occurrenceCoverage.known)}</span></div>
            <CoverageBar {...coverage.occurrenceCoverage} />
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs"><span className="text-foreground-muted">{t("learning:progress.uniqueCoverage")}</span><span className="tabular-nums text-foreground">{percent(coverage.uniqueCoverage.known)}</span></div>
            <CoverageBar {...coverage.uniqueCoverage} />
          </div>
          <p className="text-[11px] leading-relaxed text-foreground-subtle">{t("learning:progress.coverageHint")}</p>
        </div>
        <table className="mt-3 w-full text-xs">
          <thead>
            <tr className="text-foreground-subtle">
              <th className="py-1 text-left font-normal" />
              <th className="py-1 text-right font-normal">{t("learning:progress.entries")}</th>
              <th className="py-1 text-right font-normal">{t("learning:progress.occurrences")}</th>
            </tr>
          </thead>
          <tbody>
            {(["known", "learning", "unknown", "ignored"] as const).map((state) => (
              <tr key={state} className="border-t border-border">
                <td className="py-1.5"><span className={`mr-2 inline-block h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />{t(stateLabelKey(state))}</td>
                <td className="py-1.5 text-right tabular-nums">{coverage.unique[state]}</td>
                <td className="py-1.5 text-right tabular-nums">{coverage.occurrences[state]}</td>
              </tr>
            ))}
            <tr className="border-t border-border font-semibold">
              <td className="py-1.5">{t("learning:progress.total")}</td>
              <td className="py-1.5 text-right tabular-nums">{coverage.unique.total}</td>
              <td className="py-1.5 text-right tabular-nums">{coverage.occurrences.total}</td>
            </tr>
          </tbody>
        </table>
      </section>


      {recommendation && recommendation.words.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("learning:progress.recommendation")}</h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("learning:progress.recommendationText", {
              count: recommendation.words.length,
              from: percent(recommendation.currentCoverage),
              to: percent(recommendation.projectedCoverage),
            })}
          </p>
          <div className="flex flex-wrap gap-1">
            {recommendation.words.map((word) => (
              <button key={word.lexeme} type="button" onClick={() => onWord(word)} className="rounded-sm border border-border px-1.5 py-0.5 text-xs text-foreground hover:border-primary cursor-pointer" lang={document.language}>
                {word.lemma}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">{t("learning:progress.difficult")}</h3>
        {difficult.length === 0 ? (
          <p className="text-xs text-foreground-subtle">{t("learning:progress.noDifficult")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {difficult.map((word) => (
              <li key={word.lexeme}>
                <button type="button" onClick={() => onWord(word)} className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-xs hover:text-foreground cursor-pointer">
                  <span className="flex items-center gap-2 text-foreground" lang={document.language}>
                    <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[word.state]}`} />{word.lemma}
                  </span>
                  <span className="text-foreground-subtle tabular-nums" title={t("learning:progress.difficultReason", { frequency: word.frequency, unlocks: word.unlocksSentences, lookups: word.lookups })}>
                    ×{word.frequency}{word.unlocksSentences > 0 ? ` · +${word.unlocksSentences}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-1 text-[11px] text-foreground-subtle">{t("learning:progress.difficultHint")}</p>
        <button type="button" onClick={() => onTab("words")} className="mt-2 text-xs font-medium text-primary hover:underline cursor-pointer">
          {t("learning:words.seeAll")}
        </button>
      </section>
    </div>
  );
}

function ChaptersTab({ session, chapterIndex, onChapter, onWord }: LearningPanelProps) {
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
    <ul className="space-y-2">
      {summaries.map((summary) => (
        <li key={summary.chapterId} className={`rounded-sm border p-2 ${summary.chapterIndex === chapterIndex ? "border-primary/60" : "border-border"}`}>
          <button type="button" onClick={() => onChapter(summary.chapterIndex)} className="w-full text-left cursor-pointer">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="truncate text-foreground">{summary.title}</span>
              <span className="flex-shrink-0 tabular-nums text-foreground-muted">
                {readingState?.completedChapters.includes(summary.chapterId) && <span className="mr-1 text-success">✓</span>}
                {percent(summary.coverage.occurrenceCoverage.known)}
              </span>
            </div>
            <div className="mt-1.5"><CoverageBar {...summary.coverage.occurrenceCoverage} /></div>
            <div className="mt-1 flex justify-between text-[10px] text-foreground-subtle">
              <span>{t("learning:chapters.unknownShare", { value: percent(summary.coverage.occurrenceCoverage.unknown) })}</span>
              {hardest.has(summary.chapterIndex) && summaries.length > 3 && <span className="text-warning">{t("learning:chapters.hardest")}</span>}
            </div>
          </button>
          {summary.topUnknown.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {summary.topUnknown.map((word) => (
                <button key={word.lexeme} type="button" onClick={() => onWord(word)} className="rounded-sm bg-background px-1.5 py-0.5 text-[11px] text-foreground-muted hover:text-foreground cursor-pointer" lang={document.language}>
                  {word.lemma} <span className="text-foreground-subtle">{word.frequency}</span>
                </button>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function ReviewTab(props: LearningPanelProps) {
  const { t } = useTranslation();
  const { session } = props;
  const [reviewing, setReviewing] = useState(false);
  const due = useMemo(() => dueItems(session.activeReviewItems), [session.activeReviewItems]);
  const counts = useMemo(() => {
    const result = { new: 0, learning: 0, young: 0, mature: 0 };
    for (const item of session.activeReviewItems) result[retentionState(item)] += 1;
    return result;
  }, [session.activeReviewItems]);

  if (reviewing) {
    return <ReviewSession session={session} speechAvailable={props.speechAvailable} nativeLanguage={props.settings.nativeLanguage} onSpeak={props.onSpeak} onDone={() => setReviewing(false)} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-sm bg-background p-3">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{due.length}</p>
        <p className="text-xs text-foreground-muted">{t("learning:review.due")}</p>
        <button
          type="button"
          disabled={due.length === 0}
          onClick={() => setReviewing(true)}
          className="mt-3 w-full rounded-sm bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-foreground-subtle cursor-pointer"
        >
          {t("learning:review.start")}
        </button>
        <p className="mt-2 text-[11px] text-foreground-subtle">{t("learning:review.positionKept")}</p>
      </div>
      <dl className="grid grid-cols-4 gap-1 text-center text-xs">
        {(["new", "learning", "young", "mature"] as const).map((state) => (
          <div key={state} className="rounded-sm bg-background p-1.5">
            <dd className="font-semibold tabular-nums text-foreground">{counts[state]}</dd>
            <dt className="text-[10px] text-foreground-subtle">{dynamicT(t, `learning:review.retention.${state}`, undefined, state)}</dt>
          </div>
        ))}
      </dl>
      <ul className="divide-y divide-border">
        {session.activeReviewItems.length === 0 && (
          <li className="py-3 text-xs text-foreground-subtle">{t("learning:review.emptyQueue")}</li>
        )}
        {session.activeReviewItems.slice().sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt)).map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
            <div className="min-w-0">
              <p className="truncate text-foreground">{item.label}</p>
              <p className="truncate text-foreground-subtle">{item.translation ?? t("learning:review.noTranslation")}</p>
            </div>
            <span className="flex-shrink-0 text-[10px] text-foreground-subtle">{dynamicT(t, `learning:review.retention.${retentionState(item)}`, undefined, "")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotesTab({ session, onAnnotation }: LearningPanelProps) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<string>("");
  const categories = useMemo(() => Array.from(new Set(session.annotations.map((a) => a.category).filter(Boolean))).sort(), [session.annotations]);
  const visible = session.annotations.filter((annotation) => !filter || annotation.category === filter);
  if (session.annotations.length === 0) return <p className="text-xs text-foreground-subtle">{t("learning:annotations.empty")}</p>;
  return (
    <div className="space-y-3">
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {["", ...categories].map((category) => (
            <button key={category || "all"} type="button" onClick={() => setFilter(category)} className={`rounded-sm px-1.5 py-0.5 text-[11px] cursor-pointer ${filter === category ? "bg-surface-muted text-foreground" : "text-foreground-muted"}`}>
              {category || t("learning:annotations.all")}
            </button>
          ))}
        </div>
      )}
      <ul className="space-y-2">
        {visible.map((annotation) => (
          <li key={annotation.id} className="group rounded-sm border border-border p-2">
            <button type="button" onClick={() => onAnnotation(annotation.id)} className="w-full text-left cursor-pointer">
              <p className="line-clamp-2 font-serif text-[13px] text-foreground-muted">“{annotation.quote}”</p>
              {annotation.note && <p className="mt-1 text-xs text-foreground">{annotation.note}</p>}
            </button>
            <div className="mt-1 flex items-center justify-between text-[10px] text-foreground-subtle">
              <span>{annotation.category || dynamicT(t, `learning:annotations.targets.${annotation.targetType}`, undefined, annotation.targetType)}</span>
              <button type="button" className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive cursor-pointer" onClick={() => void session.deleteAnnotation(annotation.id)} aria-label={t("learning:actions.delete")}>
                <Trash2 size={12} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RecoveryNotice({ session }: { session: LearningSession }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const bucket = session.strayBuckets[0];
  if (!bucket || !session.document) return null;
  const fromLabel = bucket.userId === session.userId ? bucket.language : t("learning:recovery.signedOut", { language: bucket.language });
  return (
    <div className="mx-3 mt-3 rounded-sm border border-warning/40 bg-warning/10 p-2.5 text-xs text-foreground">
      <p className="font-medium">{t("learning:recovery.title", { count: bucket.count, from: fromLabel })}</p>
      <p className="mt-1 text-foreground-muted">{t("learning:recovery.body", { overlap: bucket.overlap, to: session.document.language })}</p>
      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await session.mergeStrayBucket(bucket);
            setBusy(false);
          }}
          className="rounded-sm bg-primary px-2 py-1 font-semibold text-primary-foreground hover:bg-primary-hover disabled:opacity-60 cursor-pointer"
        >
          {t("learning:recovery.merge", { to: session.document.language })}
        </button>
        <button type="button" onClick={() => session.dismissStrayBucket(bucket)} className="rounded-sm px-2 py-1 text-foreground-muted hover:bg-surface-muted cursor-pointer">
          {t("learning:recovery.dismiss")}
        </button>
      </div>
    </div>
  );
}

function BackupFooter({ session }: { session: LearningSession }) {
  const { t } = useTranslation();
  const exportBackup = async () => {
    const result = await session.client.exportBackup();
    if (result.success) toast.success(t("learning:backup.exported"));
    else if ("error" in result && result.error !== "CANCELLED") toast.error(t("learning:backup.failed"));
  };
  const importBackup = async () => {
    const result = await session.client.importBackup();
    if (result.success) {
      toast.success(t("learning:backup.imported", { count: result.knowledge }));
      session.reload();
    } else if ("error" in result && result.error !== "CANCELLED") {
      toast.error(t("learning:backup.failed"));
    }
  };
  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-foreground-subtle">
      {session.saveStatus === "error" ? <AlertTriangle size={12} className="text-destructive" /> : <Archive size={12} />}
      <span className={`mr-auto ${session.saveStatus === "error" ? "text-destructive" : ""}`} role="status">
        {session.saveStatus === "saving" ? t("learning:save.saving")
          : session.saveStatus === "error" ? t("learning:save.error")
          : session.saveStatus === "saved" ? t("learning:save.saved")
          : t("learning:backup.auto")}
      </span>
      <button type="button" onClick={() => void exportBackup()} className="hover:text-foreground cursor-pointer">{t("learning:backup.export")}</button>
      <button type="button" onClick={() => void importBackup()} className="hover:text-foreground cursor-pointer">{t("learning:backup.import")}</button>
      <button type="button" onClick={() => void session.client.openBackupsFolder()} className="hover:text-foreground cursor-pointer">{t("learning:backup.folder")}</button>
    </div>
  );
}

export function LearningPanel(props: LearningPanelProps) {
  const { t } = useTranslation();
  const dueCount = useMemo(() => dueItems(props.session.activeReviewItems).length, [props.session.activeReviewItems]);
  const tabs: LearningTab[] = ["words", "progress", "chapters", "review", "notes"];
  return (
    <aside className="flex h-full w-full flex-col border-l border-border bg-surface" aria-label={t("learning:panel.title")}>
      <div className="flex h-10 flex-shrink-0 items-center justify-between border-b border-border pl-1 pr-2">
        <div role="tablist" className="flex min-w-0 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => (
            <button
              key={tab}
              role="tab"
              type="button"
              aria-selected={props.tab === tab}
              onClick={() => props.onTab(tab)}
              className={`flex-shrink-0 border-b-2 px-1.5 py-2 text-[11.5px] cursor-pointer ${props.tab === tab ? "border-primary text-foreground" : "border-transparent text-foreground-muted hover:text-foreground"}`}
            >
              {dynamicT(t, `learning:panel.tabs.${tab}`, undefined, tab)}
              {tab === "review" && dueCount > 0 && <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">{dueCount}</span>}
            </button>
          ))}
        </div>
        <div className="flex flex-shrink-0 items-center">
          <IconButton label={t("learning:actions.close")} onClick={props.onClose}><X size={14} /></IconButton>
        </div>
      </div>
      <RecoveryNotice session={props.session} />
      {props.tab === "words" ? (
        <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
          <WordList session={props.session} chapterIndex={props.chapterIndex} onOpenWord={(lexeme) => props.onWord({ lexeme })} />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {props.tab === "progress" && <ProgressTab {...props} />}
          {props.tab === "chapters" && <ChaptersTab {...props} />}
          {props.tab === "review" && <ReviewTab {...props} />}
          {props.tab === "notes" && <NotesTab {...props} />}
        </div>
      )}
      <BackupFooter session={props.session} />
    </aside>
  );
}

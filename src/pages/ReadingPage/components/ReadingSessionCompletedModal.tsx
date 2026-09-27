import {
  BookOpen,
  Clock,
  Zap,
  X,
  ChevronRight,
  Target,
  Flame,
  ChevronDown,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { springFast, subtleScale } from "../../../utils/motionPresets";
import {
  formatNumber,
  getActiveLocale,
  useTranslation,
  type TranslationKey,
} from "../../../i18n";

interface SessionData {
  id: string;
  sourceName: string;
  date: Date;
  category: string;
  spentTimeMinutes: number;
  totalWords: number;
  initialPage: number;
  finalPage: number;
}

interface Props {
  session: SessionData;
  totalBookPages: number;
  onReset: () => void;
  onClose: () => void;
  onSubmit: () => void;
}

const CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  math: "reading:session.completed.categories.math",
  science: "reading:session.completed.categories.science",
  history: "reading:session.completed.categories.history",
  fiction: "reading:session.completed.categories.fiction",
  philosophy: "reading:session.completed.categories.philosophy",
  technology: "reading:session.completed.categories.technology",
  biography: "reading:session.completed.categories.biography",
  self_help: "reading:session.completed.categories.self_help",
};

function getRhythm(wpm: number): {
  labelKey: TranslationKey;
  color: string;
  descriptionKey: TranslationKey;
} {
  if (wpm < 100)
    return {
      labelKey: "reading:session.completed.rhythm.levels.light.label",
      color: "text-blue-400",
      descriptionKey: "reading:session.completed.rhythm.levels.light.description",
    };
  if (wpm < 150)
    return {
      labelKey: "reading:session.completed.rhythm.levels.moderate.label",
      color: "text-green-400",
      descriptionKey: "reading:session.completed.rhythm.levels.moderate.description",
    };
  if (wpm < 200)
    return {
      labelKey: "reading:session.completed.rhythm.levels.intense.label",
      color: "text-amber-400",
      descriptionKey: "reading:session.completed.rhythm.levels.intense.description",
    };
  return {
    labelKey: "reading:session.completed.rhythm.levels.fast.label",
    color: "text-red-400",
    descriptionKey: "reading:session.completed.rhythm.levels.fast.description",
  };
}

function formatSessionDate(date: Date) {
  return new Intl.DateTimeFormat(getActiveLocale(), {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function StatPill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center p-3 rounded-sm border ${
        accent
          ? "bg-green-950/30 border-green-800/40"
          : "bg-zinc-800/60 border-zinc-700/40"
      }`}
    >
      <span
        className={`text-lg font-bold tabular-nums ${accent ? "text-green-400" : "text-zinc-100"}`}
      >
        {value}
      </span>
      <span className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5 text-center leading-tight">
        {label}
      </span>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={13} className="text-green-500" />
      <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-500 font-semibold">
        {label}
      </span>
      <div className="flex-1 h-px bg-zinc-800" />
    </div>
  );
}

export default function ReadingSessionCompletedModal({
  session,
  totalBookPages,
  onReset,
  onClose,
  onSubmit,
}: Props) {
  const { t, i18n } = useTranslation();
  const reduceMotion = useReducedMotion();
  const pagesRead = session.finalPage - session.initialPage;
  const totalWords = session.totalWords;
  const wpm =
    session.spentTimeMinutes > 0
      ? Math.round(totalWords / session.spentTimeMinutes)
      : 0;
  const pagesPerMinute =
    session.spentTimeMinutes > 0
      ? (pagesRead / session.spentTimeMinutes).toFixed(2)
      : "0";
  const wordsPerPage = pagesRead > 0 ? Math.round(totalWords / pagesRead) : 0;
  const avgSecsPerPage =
    pagesRead > 0
      ? ((session.spentTimeMinutes * 60) / pagesRead).toFixed(1)
      : "0";
  const avgMinsPerPage =
    pagesRead > 0 ? (session.spentTimeMinutes / pagesRead).toFixed(2) : "0";

  const sessionProgress =
    totalBookPages > 0 ? ((pagesRead / totalBookPages) * 100).toFixed(1) : "0";
  const accumulatedProgress =
    totalBookPages > 0
      ? ((session.finalPage / totalBookPages) * 100).toFixed(1)
      : 0;
  const remainingPercent = (100 - Number(accumulatedProgress)).toFixed(1);
  const remainingPages = totalBookPages - Number(session.finalPage);
  const estimatedFinishMins =
    Number(pagesPerMinute) > 0
      ? Math.round(remainingPages / Number(pagesPerMinute))
      : null;
  const estimatedFinishHours = estimatedFinishMins
    ? `${Math.floor(estimatedFinishMins / 60)}h ${estimatedFinishMins % 60}min`
    : "—";

  const rhythm = getRhythm(wpm);
  const categoryKey = CATEGORY_LABEL_KEYS[session.category];
  const categoryLabel = categoryKey ? t(categoryKey) : session.category;

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.80)", backdropFilter: "blur(6px)" }}
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16 }}
    >
      <motion.div
        className="relative bg-zinc-900 border border-zinc-800 rounded-sm w-full shadow-2xl flex flex-col"
        variants={reduceMotion ? undefined : subtleScale}
        initial={reduceMotion ? false : "hidden"}
        animate="visible"
        transition={springFast}
        style={{
          maxWidth: 560,
          maxHeight: "92vh",
          boxShadow:
            "0 0 80px rgba(22,163,74,0.12), 0 30px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* Top glow stripe */}
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-sm"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(22,163,74,0.6), transparent)",
          }}
        />

        {/* ── HEADER ── */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-green-950/50 border border-green-800/40 flex items-center justify-center">
              <BookOpen size={18} className="text-green-400" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-zinc-100"
                style={{ fontFamily: "'Georgia', serif" }}
              >
                {t("reading:session.completed.title")}
              </h2>
              <p className="text-[11px] text-zinc-500">
                {formatSessionDate(session.date)}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              onReset();
            }}
            title={t("reading:session.completed.closeTitle")}
            aria-label={t("reading:session.completed.closeAriaLabel")}
            className="mt-0.5 text-zinc-600 cursor-pointer hover:text-zinc-400 transition-colors p-1 rounded-sm hover:bg-zinc-800"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── BOOK IDENTITY ── */}
        <div className="mx-6 mb-4 p-4 rounded-sm bg-zinc-800/40 border border-zinc-700/30 flex items-center gap-3 shrink-0">
          <div
            className="w-10 h-14 rounded-sm flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-zinc-400 border border-zinc-700"
            style={{
              background:
                "linear-gradient(160deg, var(--ui-zinc-800), var(--ui-zinc-900))",
              writingMode: "vertical-rl",
            }}
          >
            {categoryLabel.slice(0, 3).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-zinc-100 font-semibold text-sm leading-snug truncate">
              {session.sourceName}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] bg-green-950/60 text-green-400 border border-green-800/40 px-2 py-0.5 rounded-full">
                {categoryLabel}
              </span>
              <span className="text-[10px] text-zinc-600">
                {t("reading:session.completed.focusMinutes", {
                  count: session.spentTimeMinutes,
                })}
              </span>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold text-green-400 tabular-nums">
              {accumulatedProgress}%
            </p>
            <p className="text-[10px] text-zinc-600">
              {t("reading:session.completed.ofTheBook")}
            </p>
          </div>
        </div>

        {/* ── SCROLLABLE CONTENT ── */}
        <div
          className="overflow-y-auto flex-1 px-6 pb-2 space-y-5"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "var(--ui-zinc-700) transparent",
          }}
        >
          {/* Progress bar */}
          <div>
            <div className="flex justify-between text-[10px] text-zinc-500 mb-1.5">
              <span>
                {t("reading:session.completed.page", { page: session.initialPage })}
              </span>
              <span className="text-green-400 font-medium">
                {t("reading:session.completed.pagesThisSession", { count: pagesRead })}
              </span>
              <span>
                {t("reading:session.completed.pageOfTotal", {
                  page: session.finalPage,
                  total: totalBookPages,
                })}
              </span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              {/* Accumulated */}
              <div
                className="h-full rounded-full relative"
                style={{
                  width: `${accumulatedProgress}%`,
                  background:
                    "linear-gradient(90deg, var(--accent-700), var(--accent-500))",
                  transition: "width 0.8s ease",
                }}
              >
                {/* Session portion indicator */}
                <div
                  className="absolute right-0 top-0 h-full rounded-r-full opacity-80"
                  style={{
                    width: `${(pagesRead / Number(session.finalPage)) * 100}%`,
                    background:
                      "color-mix(in srgb, var(--accent-300) 50%, transparent)",
                  }}
                />
              </div>
            </div>
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-zinc-600">
                {t("reading:session.completed.remainingWithPages", {
                  percent: remainingPercent,
                  pages: remainingPages,
                })}
              </span>
              <span className="text-zinc-600">
                {t("reading:session.completed.estimatedFinish", {
                  time: estimatedFinishHours,
                })}
              </span>
            </div>
          </div>

          {/* ── DADOS BÁSICOS ── */}
          <div>
            <SectionTitle icon={Clock} label={t("reading:session.completed.sections.sessionData")} />
            <div className="grid grid-cols-4 gap-2">
              <StatPill
                label={t("reading:session.completed.stats.pagesRead")}
                value={String(pagesRead)}
                accent
              />
              <StatPill
                label={t("reading:session.completed.stats.time")}
                value={`${session.spentTimeMinutes}min`}
                accent
              />
              <StatPill
                label={t("reading:session.completed.stats.sessionInBook")}
                value={`${sessionProgress}%`}
              />
              <StatPill
                label={t("reading:session.completed.stats.accumulated")}
                value={`${accumulatedProgress}%`}
              />
            </div>
          </div>

          {/* ── VELOCIDADE ── */}
          <div>
            <SectionTitle icon={Zap} label={t("reading:session.completed.sections.speed")} />
            <div className="grid grid-cols-3 gap-2 mb-2">
              <StatPill label="WPM" value={String(wpm)} accent />
              <StatPill
                label={t("reading:session.completed.stats.pagesPerMinute")}
                value={pagesPerMinute}
              />
              <StatPill
                label={t("reading:session.completed.stats.totalWords")}
                value={formatNumber(Number(totalWords), i18n.language)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatPill
                label={t("reading:session.completed.stats.wordsPerPage")}
                value={String(wordsPerPage)}
              />
              <StatPill
                label={t("reading:session.completed.stats.timePerPageSec")}
                value={`${avgSecsPerPage}s`}
              />
              <StatPill
                label={t("reading:session.completed.stats.timePerPageMin")}
                value={`${avgMinsPerPage}min`}
              />
            </div>
          </div>

          {/* ── RITMO ── */}
          <div className="flex items-center justify-between p-3.5 rounded-sm bg-zinc-800/40 border border-zinc-700/30">
            <div className="flex items-center gap-3">
              <Flame size={18} className={rhythm.color} />
              <div>
                <p className="text-xs text-zinc-400">
                  {t("reading:session.completed.rhythm.title")}
                </p>
                <p className={`text-sm font-bold ${rhythm.color}`}>
                  {t(rhythm.labelKey)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[11px] text-zinc-500">
                {t(rhythm.descriptionKey)}
              </p>
              <p className="text-[11px] text-zinc-600">
                {t("reading:session.completed.rhythm.wpm", { count: wpm })}
              </p>
            </div>
          </div>

          {/* ── PROJEÇÃO ── */}
          <div>
            <SectionTitle icon={Target} label={t("reading:session.completed.sections.projection")} />
            <div className="grid grid-cols-3 gap-2">
              <StatPill
                label={t("reading:session.completed.stats.remainingPercent")}
                value={`${remainingPercent}%`}
              />
              <StatPill
                label={t("reading:session.completed.stats.remainingPages")}
                value={String(remainingPages)}
              />
              <StatPill
                label={t("reading:session.completed.stats.estimatedTime")}
                value={estimatedFinishHours}
                accent
              />
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="px-6 py-4 border-t border-zinc-800/60 flex gap-3 shrink-0">
          <button
            title={t("reading:session.completed.continueTitle")}
            onClick={onClose}
            className="flex items-center cursor-pointer justify-center gap-2 flex-1 py-2.5 rounded-sm border border-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-800 hover:border-zinc-600 transition-colors"
          >
            {t("reading:session.completed.continue")}
            <ChevronDown size={16} />
          </button>
          <button
            onClick={() => {
              onClose();
              onSubmit();
            }}
            className="cursor-pointer pl-1 flex items-center justify-center gap-2 flex-1 py-2.5 rounded-sm bg-green-600 hover:bg-green-500 text-black text-sm font-bold transition-colors shadow-lg shadow-green-900/20"
          >
            {t("reading:session.completed.finish")}
            <ChevronRight size={16} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

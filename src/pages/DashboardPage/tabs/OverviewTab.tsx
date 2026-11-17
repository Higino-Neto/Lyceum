import { BookOpen, Copy } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import RankingTable from "../components/RankingTable/RankingTable";
import ReadingHeatMap from "../components/ReadingHeatmap";
import WeeklyStreak from "../components/WeeklyStreak";
import ReadingStatsCard from "../components/ReadingStatsCard";
import ReadingCharts from "../components/ReadingCharts/ReadingCharts";
import ReadingTable from "../components/ReadingTable/ReadingTable";
import useReadingStats from "../../../hooks/useReadingStats";
import { useAppSettings } from "../../../contexts/AppSettingsContext";
import toast from "react-hot-toast";
import useGetReadings from "../../../hooks/useGetReadings";
import { useMemo } from "react";
import {
  panelStagger,
  softFadeUp,
  springFast,
} from "../../../utils/motionPresets";
import { useTranslation } from "../../../i18n";
import ContinueReading from "../components/ContinueReading";
import { useLibrarySummary } from "../hooks/useDashboardData";
import RegisterReadingForm from "../components/RegisterReading/RegisterReadingForm";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

export default function OverviewTab() {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { settings } = useAppSettings();

  const { isLoading } = useReadingStats();

  const { data: readings } = useGetReadings();

  const targetDate = useMemo(() => {
    const date = new Date();
    if (settings.copyYesterdayReadings) {
      date.setDate(date.getDate() - 1);
    }
    return date.toISOString().split("T")[0];
  }, [settings.copyYesterdayReadings]);

  const readingsString = useMemo(() => {
    if (!readings) return "";

    const targetReadings = readings.filter(
      (r) => r.reading_date === targetDate,
    );

    if (targetReadings.length === 0) return "";

    const lines = targetReadings.map((r) => `${r.source_name}: ${r.pages}`);
    const total = targetReadings.reduce((acc, r) => acc + r.pages, 0);

    return `${lines.join("\n")}\n\n${t("common:labels.total", { count: total })}`;
  }, [readings, targetDate, t]);

  const handleCopyDailyReadings = async () => {
    if (!readingsString) {
      toast.error(
        settings.copyYesterdayReadings
          ? t("dashboard:toasts.noReadingsYesterday")
          : t("dashboard:toasts.noReadingsToday"),
      );
      return;
    }

    try {
      await navigator.clipboard.writeText(readingsString);
      toast.success(t("dashboard:toasts.copied"));
    } catch {
      toast.error(t("dashboard:toasts.copyFailed"));
    }
  };

  const { data: librarySummary } = useLibrarySummary();
  const hasBooksInProgress = (librarySummary?.continueReading.length ?? 0) > 0;

  const panelTransition = reduceMotion ? { duration: 0 } : springFast;
  const hoverMotion = reduceMotion ? undefined : { y: -2 };

  return (
    <motion.div
      className="space-y-4"
      variants={reduceMotion ? undefined : panelStagger}
      initial={reduceMotion ? false : "hidden"}
      animate="visible"
    >
      <motion.section
        className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-3"
        variants={reduceMotion ? undefined : panelStagger}
      >
        {isLoading ? (
          <>
            <motion.div
              className="rounded-sm border border-border bg-surface md:col-span-2"
              variants={reduceMotion ? undefined : softFadeUp}
              transition={panelTransition}
            >
              <div className="m-8 h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </motion.div>
            <motion.div
              className="overflow-y-auto rounded-sm border border-border bg-surface"
              variants={reduceMotion ? undefined : softFadeUp}
              transition={panelTransition}
            >
              <RankingTable />
            </motion.div>
          </>
        ) : (
          <>
            <motion.div
              className="rounded-sm border border-border bg-surface md:col-span-2"
              variants={reduceMotion ? undefined : softFadeUp}
              transition={panelTransition}
              whileHover={hoverMotion}
            >
              <ReadingCharts />
            </motion.div>
            <motion.div
              className="overflow-y-auto rounded-sm border border-border bg-surface"
              variants={reduceMotion ? undefined : softFadeUp}
              transition={panelTransition}
              whileHover={hoverMotion}
            >
              <RankingTable />
            </motion.div>
          </>
        )}
        <motion.div
          className="h-full rounded-sm border border-border bg-surface"
          variants={reduceMotion ? undefined : softFadeUp}
          transition={panelTransition}
          whileHover={hoverMotion}
        >
          <ReadingHeatMap />
        </motion.div>
        <motion.div
          className="h-full rounded-sm bg-surface"
          variants={reduceMotion ? undefined : softFadeUp}
          transition={panelTransition}
          whileHover={hoverMotion}
        >
          <WeeklyStreak />
        </motion.div>
        <motion.div
          className="h-full rounded-sm bg-surface"
          variants={reduceMotion ? undefined : softFadeUp}
          transition={panelTransition}
          whileHover={hoverMotion}
        >
          <ReadingStatsCard />
        </motion.div>
      </motion.section>

      {hasBooksInProgress && (
        <motion.section
          variants={reduceMotion ? undefined : softFadeUp}
          transition={panelTransition}
        >
          <ContinueReading />
        </motion.section>
      )}

      <motion.section
        variants={reduceMotion ? undefined : softFadeUp}
        transition={panelTransition}
      >
        <RegisterReadingForm />
      </motion.section>

      <motion.section
        variants={reduceMotion ? undefined : softFadeUp}
        transition={panelTransition}
      >
        <motion.div
          className="rounded-sm border border-border bg-surface p-4"
          whileHover={hoverMotion}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <BookOpen
                size={ICON_SIZE}
                className="text-foreground-subtle"
                strokeWidth={STROKE_WIDTH}
              />
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                onClick={handleCopyDailyReadings}
                className="flex cursor-pointer items-center gap-1.5 rounded-sm border border-border-strong bg-surface-muted px-3 py-1.5 text-md text-foreground transition hover:bg-border-strong hover:text-foreground"
                title={
                  settings.copyYesterdayReadings
                    ? t("dashboard:actions.copyYesterday")
                    : t("dashboard:actions.copyToday")
                }
              >
                <Copy size={16} />
                {t("dashboard:actions.dailyReadings")}
              </motion.button>
            </div>
          </div>
          <ReadingTable />
        </motion.div>
      </motion.section>
    </motion.div>
  );
}

import { useMemo, useState } from "react";
import { Volume2 } from "lucide-react";
import {
  checkAnswer,
  chooseExercise,
  clozeSentence,
  dueItems,
  GRADE,
  gradeForVerdict,
  lemmaState,
  scheduleReview,
  stateAfterReview,
  type AnswerVerdict,
  type ExerciseType,
  type GradeName,
  type ReviewItem,
} from "../../../../core/language-learning";
import { useTranslation } from "../../../../i18n";
import type { LearningSession } from "./useLearningSession";
import { IconButton } from "./parts";
import { dynamicT } from "./uiHelpers";

interface ReviewSessionProps {
  session: LearningSession;
  speechAvailable: boolean;
  nativeLanguage: string;
  onSpeak(text: string): void;
  onDone(): void;
}

interface QueueEntry {
  item: ReviewItem;
  exercise: ExerciseType;
}

const GRADE_NAMES: GradeName[] = ["again", "hard", "good", "easy"];

export function ReviewSession({ session, speechAvailable, onSpeak, onDone }: ReviewSessionProps) {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueEntry[]>(() =>
    dueItems(session.reviewItems).map((item) => ({ item, exercise: chooseExercise(item, { speech: speechAvailable }) })));
  const [revealed, setRevealed] = useState(false);
  const [answer, setAnswer] = useState("");
  const [verdict, setVerdict] = useState<AnswerVerdict | null>(null);
  const [reviewed, setReviewed] = useState({ total: 0, correct: 0 });
  const current = queue[0];

  const cloze = useMemo(
    () => (current?.item.context && current.item.contextForm ? clozeSentence(current.item.context, current.item.contextForm) : null),
    [current],
  );

  if (!current) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm text-foreground">{t("learning:review.finished")}</p>
        <p className="text-xs text-foreground-muted">{t("learning:review.summary", { total: reviewed.total, correct: reviewed.correct })}</p>
        <button type="button" onClick={onDone} className="rounded-sm bg-surface-muted px-3 py-1.5 text-xs text-foreground hover:bg-border-strong cursor-pointer">{t("learning:actions.back")}</button>
      </div>
    );
  }

  const { item, exercise } = current;
  const expected = exercise === "cloze" ? cloze?.answer ?? item.label : item.label;
  const typed = exercise === "recall" || exercise === "cloze" || exercise === "listening";

  const submit = () => {
    const result = checkAnswer(expected, answer);
    setVerdict(result);
    setRevealed(true);
  };

  const grade = async (value: number) => {
    const { item: next, intervalBefore, correct } = scheduleReview(item, value);
    session.setReviewItems((items) => items.map((candidate) => (candidate.id === next.id ? next : candidate)));
    setReviewed((stats) => ({ total: stats.total + 1, correct: stats.correct + (correct ? 1 : 0) }));
    setQueue((entries) => {
      const rest = entries.slice(1);
      return correct ? rest : [...rest, { item: next, exercise: "recognition" }];
    });
    setRevealed(false);
    setAnswer("");
    setVerdict(null);
    try {
      await session.client.upsertReviewItem(next);
      await session.client.logReview({ itemId: next.id, reviewedAt: new Date().toISOString(), grade: value, exercise, correct, intervalBefore, intervalAfter: next.intervalDays });
      const currentState = lemmaState(session.snapshot, item.key);
      const nextState = stateAfterReview(currentState, next.intervalDays, correct);
      if (nextState !== currentState) await session.setKnowledge(item.key, item.label, nextState);
    } catch (error) {
      console.error("[Review]", error);
    }
  };

  const suggested = verdict ? gradeForVerdict(verdict) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-[11px] text-foreground-subtle">
        <span>{dynamicT(t, `learning:review.exercises.${exercise}`, undefined, exercise)}</span>
        <span className="tabular-nums">{t("learning:review.remaining", { count: queue.length })}</span>
      </div>

      <div className="rounded-sm border border-border bg-background p-4">
        {exercise === "recognition" && (
          <p className="text-center font-serif text-2xl text-foreground">{item.label}</p>
        )}
        {exercise === "recall" && (
          <p className="text-center text-lg text-foreground">{item.translation}</p>
        )}
        {exercise === "cloze" && cloze && (
          <p className="font-serif text-[15px] leading-relaxed text-foreground">
            {cloze.before}<span className="mx-0.5 inline-block min-w-12 border-b border-foreground-muted text-center">{revealed ? cloze.answer : " "}</span>{cloze.after}
          </p>
        )}
        {exercise === "listening" && (
          <div className="flex justify-center">
            <IconButton label={t("learning:audio.pronounce")} onClick={() => onSpeak(item.label)}><Volume2 size={18} /></IconButton>
          </div>
        )}
        {exercise === "production" && (
          <div className="space-y-2 text-center">
            <p className="font-serif text-xl text-foreground">{item.label}</p>
            {item.translation && <p className="text-xs text-foreground-muted">{item.translation}</p>}
            <p className="text-xs text-foreground-subtle">{t("learning:review.productionPrompt")}</p>
          </div>
        )}

        {revealed && (
          <div className="mt-4 space-y-2 border-t border-border pt-3 text-sm">
            <p className="font-serif text-lg text-foreground">{item.label}</p>
            <p className="text-foreground-muted">{item.translation ?? t("learning:review.noTranslation")}</p>
            {item.context && exercise !== "cloze" && <p className="font-serif text-xs leading-relaxed text-foreground-subtle">{item.context}</p>}
            {verdict && (
              <p className={`text-xs ${verdict === "correct" ? "text-success" : verdict === "wrong" ? "text-destructive" : "text-warning"}`}>
                {dynamicT(t, `learning:review.verdicts.${verdict}`, undefined, verdict)}
              </p>
            )}
          </div>
        )}
      </div>

      {!revealed && typed && (
        <form onSubmit={(event) => { event.preventDefault(); submit(); }} className="flex gap-1.5">
          <input
            autoFocus
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder={t("learning:review.typeAnswer")}
            className="h-9 min-w-0 flex-1 rounded-sm border border-input-border bg-input px-2 text-sm text-foreground focus:border-primary focus:outline-none"
          />
          <button type="submit" className="rounded-sm bg-primary px-3 text-xs font-semibold text-primary-foreground cursor-pointer">{t("learning:review.check")}</button>
        </form>
      )}
      {!revealed && exercise === "production" && (
        <textarea
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          rows={3}
          placeholder={t("learning:review.writeSentence")}
          className="w-full rounded-sm border border-input-border bg-input p-2 text-sm text-foreground focus:border-primary focus:outline-none"
        />
      )}
      {!revealed && !typed && (
        <button type="button" onClick={() => setRevealed(true)} className="w-full rounded-sm bg-surface-muted px-3 py-2 text-sm text-foreground hover:bg-border-strong cursor-pointer">
          {t("learning:review.showAnswer")}
        </button>
      )}

      {revealed && (
        <div className="grid grid-cols-4 gap-1">
          {GRADE_NAMES.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => void grade(GRADE[name])}
              className={`rounded-sm px-1 py-2 text-xs cursor-pointer ${suggested === GRADE[name] ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground hover:bg-border-strong"}`}
            >
              {dynamicT(t, `learning:review.grades.${name}`, undefined, name)}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={onDone} className="w-full text-center text-xs text-foreground-subtle hover:text-foreground cursor-pointer">{t("learning:review.stop")}</button>
    </div>
  );
}

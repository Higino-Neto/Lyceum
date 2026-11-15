import type { ReactNode } from "react";
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { GrammarFeatures, KnowledgeState } from "../../../../core/language-learning";
import { useTranslation, type Translate } from "../../../../i18n";
import { dynamicT, STATE_DOT, STATE_ORDER, stateLabelKey } from "./uiHelpers";

export function StateControl({
  value,
  onChange,
  size = "md",
}: {
  value: KnowledgeState;
  onChange(state: KnowledgeState): void;
  size?: "sm" | "md";
}) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("learning:inspector.knowledge")} className="grid grid-cols-4 gap-1 rounded-sm border border-border bg-background p-0.5">
      {STATE_ORDER.map((state, index) => {
        const active = state === value;
        return (
          <button
            key={state}
            type="button"
            role="radio"
            aria-checked={active}
            title={`${t(stateLabelKey(state))} (${index + 1})`}
            onClick={() => onChange(state)}
            className={`flex items-center justify-center gap-1.5 rounded-[3px] ${size === "sm" ? "px-1 py-1 text-[11px]" : "px-1.5 py-1.5 text-xs"} transition-colors cursor-pointer ${
              active ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:text-foreground"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />
            <span className="truncate">{t(stateLabelKey(state))}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Section({
  title,
  children,
  defaultOpen = true,
  aside,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  aside?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-t border-border py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle hover:text-foreground cursor-pointer"
          aria-expanded={open}
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {title}
        </button>
        {aside}
      </div>
      {open && children}
    </section>
  );
}

const FEATURE_ORDER = [
  "gender", "number", "case", "readings", "tense", "mood", "person", "form", "declension", "ending",
  "determiner", "governs", "contraction", "separable", "separableOf", "compound", "degree", "usage", "relative", "modalParticle", "reflexive",
];

const HIDDEN_FEATURES = new Set(["genderSource", "interrogative", "properNoun"]);

/** Human-readable grammatical features; unknown keys are shown raw. */
export function FeatureList({ features, genderInferred }: { features: GrammarFeatures; genderInferred?: boolean }) {
  const { t } = useTranslation();
  const entries = Object.entries(features)
    .filter(([key, value]) => value && !HIDDEN_FEATURES.has(key))
    .sort(([a], [b]) => {
      const ia = FEATURE_ORDER.indexOf(a);
      const ib = FEATURE_ORDER.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  if (entries.length === 0) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, value]) => (
        <div key={key} className="contents">
          <dt className="text-foreground-subtle">{dynamicT(t, `learning:features.${key}`, undefined, key)}</dt>
          <dd className="text-foreground">
            {formatFeatureValue(t, key, value)}
            {key === "gender" && genderInferred && (
              <span className="ml-1 text-foreground-subtle">· {t("learning:inspector.inferredFromDocument")}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function formatFeatureValue(t: Translate, key: string, value: string) {
  if (key === "readings") {
    return value.split(" ").map((reading) => {
      const [grammaticalCase = "", gender = ""] = reading.split(".");
      return `${dynamicT(t, `learning:values.${grammaticalCase}`, undefined, grammaticalCase)} ${dynamicT(t, `learning:values.${gender}`, undefined, gender)}`;
    }).join(" · ");
  }
  return value.split("|").map((part) => dynamicT(t, `learning:values.${part}`, undefined, part)).join(" / ");
}


export function IconButton({
  label,
  onClick,
  children,
  active,
  disabled,
}: {
  label: string;
  onClick(): void;
  children: ReactNode;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-sm transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 ${
        active ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}


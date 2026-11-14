import { useEffect, useState, type ReactNode } from "react";

interface ToggleProps {
  checked: boolean;
  onChange?: () => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition-colors ${
        checked ? "bg-primary" : "bg-border-strong"
      }`}
      aria-pressed={checked}
      aria-label={label}
    >
      <span
        className={`h-4 w-4 rounded-full bg-primary-foreground transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export function NumberOption({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  // Keep a draft so typing "1" on the way to "1264" isn't clamped mid-edit.
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);

  const commit = (raw: string) => {
    const numeric = Number(raw);
    const next = Number.isFinite(numeric) && raw.trim() !== "" ? Math.min(max, Math.max(min, numeric)) : value;
    setDraft(String(next));
    if (next !== value) onChange(next);
  };

  return (
    <label className="space-y-1 text-xs text-foreground-muted">
      <span>{label}</span>
      <span className="flex h-9 items-center rounded-sm border border-border bg-background px-2">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={draft}
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const numeric = Number(raw);
            if (raw.trim() !== "" && Number.isFinite(numeric) && numeric >= min && numeric <= max) onChange(numeric);
          }}
          onBlur={(event) => commit(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") commit((event.target as HTMLInputElement).value);
          }}
          className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
        />
        {suffix && <span className="text-foreground-subtle">{suffix}</span>}
      </span>
    </label>
  );
}

export function ToggleOption({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  hint?: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="flex min-h-8 items-center justify-between gap-3 text-sm text-foreground">
        <span>{label}</span>
        <Toggle checked={checked} onChange={onChange} label={label} />
      </div>
      {hint && <p className="text-[11px] leading-snug text-foreground-subtle">{hint}</p>}
    </div>
  );
}

export function RangeOption({
  label,
  value,
  min,
  max,
  step = 1,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  hint?: ReactNode;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block space-y-1 text-xs text-foreground-muted">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-semibold tabular-nums text-foreground">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full accent-primary"
      />
      {hint && <span className="block text-[11px] leading-snug text-foreground-subtle">{hint}</span>}
    </label>
  );
}

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Copy, PanelRight, StickyNote } from "lucide-react";
import type { KnowledgeState } from "../../../../core/language-learning";
import { useTranslation } from "../../../../i18n";
import { STATE_DOT, STATE_ORDER, stateLabelKey } from "./uiHelpers";

export type WordMenuAction = "details" | "note" | "copy";

interface WordMenuProps {
  x: number;
  y: number;
  word: string;
  state: KnowledgeState;
  onState(state: KnowledgeState): void;
  onAction(action: WordMenuAction): void;
  onClose(): void;
}

/** Compact right-click menu; keeps the reading position untouched. */
export function WordMenu({ x, y, word, state, onState, onAction, onClose }: WordMenuProps) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)),
      top: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)),
    });
  }, [x, y]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    window.addEventListener("blur", onClose);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", onClose);
    };
  }, [onClose]);

  const items: Array<{ action: WordMenuAction; label: string; icon: React.ReactNode }> = [
    { action: "details", label: t("learning:menu.details"), icon: <PanelRight size={14} /> },
    { action: "note", label: t("learning:annotations.add"), icon: <StickyNote size={14} /> },
    { action: "copy", label: t("learning:menu.copy"), icon: <Copy size={14} /> },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={word}
      className="fixed z-50 w-64 rounded-sm border border-border bg-surface p-1 text-xs shadow-2xl"
      style={position}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="truncate px-2 pb-1.5 pt-1 font-serif text-sm text-foreground">{word}</div>
      <div className="mb-1 grid grid-cols-2 gap-0.5 px-1">
        {STATE_ORDER.map((candidate, index) => (
          <button
            key={candidate}
            type="button"
            role="menuitemradio"
            aria-checked={candidate === state}
            title={`${t(stateLabelKey(candidate))} (${index + 1})`}
            onClick={() => { onState(candidate); onClose(); }}
            className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-left cursor-pointer ${candidate === state ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"}`}
          >
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${STATE_DOT[candidate]}`} />
            <span className="truncate">{t(stateLabelKey(candidate))}</span>
            <span className="ml-auto text-[11px] text-foreground-subtle">{index + 1}</span>
          </button>
        ))}
      </div>
      <div className="my-1 h-px bg-border" />
      {items.map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          onClick={() => { onAction(item.action); onClose(); }}
          className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-foreground hover:bg-surface-muted disabled:cursor-default disabled:opacity-50 cursor-pointer"
        >
          <span className="text-foreground-muted">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

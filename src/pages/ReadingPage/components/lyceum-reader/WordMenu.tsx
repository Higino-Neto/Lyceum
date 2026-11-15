import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { BookOpen, Copy, EyeOff, Languages, ListTree, Plus, ScanText, StickyNote, Volume2 } from "lucide-react";
import type { KnowledgeState } from "../../../../core/language-learning";
import { useTranslation } from "../../../../i18n";
import { STATE_DOT, STATE_ORDER, stateLabelKey } from "./uiHelpers";

export type WordMenuAction =
  | "translate" | "grammar" | "occurrences" | "pronounce" | "add" | "ignore" | "copy" | "note" | "sentence";

interface WordMenuProps {
  x: number;
  y: number;
  word: string;
  state: KnowledgeState;
  speechAvailable: boolean;
  inVocabulary: boolean;
  onState(state: KnowledgeState): void;
  onAction(action: WordMenuAction): void;
  onClose(): void;
}

/** Compact right-click menu; keeps the reading position untouched. */
export function WordMenu({ x, y, word, state, speechAvailable, inVocabulary, onState, onAction, onClose }: WordMenuProps) {
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

  const items: Array<{ action: WordMenuAction; label: string; icon: React.ReactNode; hidden?: boolean; disabled?: boolean }> = [
    { action: "translate", label: t("learning:menu.translate"), icon: <Languages size={14} /> },
    { action: "grammar", label: t("learning:menu.grammar"), icon: <BookOpen size={14} /> },
    { action: "occurrences", label: t("learning:menu.occurrences"), icon: <ListTree size={14} /> },
    { action: "sentence", label: t("learning:inspector.analyzeSentence"), icon: <ScanText size={14} /> },
    { action: "pronounce", label: t("learning:audio.pronounce"), icon: <Volume2 size={14} />, hidden: !speechAvailable },
    { action: "add", label: inVocabulary ? t("learning:inspector.inVocabulary") : t("learning:inspector.addToVocabulary"), icon: <Plus size={14} />, disabled: inVocabulary },
    { action: "note", label: t("learning:annotations.add"), icon: <StickyNote size={14} /> },
    { action: "ignore", label: t("learning:menu.ignore"), icon: <EyeOff size={14} /> },
    { action: "copy", label: t("learning:menu.copy"), icon: <Copy size={14} /> },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={word}
      className="fixed z-50 w-56 rounded-sm border border-border-strong bg-surface p-1 text-xs shadow-xl"
      style={position}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="truncate px-2 pb-1.5 pt-1 font-serif text-sm text-foreground">{word}</div>
      <div className="mb-1 grid grid-cols-4 gap-0.5 px-1">
        {STATE_ORDER.map((candidate, index) => (
          <button
            key={candidate}
            type="button"
            role="menuitemradio"
            aria-checked={candidate === state}
            title={`${t(stateLabelKey(candidate))} (${index + 1})`}
            onClick={() => { onState(candidate); onClose(); }}
            className={`flex flex-col items-center gap-1 rounded-sm px-1 py-1.5 cursor-pointer ${candidate === state ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted"}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[candidate]}`} />
            <span className="text-[10px]">{t(stateLabelKey(candidate))}</span>
          </button>
        ))}
      </div>
      <div className="my-1 h-px bg-border" />
      {items.filter((item) => !item.hidden).map((item) => (
        <button
          key={item.action}
          type="button"
          role="menuitem"
          disabled={item.disabled}
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

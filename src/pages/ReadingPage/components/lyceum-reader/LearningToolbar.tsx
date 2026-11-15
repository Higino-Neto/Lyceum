import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle, BarChart3, ChevronLeft, ChevronRight, Highlighter, List, Pause, PanelRight, Play, Repeat, Settings2, SkipBack, SkipForward, Square, GraduationCap, BookOpen,
} from "lucide-react";
import type { LinguisticDocument } from "../../../../core/language-learning";
import { LEARNING_LANGUAGES, type LearningReaderSettings, type LearningTheme } from "../../../../features/language-learning/settings";
import { useTranslation } from "../../../../i18n";
import { IconButton } from "./parts";
import Select from "../../../../components/ui/Select";
import type { NarrationStatus } from "./useNarration";
import type { SaveStatus } from "./useLearningSession";

interface ToolbarProps {
  document: LinguisticDocument;
  chapterIndex: number;
  chapterProgress: number;
  settings: LearningReaderSettings;
  onSettings(patch: Partial<LearningReaderSettings>): void;
  onChapter(index: number): void;
  documentLanguage: string;
  onDocumentLanguage(language: string): void;
  narration: {
    available: boolean;
    status: NarrationStatus;
    onPlay(): void;
    onPause(): void;
    onResume(): void;
    onStop(): void;
    onRepeat(): void;
    onStep(delta: number): void;
  };
  inspectorOpen: boolean;
  progressOpen: boolean;
  dueCount: number;
  saveStatus: SaveStatus;
  onToggleInspector(): void;
  onToggleProgress(): void;
}

function languageName(code: string, locale: string) {
  try {
    return new Intl.DisplayNames([locale], { type: "language" }).of(code) ?? code;
  } catch {
    return code;
  }
}

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      const target = event.target as Element | null;
      // Options of a <Select> render in a portal; picking one must not close the popover.
      if (target?.closest?.("[data-radix-popper-content-wrapper]")) return;
      if (!ref.current?.contains(target as Node)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [open]);
  return { open, setOpen, ref };
}

function Slider({ label, value, min, max, step, onChange, format }: { label: string; value: number; min: number; max: number; step: number; onChange(value: number): void; format(value: number): string }) {
  return (
    <label className="block text-xs">
      <span className="flex justify-between text-foreground-muted"><span>{label}</span><span className="tabular-nums text-foreground">{format(value)}</span></span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full accent-primary" />
    </label>
  );
}

export function LearningToolbar(props: ToolbarProps) {
  const { t, i18n } = useTranslation();
  const toc = usePopover();
  const settingsPopover = usePopover();
  const { document, chapterIndex, settings, narration } = props;
  const chapter = document.chapters[chapterIndex];
  const locale = i18n.language || "en";
  const themes: LearningTheme[] = ["app", "sepia"];

  return (
    <div className="flex h-12 flex-shrink-0 items-center gap-1 border-b border-border bg-overlay px-2">
      <div className="relative" ref={toc.ref}>
        <IconButton label={t("learning:toolbar.contents")} active={toc.open} onClick={() => toc.setOpen((value) => !value)}><List size={15} /></IconButton>
        {toc.open && (
          <div className="absolute left-0 top-9 z-40 max-h-[60vh] w-72 overflow-y-auto rounded-sm border border-border bg-surface p-1 shadow-2xl">
            {document.chapters.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => { props.onChapter(index); toc.setOpen(false); }}
                className={`block w-full truncate rounded-sm px-2 py-1.5 text-left text-xs cursor-pointer ${index === chapterIndex ? "bg-surface-muted text-foreground" : "text-foreground-muted hover:bg-surface-muted hover:text-foreground"}`}
              >
                {item.title}
              </button>
            ))}
          </div>
        )}
      </div>
      <IconButton label={t("learning:toolbar.previousChapter")} disabled={chapterIndex === 0} onClick={() => props.onChapter(chapterIndex - 1)}><ChevronLeft size={15} /></IconButton>
      <IconButton label={t("learning:toolbar.nextChapter")} disabled={chapterIndex >= document.chapters.length - 1} onClick={() => props.onChapter(chapterIndex + 1)}><ChevronRight size={15} /></IconButton>
      <div className="mx-2 hidden min-w-0 flex-1 items-center gap-2 sm:flex">
        <span className="truncate text-xs text-foreground-muted">{chapter?.title}</span>
        <span className="text-[11px] tabular-nums text-foreground-subtle">{chapterIndex + 1}/{document.chapters.length} · {Math.round(props.chapterProgress * 100)}%</span>
      </div>
      <div className="flex-1 sm:hidden" />

      <div className="flex items-center rounded-sm border border-border p-0.5" role="radiogroup" aria-label={t("learning:toolbar.mode")}>
        <button type="button" role="radio" aria-checked={!settings.learningMode} title={t("learning:toolbar.traditional")} onClick={() => props.onSettings({ learningMode: false })} className={`flex items-center gap-1 rounded-[3px] px-2 py-1 text-xs cursor-pointer ${!settings.learningMode ? "bg-surface-muted text-foreground" : "text-foreground-muted"}`}>
          <BookOpen size={12} /><span className="hidden md:inline">{t("learning:toolbar.traditional")}</span>
        </button>
        <button type="button" role="radio" aria-checked={settings.learningMode} title={t("learning:toolbar.learning")} onClick={() => props.onSettings({ learningMode: true })} className={`flex items-center gap-1 rounded-[3px] px-2 py-1 text-xs cursor-pointer ${settings.learningMode ? "bg-surface-muted text-foreground" : "text-foreground-muted"}`}>
          <GraduationCap size={12} /><span className="hidden md:inline">{t("learning:toolbar.learning")}</span>
        </button>
      </div>
      <IconButton label={t("learning:toolbar.highlights")} active={settings.showHighlights} disabled={!settings.learningMode} onClick={() => props.onSettings({ showHighlights: !settings.showHighlights })}><Highlighter size={15} /></IconButton>

      <div className="mx-1 h-5 w-px bg-border" />
      {narration.available ? (
        <div className="flex items-center">
          {narration.status === "playing" ? (
            <IconButton label={t("learning:audio.pause")} onClick={narration.onPause}><Pause size={15} /></IconButton>
          ) : (
            <IconButton label={narration.status === "paused" ? t("learning:audio.resume") : t("learning:audio.play")} onClick={narration.status === "paused" ? narration.onResume : narration.onPlay}><Play size={15} /></IconButton>
          )}
          {narration.status !== "idle" && (
            <>
              <IconButton label={t("learning:audio.previousSentence")} onClick={() => narration.onStep(-1)}><SkipBack size={14} /></IconButton>
              <IconButton label={t("learning:audio.repeat")} onClick={narration.onRepeat}><Repeat size={14} /></IconButton>
              <IconButton label={t("learning:audio.nextSentence")} onClick={() => narration.onStep(1)}><SkipForward size={14} /></IconButton>
              <IconButton label={t("learning:audio.stop")} onClick={narration.onStop}><Square size={13} /></IconButton>
            </>
          )}
          <Select
            ariaLabel={t("learning:audio.speed")}
            value={String(settings.speechRate)}
            onChange={(value) => props.onSettings({ speechRate: Number(value) })}
            className="ml-1 h-8 min-w-[72px]"
            items={[0.6, 0.75, 0.9, 1, 1.15, 1.3, 1.5].map((rate) => ({ value: String(rate), label: `${rate}×` }))}
          />
        </div>
      ) : (
        <span className="px-1 text-[11px] text-foreground-subtle" title={t("learning:audio.noVoiceHint")}>{t("learning:audio.noVoice")}</span>
      )}

      <div className="mx-1 h-5 w-px bg-border" />
      <div className="relative" ref={settingsPopover.ref}>
        <IconButton label={t("learning:toolbar.settings")} active={settingsPopover.open} onClick={() => settingsPopover.setOpen((value) => !value)}><Settings2 size={15} /></IconButton>
        {settingsPopover.open && (
          <div className="absolute right-0 top-9 z-40 w-72 space-y-3 rounded-sm border border-border bg-surface p-3 shadow-2xl">
            <Slider label={t("learning:settings.fontSize")} value={settings.fontSize} min={13} max={32} step={1} onChange={(fontSize) => props.onSettings({ fontSize })} format={(v) => `${v}px`} />
            <Slider label={t("learning:settings.lineHeight")} value={settings.lineHeight} min={1.2} max={2.4} step={0.05} onChange={(lineHeight) => props.onSettings({ lineHeight })} format={(v) => v.toFixed(2)} />
            <Slider label={t("learning:settings.width")} value={settings.contentWidth} min={420} max={1100} step={20} onChange={(contentWidth) => props.onSettings({ contentWidth })} format={(v) => `${v}px`} />
            <div>
              <p className="mb-1 text-xs text-foreground-muted">{t("learning:settings.theme")}</p>
              <div className="grid grid-cols-2 gap-1">
                {themes.map((theme) => (
                  <button key={theme} type="button" onClick={() => props.onSettings({ theme })} className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 text-xs cursor-pointer ${settings.theme === theme ? "border-primary bg-surface-muted text-foreground" : "border-border text-foreground-muted hover:bg-surface-muted"}`}>
                    <span className={`h-3.5 w-3.5 rounded-full border border-border-strong ${theme === "sepia" ? "lx-swatch-sepia" : "bg-surface"}`} />
                    {t(`learning:settings.themes.${theme}` as "learning:settings.themes.app")}
                  </button>
                ))}
              </div>
            </div>
            <label className="flex items-start gap-2 text-xs text-foreground-muted cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={settings.autoLearnOnClick} onChange={(event) => props.onSettings({ autoLearnOnClick: event.target.checked })} />
              <span>
                <span className="text-foreground">{t("learning:settings.autoLearnOnClick")}</span>
                <span className="mt-0.5 block text-[11px] text-foreground-subtle">{t("learning:settings.autoLearnOnClickHint")}</span>
              </span>
            </label>
            <label className="flex items-center justify-between text-xs text-foreground-muted cursor-pointer">
              {t("learning:settings.highlightKnown")}
              <input type="checkbox" className="accent-primary" checked={settings.highlightKnown} onChange={(event) => props.onSettings({ highlightKnown: event.target.checked })} />
            </label>
            <div className="border-t border-border pt-3">
              <div className="block text-xs text-foreground-muted">
                {t("learning:settings.documentLanguage")}
                <Select
                  ariaLabel={t("learning:settings.documentLanguage")}
                  value={props.documentLanguage}
                  onChange={props.onDocumentLanguage}
                  className="mt-1 w-full"
                  items={Array.from(new Set([props.documentLanguage, ...LEARNING_LANGUAGES])).map((code) => ({ value: code, label: languageName(code, locale) }))}
                />
              </div>
              <div className="mt-2 block text-xs text-foreground-muted">
                {t("learning:settings.nativeLanguage")}
                <Select
                  ariaLabel={t("learning:settings.nativeLanguage")}
                  value={settings.nativeLanguage}
                  onChange={(nativeLanguage) => props.onSettings({ nativeLanguage })}
                  className="mt-1 w-full"
                  items={Array.from(new Set([settings.nativeLanguage, "en", "pt", "es", "fr", "de", "it"])).map((code) => ({ value: code, label: languageName(code, locale) }))}
                />
              </div>
            </div>
            <label className="flex items-start gap-2 border-t border-border pt-3 text-xs text-foreground-muted cursor-pointer">
              <input type="checkbox" className="mt-0.5 accent-primary" checked={settings.onlineTranslation} onChange={(event) => props.onSettings({ onlineTranslation: event.target.checked })} />
              <span>
                <span className="text-foreground">{t("learning:settings.onlineTranslation")}</span>
                <span className="mt-0.5 block text-[11px] text-foreground-subtle">{t("learning:settings.onlineTranslationHint")}</span>
              </span>
            </label>
          </div>
        )}
      </div>
      {props.saveStatus === "error" && (
        <span className="flex h-8 items-center gap-1 px-1.5 text-xs text-destructive" role="alert" title={t("learning:save.error")}>
          <AlertTriangle size={14} />
          <span className="hidden lg:inline">{t("learning:save.notSaved")}</span>
        </span>
      )}
      <IconButton label={t("learning:toolbar.inspector")} active={props.inspectorOpen} onClick={props.onToggleInspector}><PanelRight size={15} /></IconButton>
      <div className="relative">
        <IconButton label={t("learning:toolbar.progress")} active={props.progressOpen} onClick={props.onToggleProgress}><BarChart3 size={15} /></IconButton>
        {props.dueCount > 0 && <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
      </div>
    </div>
  );
}

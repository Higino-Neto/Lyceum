import { useCallback, useEffect, useMemo, useState } from "react";
import { Bug, Minus, Sparkles, TrendingUp, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import AnimatedModal from "../../components/ui/AnimatedModal";
import Select from "../../components/ui/Select";
import { useLanguage, useTranslation } from "../../i18n";
import {
  getUnseenReleaseNotes,
  getVisibleReleaseNotes,
  type ReleaseNoteKind,
} from "./releaseNotes";
import { OPEN_WHATS_NEW_EVENT } from "./whatsNewEvents";

const LAST_SEEN_KEY = "lyceum:whats-new:last-seen";

const KIND_ICONS: Record<ReleaseNoteKind, LucideIcon> = {
  new: Sparkles,
  improved: TrendingUp,
  fixed: Bug,
  removed: Minus,
};

const KIND_ORDER: ReleaseNoteKind[] = ["new", "improved", "fixed", "removed"];

function readLastSeen(): string | null {
  try {
    return localStorage.getItem(LAST_SEEN_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string) {
  try {
    localStorage.setItem(LAST_SEEN_KEY, version);
  } catch {
    // Storage can be unavailable (private mode); the dialog just shows again.
  }
}

/**
 * App-level dialog. Opens automatically once after the app is updated to a
 * version with release notes, and on demand via `openWhatsNew()`.
 */
export default function WhatsNewDialog() {
  const { t } = useTranslation();
  const { language, locale } = useLanguage();
  const currentVersion = import.meta.env.VITE_APP_VERSION as string | undefined;
  const notes = useMemo(() => getVisibleReleaseNotes(currentVersion), [currentVersion]);
  const [open, setOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!currentVersion) return;
    const lastSeen = readLastSeen();
    if (!lastSeen) {
      // Fresh install: nothing "new" to announce yet.
      writeLastSeen(currentVersion);
      return;
    }
    const [newest] = getUnseenReleaseNotes(lastSeen, currentVersion);
    if (newest) {
      setSelectedVersion(newest.version);
      setOpen(true);
    }
  }, [currentVersion]);

  useEffect(() => {
    const handleOpen = () => {
      setSelectedVersion(notes[0]?.version ?? null);
      setOpen(true);
    };
    window.addEventListener(OPEN_WHATS_NEW_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_WHATS_NEW_EVENT, handleOpen);
  }, [notes]);

  const close = useCallback(() => {
    setOpen(false);
    if (currentVersion) writeLastSeen(currentVersion);
  }, [currentVersion]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close, open]);

  const selected = notes.find((note) => note.version === selectedVersion) ?? notes[0];
  const formatDate = (value: string) =>
    new Date(`${value}T12:00:00`).toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  return (
    <AnimatedModal
      open={open && Boolean(selected)}
      ariaLabelledBy="whats-new-title"
      onBackdropClick={close}
      backdropClassName="z-[95] px-4 py-6"
      className="flex h-[min(620px,calc(100vh-48px))] w-full max-w-3xl overflow-hidden rounded border border-border-strong bg-surface text-foreground shadow-2xl shadow-shadow"
    >
      <aside className="hidden w-48 shrink-0 flex-col border-r border-border bg-background/80 sm:flex">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Sparkles size={16} className="text-primary" />
          <span className="text-sm font-semibold">{t("common:whatsNew.versions")}</span>
        </div>
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
          {notes.map((note) => {
            const active = note.version === selected?.version;
            return (
              <button
                key={note.version}
                type="button"
                onClick={() => setSelectedVersion(note.version)}
                className={`flex w-full flex-col items-start rounded px-3 py-2 text-left transition-colors ${
                  active
                    ? "bg-surface-muted text-foreground"
                    : "text-foreground-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                <span className="flex w-full items-center gap-2 text-sm font-medium">
                  v{note.version}
                  {note.version === currentVersion && (
                    <span className="ml-auto rounded-full bg-primary/15 px-1.5 text-[10px] font-semibold uppercase text-primary">
                      {t("common:whatsNew.current")}
                    </span>
                  )}
                </span>
                <span className="text-[11px] text-foreground-subtle">{formatDate(note.date)}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {selected && (
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5">
            <div className="min-w-0">
              <h2 id="whats-new-title" className="truncate text-base font-semibold">
                {t("common:whatsNew.title")}
              </h2>
              <p className="text-xs text-foreground-subtle">
                v{selected.version} · {formatDate(selected.date)}
              </p>
            </div>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-8 w-8 items-center justify-center rounded text-foreground-muted transition hover:bg-surface-muted hover:text-foreground"
              aria-label={t("common:actions.close")}
            >
              <X size={17} />
            </button>
          </header>

          <div className="border-b border-border px-5 py-2 sm:hidden">
            <Select
              value={selected.version}
              onChange={setSelectedVersion}
              ariaLabel={t("common:whatsNew.versions")}
              className="h-9 w-full text-sm"
              items={notes.map((note) => ({ value: note.version, label: `v${note.version}` }))}
            />
          </div>

          <main className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
            <h3 className="text-xl font-semibold tracking-normal">{selected.title[language]}</h3>
            <div className="mt-5 space-y-5">
              {KIND_ORDER.map((kind) => {
                const items = selected.items.filter((item) => item.kind === kind);
                if (items.length === 0) return null;
                const Icon = KIND_ICONS[kind];
                return (
                  <section key={kind}>
                    <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-subtle">
                      <Icon size={13} />
                      {t(`common:whatsNew.kinds.${kind}`)}
                    </h4>
                    <ul className="space-y-1.5">
                      {items.map((item) => (
                        <li
                          key={item.text.en}
                          className="relative pl-4 text-sm leading-6 text-foreground-muted before:absolute before:left-0 before:top-[0.7em] before:h-1.5 before:w-1.5 before:rounded-full before:bg-border-strong"
                        >
                          {item.text[language]}
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </main>

          <footer className="flex justify-end border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={close}
              className="h-9 rounded bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
            >
              {t("common:whatsNew.gotIt")}
            </button>
          </footer>
        </div>
      )}
    </AnimatedModal>
  );
}

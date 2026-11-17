import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Download,
  Info,
  LockKeyhole,
  Mail,
  Palette,
  RefreshCw,
  Trophy,
  UserCircle,
} from "lucide-react";
import { useTranslation, type TranslationKey } from "../../i18n";
import { useLanguage } from "../../i18n/useLanguage";
import { ACCENT_COLORS } from "../../theme/palettes";
import { getSupabaseConfigError } from "../../lib/supabase";
import { hasSupabaseConfig } from "../../lib/supabaseAuth";
import { BACK_EVENT } from "../useBackNavigation";
import { useMobileConfirm } from "../MobileConfirmDialog";
import { MobileFieldFrame, MobileInput } from "../MobileControls";
import MobileBackupPanel from "../MobileBackupPanel";
import { hasNativeReaderControls, loadReaderControls, saveReaderControls, type ReaderControlSettings } from "../readerControls";
import type { MobileLibraryState } from "../types";
import type { useMobileAuth } from "../useMobileAuth";
import type { useMobileUpdater } from "../useMobileUpdater";
import { readMobileAppearance, saveMobileAppearance, type AppTheme } from "./appearanceSettings";
import { formatMobileBytes, formatMobileDate, getNativeApkUpdateText } from "./updateText";

const MobileVocabularyPanel = lazy(() => import("../learning/MobileVocabularyPanel"));

type SettingsPage = "root" | "account" | "general" | "reading" | "updates" | "data" | "about";

interface MobileSettingsScreenProps {
  auth: ReturnType<typeof useMobileAuth>;
  updater: ReturnType<typeof useMobileUpdater>;
  isOnline: boolean;
  state: MobileLibraryState;
  setState: React.Dispatch<React.SetStateAction<MobileLibraryState>>;
  onOpenLeaderboard(): void;
}

const PAGE_TITLES: Record<Exclude<SettingsPage, "root">, TranslationKey> = {
  account: "mobile:settings.account.title",
  general: "mobile:settings.general.title",
  reading: "mobile:settings.reading.title",
  updates: "mobile:settings.updates.title",
  data: "mobile:settings.data.title",
  about: "mobile:settings.about.title",
};

/* ----------------------------------------------------------------------------
 * Building blocks: grouped rows that drill into a page, like system settings.
 * ------------------------------------------------------------------------- */

function Group({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <section>
      {title && <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-widest text-foreground-subtle">{title}</h3>}
      <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">{children}</div>
      {footer && <p className="mt-2 px-1 text-xs leading-5 text-foreground-subtle">{footer}</p>}
    </section>
  );
}

function NavRow({ icon, title, subtitle, badge, onClick }: { icon: ReactNode; title: string; subtitle?: string; badge?: ReactNode; onClick(): void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-16 w-full items-center gap-3 px-4 py-2.5 text-left active:bg-surface-muted">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold text-foreground">{title}</span>
        {subtitle && <span className="mt-0.5 block truncate text-[13px] text-foreground-subtle">{subtitle}</span>}
      </span>
      {badge}
      <ChevronRight size={18} className="flex-shrink-0 text-foreground-subtle" />
    </button>
  );
}

function ToggleRow({ title, hint, checked, disabled, onChange }: { title: string; hint?: string; checked: boolean; disabled?: boolean; onChange(value: boolean): void }) {
  return (
    <label className={`flex min-h-14 items-center gap-3 px-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] text-foreground">{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-5 text-foreground-subtle">{hint}</span>}
      </span>
      <input type="checkbox" className="h-6 w-6 flex-shrink-0 accent-[var(--primary)]" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function ChoiceRow({ title, selected, onClick }: { title: string; selected: boolean; onClick(): void }) {
  return (
    <button type="button" role="radio" aria-checked={selected} onClick={onClick} className="flex min-h-14 w-full items-center gap-3 px-4 text-left active:bg-surface-muted">
      <span className="min-w-0 flex-1 text-[15px] text-foreground">{title}</span>
      {selected && <Check size={19} className="flex-shrink-0 text-primary" />}
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[15px] text-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] text-foreground-subtle">{value}</span>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Pages
 * ------------------------------------------------------------------------- */

function AccountPage({ auth, isOnline, onOpenLeaderboard }: MobileSettingsScreenProps) {
  const { t } = useTranslation();
  const confirm = useMobileConfirm();
  const { sessionEmail, authReady, authBusy, authError, authEmail, setAuthEmail, authPassword, setAuthPassword, signIn, signOut, requestPasswordReset } = auth;
  const configError = getSupabaseConfigError();
  const canUseAccount = authReady && hasSupabaseConfig() && isOnline;

  if (sessionEmail) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <span className="grid h-12 w-12 flex-shrink-0 place-items-center rounded-full bg-primary text-lg font-semibold uppercase text-primary-foreground">{sessionEmail.slice(0, 1)}</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{sessionEmail}</p>
            <p className="text-[13px] text-foreground-subtle">{t("mobile:account.connected")}</p>
          </div>
        </div>
        <Group>
          <NavRow icon={<Trophy size={19} />} title={t("mobile:profile.rankingAndFriends")} onClick={onOpenLeaderboard} />
        </Group>
        <button
          type="button"
          disabled={authBusy}
          onClick={async () => {
            if (await confirm(t("mobile:account.signOutConfirm"))) await signOut();
          }}
          className="min-h-12 w-full rounded-2xl border border-destructive/40 text-[15px] font-semibold text-destructive active:bg-destructive-muted disabled:opacity-50"
        >
          {t("mobile:profile.signOut")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-6 text-foreground-muted">{t("mobile:settings.account.signedOutHint")}</p>
      {configError && <p className="rounded-2xl border border-warning/30 bg-warning-muted p-3 text-sm text-warning">{configError}</p>}
      {!isOnline && <p className="rounded-2xl border border-border bg-surface-muted p-3 text-sm text-foreground-muted">{t("mobile:settings.account.offline")}</p>}
      {authError && <p className="rounded-2xl border border-destructive/30 bg-destructive-muted p-3 text-sm text-destructive" role="alert">{authError}</p>}
      <MobileFieldFrame label={t("mobile:account.email")} htmlFor="mobile-settings-email">
        <MobileInput id="mobile-settings-email" icon={Mail} placeholder={t("mobile:account.emailPlaceholder")} autoComplete="email" inputMode="email" disabled={authBusy} value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
      </MobileFieldFrame>
      <MobileFieldFrame label={t("mobile:account.password")} htmlFor="mobile-settings-password">
        <MobileInput id="mobile-settings-password" icon={LockKeyhole} placeholder={t("mobile:account.passwordPlaceholder")} type="password" autoComplete="current-password" disabled={authBusy} value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
      </MobileFieldFrame>
      <button type="button" className="mobile-primary-button disabled:opacity-50" onClick={() => signIn("signin")} disabled={authBusy || !canUseAccount}>
        {authBusy ? t("mobile:account.signingIn") : t("mobile:account.signIn")}
      </button>
      <button type="button" className="mobile-choice w-full disabled:opacity-50" onClick={() => signIn("signup")} disabled={authBusy || !canUseAccount}>
        {t("mobile:settings.account.createAccount")}
      </button>
      <button type="button" className="min-h-11 w-full text-sm font-semibold text-primary disabled:opacity-50" onClick={requestPasswordReset} disabled={authBusy || !hasSupabaseConfig() || !isOnline}>
        {t("mobile:account.forgotPassword")}
      </button>
    </div>
  );
}

function GeneralPage() {
  const { t } = useTranslation();
  const { language, options, changeLanguage } = useLanguage();
  const [appearance, setAppearance] = useState(readMobileAppearance);
  const update = (patch: Parameters<typeof saveMobileAppearance>[0]) => setAppearance(saveMobileAppearance(patch));
  const themes: AppTheme[] = ["system", "light", "dark"];

  return (
    <div className="space-y-6">
      <Group title={t("mobile:settings.general.language")}>
        <div role="radiogroup" className="divide-y divide-border">
          {options.map((option) => (
            <ChoiceRow key={option.code} title={option.label} selected={language === option.code} onClick={() => void changeLanguage(option.code)} />
          ))}
        </div>
      </Group>

      <Group title={t("mobile:settings.general.theme")}>
        <div className="grid grid-cols-3 gap-2 p-2" role="radiogroup">
          {themes.map((theme) => (
            <button key={theme} type="button" role="radio" aria-checked={appearance.theme === theme} onClick={() => update({ theme })} className={`mobile-choice ${appearance.theme === theme ? "mobile-choice-active" : ""}`}>
              {t(`mobile:settings.general.themes.${theme}`)}
            </button>
          ))}
        </div>
      </Group>

      <Group title={t("mobile:settings.general.accent")}>
        <div className="grid grid-cols-6 gap-2 p-3" role="radiogroup">
          {ACCENT_COLORS.map((accent) => {
            const selected = appearance.accentColor === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={accent.label}
                onClick={() => update({ accentColor: accent.id })}
                className={`grid aspect-square place-items-center rounded-full border-2 ${selected ? "border-foreground" : "border-transparent"}`}
                style={{ background: accent.swatch }}
              >
                {selected && <Check size={18} style={{ color: accent.foreground }} />}
              </button>
            );
          })}
        </div>
      </Group>

      <Group>
        <ToggleRow title={t("mobile:settings.general.reducedEffects")} hint={t("mobile:settings.general.reducedEffectsHint")} checked={appearance.reducedEffects} onChange={(reducedEffects) => update({ reducedEffects })} />
      </Group>
    </div>
  );
}

function ReadingPage() {
  const { t } = useTranslation();
  const [controls, setControls] = useState<ReaderControlSettings>(loadReaderControls);
  const native = hasNativeReaderControls();
  const update = (patch: Partial<ReaderControlSettings>) => {
    setControls((current) => {
      const next = { ...current, ...patch };
      saveReaderControls(next);
      return next;
    });
  };
  const orientations: ReaderControlSettings["orientation"][] = ["auto", "portrait", "landscape"];

  return (
    <div className="space-y-6">
      <Group footer={native ? t("mobile:settings.reading.appliesNextOpen") : t("mobile:settings.reading.nativeOnly")}>
        <ToggleRow title={t("mobile:settings.reading.volumeKeys")} hint={t("mobile:settings.reading.volumeKeysHint")} checked={controls.volumeKeys} disabled={!native} onChange={(volumeKeys) => update({ volumeKeys })} />
        <ToggleRow title={t("mobile:settings.reading.keepAwake")} checked={controls.keepAwake} disabled={!native} onChange={(keepAwake) => update({ keepAwake })} />
        <ToggleRow title={t("mobile:settings.reading.tapZones")} hint={t("mobile:settings.reading.tapZonesHint")} checked={controls.tapZones} onChange={(tapZones) => update({ tapZones })} />
      </Group>
      <Group title={t("mobile:settings.reading.orientation")}>
        <div className="grid grid-cols-3 gap-2 p-2" role="radiogroup">
          {orientations.map((orientation) => (
            <button key={orientation} type="button" role="radio" aria-checked={controls.orientation === orientation} disabled={!native} onClick={() => update({ orientation })} className={`mobile-choice disabled:opacity-50 ${controls.orientation === orientation ? "mobile-choice-active" : ""}`}>
              {t(`mobile:settings.reading.orientations.${orientation}`)}
            </button>
          ))}
        </div>
      </Group>
    </div>
  );
}

function UpdatesPage({ updater }: MobileSettingsScreenProps) {
  const { t } = useTranslation();
  const { nativeApkUpdate, nativeApkUpdateBusy, refreshNativeApkUpdate, installNativeUpdate, openNativeInstallSettings } = updater;
  const progress = nativeApkUpdate.progress?.percent ?? 0;
  const publishedAt = formatMobileDate(nativeApkUpdate.manifest?.publishedAt);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-surface p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-primary-muted text-primary">
            {nativeApkUpdate.status === "checking" ? <RefreshCw size={19} className="animate-spin" /> : <Download size={19} />}
          </span>
          <p className="min-w-0 flex-1 pt-2 text-[15px] leading-6 text-foreground">{getNativeApkUpdateText(nativeApkUpdate)}</p>
        </div>
        {nativeApkUpdate.status === "downloading" && (
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs text-foreground-subtle">
              <span>{Math.round(progress)}%</span>
              <span>{formatMobileBytes(nativeApkUpdate.progress?.loaded)} / {formatMobileBytes(nativeApkUpdate.progress?.total)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} />
            </div>
          </div>
        )}
      </div>

      <Group>
        <InfoRow label={t("mobile:profile.installed")} value={nativeApkUpdate.installed ? `${nativeApkUpdate.installed.versionName} (${nativeApkUpdate.installed.versionCode})` : import.meta.env.VITE_APP_VERSION || t("mobile:profile.versionFallback")} />
        {nativeApkUpdate.manifest && (
          <InfoRow label={t("mobile:profile.available")} value={`${nativeApkUpdate.manifest.version} (${nativeApkUpdate.manifest.versionCode})${publishedAt ? ` · ${publishedAt}` : ""}`} />
        )}
        {nativeApkUpdate.manifest?.sizeBytes ? <InfoRow label={t("mobile:profile.size")} value={formatMobileBytes(nativeApkUpdate.manifest.sizeBytes)} /> : null}
      </Group>

      {nativeApkUpdate.manifest?.notes && (
        <Group title={t("mobile:settings.updates.notes")}>
          <p className="whitespace-pre-wrap p-4 text-sm leading-6 text-foreground-muted">{nativeApkUpdate.manifest.notes}</p>
        </Group>
      )}

      <div className="space-y-2">
        {nativeApkUpdate.status === "permission-required" && (
          <button type="button" className="mobile-choice w-full" onClick={openNativeInstallSettings}>{t("mobile:updater.openInstallPermission")}</button>
        )}
        {(nativeApkUpdate.status === "available" || nativeApkUpdate.status === "permission-required") && (
          <button type="button" className="mobile-primary-button disabled:opacity-60" onClick={installNativeUpdate} disabled={nativeApkUpdateBusy}>
            <Download size={18} />
            {nativeApkUpdateBusy ? t("mobile:updater.preparing") : t("mobile:updater.update")}
          </button>
        )}
        <button type="button" className="mobile-choice flex w-full items-center justify-center gap-2 disabled:opacity-60" onClick={() => { void refreshNativeApkUpdate(false); }} disabled={nativeApkUpdate.status === "checking" || nativeApkUpdateBusy}>
          <RefreshCw size={17} />
          {t("mobile:updater.check")}
        </button>
      </div>
    </div>
  );
}

function DataPage({ state, setState }: MobileSettingsScreenProps) {
  return (
    <div className="space-y-4">
      <MobileBackupPanel state={state} setState={setState} />
      <Suspense fallback={null}><MobileVocabularyPanel /></Suspense>
    </div>
  );
}

function AboutPage({ auth }: MobileSettingsScreenProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <Group>
        <InfoRow label={t("mobile:profile.version")} value={import.meta.env.VITE_APP_VERSION || t("mobile:profile.versionFallback")} />
        <InfoRow label={t("mobile:profile.supabase")} value={hasSupabaseConfig() ? t("mobile:profile.configured") : t("mobile:auth.notConfigured")} />
        <InfoRow label={t("mobile:profile.account")} value={!auth.authReady ? t("mobile:auth.checkingSession") : auth.sessionEmail || t("mobile:auth.localMode")} />
      </Group>
      <p className="px-1 text-xs leading-5 text-foreground-subtle">{t("mobile:profile.library")}</p>
    </div>
  );
}

/* ----------------------------------------------------------------------------
 * Shell
 * ------------------------------------------------------------------------- */

export default function MobileSettingsScreen(props: MobileSettingsScreenProps) {
  const { t } = useTranslation();
  const { language, options } = useLanguage();
  const [stack, setStack] = useState<SettingsPage[]>(["root"]);
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const page = stack[stack.length - 1] ?? "root";

  const open = (next: SettingsPage) => {
    setDirection("forward");
    setStack((current) => [...current, next]);
  };
  const back = useCallback(() => {
    setDirection("back");
    setStack((current) => (current.length > 1 ? current.slice(0, -1) : current));
  }, []);

  // Android back walks up the tree before leaving the settings.
  useEffect(() => {
    if (page === "root") return;
    const onBack = (event: Event) => {
      event.preventDefault();
      back();
    };
    window.addEventListener(BACK_EVENT, onBack);
    return () => window.removeEventListener(BACK_EVENT, onBack);
  }, [back, page]);

  const { sessionEmail, authReady } = props.auth;
  const { nativeApkUpdate } = props.updater;
  const updateAvailable = nativeApkUpdate.status === "available" || nativeApkUpdate.status === "permission-required";
  const appearance = readMobileAppearance();
  const languageLabel = options.find((option) => option.code === language)?.label ?? language;

  const body = (() => {
    switch (page) {
      case "account": return <AccountPage {...props} />;
      case "general": return <GeneralPage />;
      case "reading": return <ReadingPage />;
      case "updates": return <UpdatesPage {...props} />;
      case "data": return <DataPage {...props} />;
      case "about": return <AboutPage {...props} />;
      default:
        return (
          <div className="space-y-6">
            <Group>
              <button type="button" onClick={() => open("account")} className="flex min-h-[4.5rem] w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-muted">
                <span className={`grid h-12 w-12 flex-shrink-0 place-items-center rounded-full text-lg font-semibold uppercase ${sessionEmail ? "bg-primary text-primary-foreground" : "bg-surface-muted text-foreground-muted"}`}>
                  {sessionEmail ? sessionEmail.slice(0, 1) : <UserCircle size={24} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-foreground">{sessionEmail || t("mobile:settings.account.signedOut")}</span>
                  <span className="block truncate text-[13px] text-foreground-subtle">
                    {!authReady ? t("mobile:auth.checkingSession") : sessionEmail ? t("mobile:settings.account.manage") : t("mobile:settings.account.signInHint")}
                  </span>
                </span>
                <ChevronRight size={18} className="flex-shrink-0 text-foreground-subtle" />
              </button>
            </Group>

            <Group title={t("mobile:settings.sections.app")}>
              <NavRow icon={<Palette size={19} />} title={t(PAGE_TITLES.general)} subtitle={`${languageLabel} · ${t(`mobile:settings.general.themes.${appearance.theme}`)}`} onClick={() => open("general")} />
              <NavRow icon={<BookOpen size={19} />} title={t(PAGE_TITLES.reading)} subtitle={t("mobile:settings.reading.subtitle")} onClick={() => open("reading")} />
              <NavRow
                icon={<Download size={19} />}
                title={t(PAGE_TITLES.updates)}
                subtitle={getNativeApkUpdateText(nativeApkUpdate)}
                badge={updateAvailable ? <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">{t("mobile:settings.updates.new")}</span> : undefined}
                onClick={() => open("updates")}
              />
            </Group>

            <Group title={t("mobile:settings.sections.data")}>
              <NavRow icon={<Database size={19} />} title={t(PAGE_TITLES.data)} subtitle={t("mobile:settings.data.subtitle")} onClick={() => open("data")} />
              <NavRow icon={<Info size={19} />} title={t(PAGE_TITLES.about)} subtitle={import.meta.env.VITE_APP_VERSION || t("mobile:profile.versionFallback")} onClick={() => open("about")} />
            </Group>
          </div>
        );
    }
  })();

  return (
    <section className="min-h-full">
      {page !== "root" && (
        <div className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-border bg-overlay px-1.5 backdrop-blur">
          <button type="button" onClick={back} aria-label={t("common:actions.back")} className="grid h-11 w-11 place-items-center rounded-full text-foreground active:bg-surface-muted">
            <ChevronLeft size={22} />
          </button>
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">{t(PAGE_TITLES[page])}</h2>
        </div>
      )}
      <div key={`${page}-${stack.length}`} className={`p-4 ${direction === "forward" ? "mobile-settings-forward" : "mobile-settings-back"}`}>
        {body}
      </div>
    </section>
  );
}

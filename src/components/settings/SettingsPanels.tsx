import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpen,
  Camera,
  Check,
  Download,
  Lock,
  Minus,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sun,
  Trash2,
  User,
  Keyboard,
  DatabaseBackup,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  getUserProfile,
  updateProfileNickname,
  updateUserProfile,
} from "../../api/database";
import Skeleton from "../Skeleton";
import { useDictionary } from "../../hooks/useDictionary";
import { supabase } from "../../lib/supabase";
import {
  MIN_PASSWORD_LENGTH,
  updateAccountPassword,
  validatePasswordStrength,
} from "../../utils/auth";
import { useAuth } from "../../contexts/AuthContext";
import {
  ACCENT_COLORS,
  useAppSettings,
} from "../../contexts/AppSettingsContext";
import type { AppTheme } from "../../contexts/AppSettingsContext";
import ConfirmDialog from "../ConfirmDialog";
import {
  getDefaultHotkeyBindings,
  getEnabledNavigationRoutes,
  getRouteLabel,
} from "../../navigation/routes";
import { LanguageSwitcher, useLanguage, useTranslation } from "../../i18n";
import type { TranslationKey } from "../../i18n";

type DesktopUpdateStatus =
  | "idle"
  | "disabled"
  | "checking"
  | "available"
  | "not-available"
  | "downloading"
  | "downloaded"
  | "error";

interface DesktopUpdateState {
  status: DesktopUpdateStatus;
  currentVersion: string;
  source: "github";
  canCheck: boolean;
  canInstall: boolean;
  updateAvailable: boolean;
  checkedAt?: string;
  downloadedAt?: string;
  updateInfo?: {
    version?: string;
    releaseName?: string;
    releaseDate?: string;
    releaseNotes?: string | null;
  };
  progress?: {
    percent: number;
    bytesPerSecond: number;
    transferred: number;
    total: number;
  };
  error?: string;
}

const DEFAULT_UPDATE_STATE: DesktopUpdateState = {
  status: "idle",
  currentVersion: "0.0.0",
  source: "github",
  canCheck: false,
  canInstall: false,
  updateAvailable: false,
};

interface UserMetadata {
  full_name?: string;
  avatar_url?: string;
}

async function fetchCurrentUser(): Promise<{
  id: string;
  email: string;
  metadata: UserMetadata;
  name?: string;
  nickname?: string | null;
  level?: number;
  avatar_url?: string;
}> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) throw new Error("Usuário não autenticado");

  const profile = await getUserProfile();

  return {
    id: user.id,
    email: user.email || "",
    metadata: (user.user_metadata as UserMetadata) || {},
    name: profile?.name || "",
    nickname: profile?.nickname || "",
    level: 1,
    avatar_url: profile?.avatar_url || "",
  };
}

async function updateUserMetadata(metadata: UserMetadata) {
  const { data, error } = await supabase.auth.updateUser({
    data: metadata,
  });

  if (error) throw error;
  if (!data?.user) throw new Error("Erro ao atualizar usuário");

  await updateUserProfile(metadata.full_name, metadata.avatar_url);

  return data.user;
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-zinc-800/80 py-6 first:pt-0 last:border-b-0 last:pb-0">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-zinc-100">{title}</h3>
        {description && (
          <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-zinc-500">
      {children}
    </label>
  );
}

function inputClasses(disabled = false) {
  return [
    "w-full rounded border px-3 py-2 text-sm transition",
    disabled
      ? "border-zinc-800 bg-zinc-900/70 text-zinc-500"
      : "border-zinc-700 bg-zinc-950/60 text-zinc-100 placeholder:text-zinc-600 focus:border-green-500",
  ].join(" ");
}

function PrimaryButton({
  children,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-4 text-sm font-medium text-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function DangerButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 items-center gap-2 rounded border border-red-500/30 bg-red-500/10 px-4 text-sm font-medium text-red-300 transition hover:border-red-500/50 hover:bg-red-500/20 hover:text-red-200"
    >
      {children}
    </button>
  );
}

function formatBytes(bytes?: number) {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatUpdateDate(value: string | undefined, locale: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(locale, {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const UPDATE_STATUS_LABEL_KEYS: Record<
  DesktopUpdateStatus,
  TranslationKey
> = {
  idle: "settings:updates.status.idle",
  disabled: "settings:updates.status.disabled",
  checking: "settings:updates.status.checking",
  available: "settings:updates.status.available",
  "not-available": "settings:updates.status.notAvailable",
  downloading: "settings:updates.status.downloading",
  downloaded: "settings:updates.status.downloaded",
  error: "settings:updates.status.error",
};

const THEME_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const THEME_IDS: AppTheme[] = ["light", "dark", "system"];

export function AppearanceSettingsPanel() {
  const { settings, effectiveTheme, setTheme, setAccentColor } =
    useAppSettings();
  const { t } = useTranslation();

  return (
    <div>
      <SettingsSection
        title={t("settings:appearance.theme.title")}
        description={t("settings:appearance.theme.description")}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {THEME_IDS.map((themeId) => {
            const Icon = THEME_ICONS[themeId];
            const option = {
              label: t(`settings:appearance.themeOptions.${themeId}.label`),
              description: t(
                `settings:appearance.themeOptions.${themeId}.description`,
              ),
            };
            const isSelected = settings.theme === themeId;

            return (
              <button
                key={themeId}
                type="button"
                onClick={() => setTheme(themeId)}
                className={`rounded border p-4 text-left transition ${
                  isSelected
                    ? "border-green-500 bg-green-500/10"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <Icon
                    size={18}
                    className={isSelected ? "text-green-500" : "text-zinc-500"}
                  />
                  {isSelected && <Check size={16} className="text-green-500" />}
                </div>
                <p className="text-sm font-medium text-zinc-100">
                  {option.label}
                </p>
                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  {option.description}
                </p>
              </button>
            );
          })}
        </div>

        {settings.theme === "system" && (
          <p className="mt-3 text-xs text-zinc-500">
            {t("settings:appearance.activeTheme", {
              theme: t(
                effectiveTheme === "light"
                  ? "settings:appearance.lightThemeName"
                  : "settings:appearance.darkThemeName",
              ),
            })}
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("settings:appearance.accent.title")}
        description={t("settings:appearance.accent.description")}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACCENT_COLORS.map((color) => {
            const isSelected = settings.accentColor === color.id;

            return (
              <button
                key={color.id}
                type="button"
                onClick={() => setAccentColor(color.id)}
                className={`flex items-center justify-between gap-3 rounded border px-3 py-3 text-left transition ${
                  isSelected
                    ? "border-green-500 bg-green-500/10"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700 hover:bg-zinc-900"
                }`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-zinc-700"
                    style={{ backgroundColor: color.swatch }}
                  />
                  <span className="truncate text-sm font-medium text-zinc-100">
                    {t(`settings:appearance.accent.colors.${color.id}`)}
                  </span>
                </span>
                {isSelected && <Check size={16} className="text-green-500" />}
              </button>
            );
          })}
        </div>

        <div className="mt-5 rounded border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-zinc-100">
            <Palette size={16} className="text-green-500" />
            {t("settings:appearance.accent.preview")}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-9 items-center rounded bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-500">
              {t("settings:appearance.accent.primaryButton")}
            </button>
            <span className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm text-green-400">
              {t("settings:appearance.accent.activeState")}
            </span>
            <span className="text-sm text-green-500">
              {t("settings:appearance.accent.highlightedLink")}
            </span>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

export function AccountSettingsPanel({
  onRequestClose,
}: {
  onRequestClose?: () => void;
}) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const { data: user, isLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: fetchCurrentUser,
  });

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setNickname(user.nickname || "");
      setAvatarUrl(user.avatar_url || "");
    }
  }, [user]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      toast.error(t("settings:account.invalidImageType"));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("settings:account.imageTooLarge"));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setIsUploading(true);
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${user?.id || "anonymous"}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error(t("settings:account.uploadFailed"));
    } finally {
      setIsUploading(false);
    }
  };

  const accountMutation = useMutation({
    mutationFn: async () => {
      await updateUserMetadata({ full_name: name, avatar_url: avatarUrl });

      const nextNickname = nickname.trim().replace(/^@/, "").toLowerCase();
      if (nextNickname && nextNickname !== user?.nickname) {
        await updateProfileNickname(nextNickname);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      toast.success(t("settings:account.updated"));
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => updateAccountPassword(newPassword),
    onSuccess: () => {
      toast.success(t("settings:account.passwordUpdated"));
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleNameSubmit = (e: FormEvent) => {
    e.preventDefault();
    accountMutation.mutate();
  };

  const handlePasswordSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t("settings:account.passwordsDoNotMatch"));
      return;
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      toast.error(t(passwordError.key, passwordError.values));
      return;
    }
    passwordMutation.mutate();
  };

  const handleSignOut = async () => {
    await signOut();
    onRequestClose?.();
    navigate("/signin");
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div>
      <SettingsSection
        title={t("settings:account.personal.title")}
        description={t("settings:account.personal.description")}
      >
        <form onSubmit={handleNameSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[104px_1fr]">
            <div className="relative h-24 w-24">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                {avatarPreview || avatarUrl ? (
                  <img
                    src={avatarPreview || avatarUrl}
                    alt={t("settings:account.avatarAlt")}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={38} className="text-zinc-500" />
                )}
              </div>
              <button
                type="button"
                title={t("settings:account.changeAvatar")}
                aria-label={t("settings:account.changeAvatar")}
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100 disabled:opacity-50"
                disabled={isUploading}
              >
                <Camera size={15} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            <div className="space-y-4">
              <div>
                <FieldLabel>{t("settings:account.name")}</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses()}
                />
              </div>
              <div>
                <FieldLabel>{t("settings:account.email")}</FieldLabel>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className={inputClasses(true)}
                />
              </div>
              <div>
                <FieldLabel>{t("settings:account.nickname")}</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-600">
                    @
                  </span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={`${inputClasses()} pl-7`}
                    placeholder={t("settings:account.nicknamePlaceholder")}
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("settings:account.nicknameHint")}
                </p>
              </div>
            </div>
          </div>

          <PrimaryButton type="submit" disabled={accountMutation.isPending}>
            <Save size={16} />
            {accountMutation.isPending
              ? t("settings:account.saving")
              : t("settings:account.saveAccount")}
          </PrimaryButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title={t("settings:account.security.title")}
        description={t("settings:account.security.description")}
      >
        <form onSubmit={handlePasswordSubmit} className="max-w-xl space-y-4">
          <div>
            <FieldLabel>{t("settings:account.newPassword")}</FieldLabel>
            <input
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClasses()}
            />
          </div>
          <div>
            <FieldLabel>{t("settings:account.confirmPassword")}</FieldLabel>
            <input
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={inputClasses()}
            />
          </div>
          <PrimaryButton type="submit" disabled={passwordMutation.isPending}>
            <Lock size={16} />
            {passwordMutation.isPending
              ? t("settings:account.changing")
              : t("settings:account.changePassword")}
          </PrimaryButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title={t("settings:account.session.title")}
        description={t("settings:account.session.description")}
      >
        <DangerButton onClick={() => setConfirmSignOut(true)}>
          {t("settings:account.signOut")}
        </DangerButton>
        <ConfirmDialog
          isOpen={confirmSignOut}
          title={t("settings:account.signOutConfirmTitle")}
          message={t("settings:account.signOutConfirmMessage")}
          confirmLabel={t("settings:account.signOutConfirmLabel")}
          onConfirm={() => void handleSignOut()}
          onCancel={() => setConfirmSignOut(false)}
          isDanger
        />
      </SettingsSection>
    </div>
  );
}

export function GeneralSettingsPanel() {
  const {
    settings,
    setCopyYesterdayReadings,
    setAutoHideEnabled,
    setAutoHideOverlay,
  } = useAppSettings();
  const { t } = useTranslation();

  return (
    <div>
      <SettingsSection
        title={t("settings:language.title")}
        description={t("settings:language.description")}
      >
        <LanguageSwitcher />
      </SettingsSection>
      <SettingsSection
        title={t("settings:general.interface.title")}
        description={t("settings:general.interface.description")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {t("settings:general.autoHide.title")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("settings:general.autoHide.description")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAutoHideEnabled(!settings.autoHideEnabled)}
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                settings.autoHideEnabled ? "bg-green-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`h-4 w-4 rounded-full bg-white transition-transform ${
                  settings.autoHideEnabled ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {settings.autoHideEnabled && (
            <div className="flex items-center justify-between pl-4 border-l-2 border-zinc-800">
              <div>
                <p className="text-sm font-medium text-zinc-100">
                  {t("settings:general.overlayMode.title")}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {t("settings:general.overlayMode.description")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAutoHideOverlay(!settings.autoHideOverlay)}
                className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
                  settings.autoHideOverlay ? "bg-green-500" : "bg-zinc-700"
                }`}
              >
                <span
                  className={`h-4 w-4 rounded-full bg-white transition-transform ${
                    settings.autoHideOverlay ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </SettingsSection>

      <SettingsSection
        title={t("settings:general.dashboard.title")}
        description={t("settings:general.dashboard.description")}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("settings:general.copyYesterdayReadings.title")}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {t("settings:general.copyYesterdayReadings.description")}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCopyYesterdayReadings(!settings.copyYesterdayReadings)}
            className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
              settings.copyYesterdayReadings ? "bg-green-500" : "bg-zinc-700"
            }`}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                settings.copyYesterdayReadings ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}

export function HotkeysSettingsPanel() {
  const {
    settings,
    setHotkeysEnabled,
    setHotkeyBinding,
    resetHotkeyBindings,
  } = useAppSettings();
  const { t } = useTranslation();
  const routes = getEnabledNavigationRoutes(settings);
  const bindings = settings.hotkeysCustomized
    ? settings.hotkeyBindings
    : getDefaultHotkeyBindings(settings);

  return (
    <div>
      <SettingsSection
        title={t("settings:hotkeys.title")}
        description={t("settings:hotkeys.description")}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                {t("settings:hotkeys.enable.title")}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {t("settings:hotkeys.enable.description")}
              </p>
            </div>
            <button
              type="button"
              aria-label={t("settings:hotkeys.enable.toggleLabel")}
              aria-pressed={settings.hotkeysEnabled}
              onClick={() => setHotkeysEnabled(!settings.hotkeysEnabled)}
              className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${settings.hotkeysEnabled ? "bg-green-500" : "bg-zinc-700"}`}
            >
              <span className={`h-4 w-4 rounded-full bg-white transition-transform ${settings.hotkeysEnabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
          </div>

          

          <div className="divide-y divide-zinc-800 rounded border border-zinc-800">
            {routes.map((route) => (
              <div key={route.id} className="flex items-center justify-between gap-4 px-3 py-2.5">
                <span className="text-sm text-zinc-200">
                  {getRouteLabel(route, t)}
                </span>
                <select
                  aria-label={t("settings:hotkeys.routeShortcutLabel", {
                    route: getRouteLabel(route, t),
                  })}
                  value={bindings[route.id] || ""}
                  onChange={(event) => setHotkeyBinding(route.id, event.target.value)}
                  className="h-8 rounded border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-200"
                >
                  <option value="">{t("settings:hotkeys.noShortcut")}</option>
                  {Array.from({ length: 9 }, (_, index) => String(index + 1)).map((key) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={resetHotkeyBindings}
            className="inline-flex h-9 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            <Keyboard size={15} />
            {t("settings:hotkeys.resetAutomaticOrder")}
          </button>
          <p className="text-xs leading-5 text-zinc-500">
            {t("settings:hotkeys.automaticOrderNote")}
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}

const LAST_BACKUP_KEY = "lyceum:last-periodic-backup";

export function BackupSettingsPanel() {
  const { settings, setWeeklyBackupEnabled, setBackupSelection } = useAppSettings();
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [running, setRunning] = useState(false);
  const [lastBackup, setLastBackup] = useState(() => Number(localStorage.getItem(LAST_BACKUP_KEY) || 0));

  const runBackup = async () => {
    const jobs: Promise<{ success: number; failed: number; errors: string[] }>[] = [];
    if (settings.backupDocuments && window.api?.backupAllDocuments) jobs.push(window.api.backupAllDocuments());
    if (settings.backupHabits && window.api?.backupAllHabits) jobs.push(window.api.backupAllHabits());
    if (settings.backupCategories && window.api?.backupAllCategories) jobs.push(window.api.backupAllCategories());
    if (jobs.length === 0) {
      toast.error(t("settings:backups.selectAtLeastOne"));
      return;
    }
    setRunning(true);
    try {
      const results = await Promise.all(jobs);
      const failed = results.reduce((sum, result) => sum + result.failed, 0);
      if (failed > 0) {
        toast.error(
          t("settings:backups.completedWithFailures", { count: failed }),
        );
      } else {
        const completedAt = Date.now();
        localStorage.setItem(LAST_BACKUP_KEY, String(completedAt));
        setLastBackup(completedAt);
        toast.success(t("settings:backups.completed"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings:backups.failed"),
      );
    } finally {
      setRunning(false);
    }
  };

  const backupOptions = [
    ["backupDocuments", "settings:backups.items.libraryAndProgress"],
    ["backupHabits", "settings:backups.items.habitsAndHighlights"],
    ["backupCategories", "settings:backups.items.categories"],
  ] as const;

  return (
    <div>
      <SettingsSection
        title={t("settings:backups.title")}
        description={t("settings:backups.description")}
      >
        <div className="space-y-4">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium text-zinc-100">
              {t("settings:backups.enable")}
            </span>
            <input type="checkbox" checked={settings.weeklyBackupEnabled} onChange={(event) => setWeeklyBackupEnabled(event.target.checked)} className="h-4 w-4 accent-green-500" />
          </label>
          <div className="space-y-2 rounded border border-zinc-800 p-3">
            {backupOptions.map(([key, labelKey]) => (
              <label key={key} className="flex items-center gap-3 text-sm text-zinc-300">
                <input type="checkbox" checked={settings[key]} onChange={(event) => setBackupSelection(key, event.target.checked)} className="h-4 w-4 accent-green-500" />
                {t(labelKey)}
              </label>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs text-zinc-500">
              {lastBackup
                ? t("settings:backups.lastBackup", {
                    date: new Date(lastBackup).toLocaleString(locale),
                  })
                : t("settings:backups.noBackupYet")}
            </span>
            <button type="button" disabled={running} onClick={() => void runBackup()} className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50">
              <DatabaseBackup size={15} />
              {running
                ? t("settings:backups.running")
                : t("settings:backups.runNow")}
            </button>
          </div>
        </div>
      </SettingsSection>
    </div>
  );
}

export function LibrarySettingsPanel() {
  const {
    settings,
    setShowSubfolderBooks,
    setUnifiedLibraryView,
  } = useAppSettings();
  const { t } = useTranslation();

  return (
    <div>
      <SettingsSection
        title={t("settings:library.folders.title")}
        description={t("settings:library.folders.description")}
      >
        <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("settings:library.showSubfolderBooks.title")}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {t("settings:library.showSubfolderBooks.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("settings:library.showSubfolderBooks.toggleLabel")}
            onClick={() => setShowSubfolderBooks(!settings.showSubfolderBooks)}
            className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
              settings.showSubfolderBooks ? "bg-green-500" : "bg-zinc-700"
            }`}
            aria-pressed={settings.showSubfolderBooks}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                settings.showSubfolderBooks ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-zinc-800/70 pt-5">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("settings:library.unifiedView.title")}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {t("settings:library.unifiedView.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("settings:library.unifiedView.toggleLabel")}
            onClick={() => setUnifiedLibraryView(!settings.unifiedLibraryView)}
            className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
              settings.unifiedLibraryView ? "bg-green-500" : "bg-zinc-700"
            }`}
            aria-pressed={settings.unifiedLibraryView}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                settings.unifiedLibraryView ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
        </div>
      </SettingsSection>
    </div>
  );
}

export function UpdatesSettingsPanel() {
  const { t } = useTranslation();
  const { locale } = useLanguage();
  const [updateState, setUpdateState] = useState<DesktopUpdateState>(DEFAULT_UPDATE_STATE);
  const [isRequesting, setIsRequesting] = useState(false);

  useEffect(() => {
    let disposed = false;

    window.api?.updatesGetStatus?.().then((state: DesktopUpdateState) => {
      if (!disposed && state) setUpdateState(state);
    });

    const unsubscribe = window.api?.onUpdatesStatusChanged?.((state: DesktopUpdateState) => {
      setUpdateState(state);
    });

    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, []);

  const checkForUpdates = async () => {
    if (!window.api?.updatesCheck) {
      toast.error(t("settings:updates.unavailable"));
      return;
    }

    try {
      setIsRequesting(true);
      const nextState = await window.api.updatesCheck();
      setUpdateState(nextState);
      if (nextState.status === "not-available") {
        toast.success(t("settings:updates.alreadyLatest"));
      } else if (nextState.status === "disabled") {
        toast(t("settings:updates.installedAppOnly"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("settings:updates.checkFailed"),
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const downloadUpdate = async () => {
    if (!window.api?.updatesDownload) return;

    try {
      setIsRequesting(true);
      setUpdateState(await window.api.updatesDownload());
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:updates.downloadFailed"),
      );
    } finally {
      setIsRequesting(false);
    }
  };

  const installNow = async () => {
    if (!window.api?.updatesInstallNow) return;

    const result = await window.api.updatesInstallNow();
    if (!result.success) {
      toast.error(result.error || t("settings:updates.nothingToInstall"));
    }
  };

  const progress = updateState.progress?.percent ?? 0;
  const checkedAt = formatUpdateDate(updateState.checkedAt, locale);
  const downloadedAt = formatUpdateDate(updateState.downloadedAt, locale);
  const releaseDate = formatUpdateDate(updateState.updateInfo?.releaseDate, locale);
  const isChecking = updateState.status === "checking" || isRequesting;
  const isDownloading = updateState.status === "downloading";
  const canDownload = updateState.status === "available" && !isRequesting;

  return (
    <div>
      <SettingsSection
        title={t("settings:updates.title")}
        description={t("settings:updates.description")}
      >
        <div className="space-y-5">
          <div className="rounded border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Lyceum {updateState.currentVersion}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  {t(UPDATE_STATUS_LABEL_KEYS[updateState.status])}
                </p>
                {updateState.updateInfo?.version && updateState.updateInfo.version !== updateState.currentVersion ? (
                  <p className="mt-2 text-sm text-green-400">
                    {releaseDate
                      ? t("settings:updates.availableVersion", {
                          version: updateState.updateInfo.version,
                          date: releaseDate,
                        })
                      : t("settings:updates.availableVersionNoDate", {
                          version: updateState.updateInfo.version,
                        })}
                  </p>
                ) : null}
                {checkedAt ? (
                  <p className="mt-2 text-xs text-zinc-600">
                    {t("settings:updates.lastCheck", { date: checkedAt })}
                  </p>
                ) : null}
                {downloadedAt ? (
                  <p className="mt-1 text-xs text-zinc-600">
                    {t("settings:updates.downloadFinished", { date: downloadedAt })}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={checkForUpdates}
                  disabled={!updateState.canCheck || isChecking || isDownloading}
                  className="inline-flex h-9 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isChecking ? "animate-spin" : ""} />
                  {t("settings:updates.check")}
                </button>
                {canDownload ? (
                  <button
                    type="button"
                    onClick={downloadUpdate}
                    className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-500"
                  >
                    <Download size={14} />
                    {t("settings:updates.download")}
                  </button>
                ) : null}
                {updateState.canInstall ? (
                  <button
                    type="button"
                    onClick={installNow}
                    className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-500"
                  >
                    <Download size={14} />
                    {t("settings:updates.installNow")}
                  </button>
                ) : null}
              </div>
            </div>

            {isDownloading || updateState.status === "downloaded" ? (
              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
                  <span>{Math.round(progress)}%</span>
                  <span>
                    {formatBytes(updateState.progress?.transferred)} / {formatBytes(updateState.progress?.total)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-green-500 transition-all"
                    style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
                  />
                </div>
              </div>
            ) : null}

            {updateState.status === "downloaded" ? (
              <p className="mt-4 text-xs leading-5 text-zinc-500">
                {t("settings:updates.installLaterNote")}
              </p>
            ) : null}

            {updateState.error ? (
              <p className="mt-4 rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {updateState.error}
              </p>
            ) : null}
          </div>

          {updateState.updateInfo?.releaseNotes ? (
            <div className="rounded border border-zinc-800 bg-zinc-950/40 p-4">
              <p className="text-sm font-semibold text-zinc-100">
                {t("settings:updates.releaseNotes")}
              </p>
              <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-zinc-400">
                {updateState.updateInfo.releaseNotes}
              </div>
            </div>
          ) : null}
        </div>
      </SettingsSection>
    </div>
  );
}

export function DictionarySettingsPanel() {
  const {
    dictionaries,
    selectedDict,
    isLoaded: isDictsLoaded,
    isDownloading,
    downloadProgress,
    selectDictionary,
    downloadDictionary,
    deleteDictionary,
    refreshIndex,
  } = useDictionary();
  const { t } = useTranslation();

  return (
    <div>
      <SettingsSection
        title={t("settings:dictionaries.title")}
        description={t("settings:dictionaries.description")}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <BookOpen size={16} className="text-zinc-500" />
            <span>
              {t("settings:dictionaries.available", {
                count: dictionaries.length,
              })}
            </span>
          </div>
          <button
            onClick={() => refreshIndex()}
            className="inline-flex h-8 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            title={t("settings:dictionaries.refreshList")}
          >
            <RefreshCw size={14} />
            {t("settings:dictionaries.refresh")}
          </button>
        </div>

        {!isDictsLoaded ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : dictionaries.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            {t("settings:dictionaries.empty")}
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-zinc-800">
            {dictionaries.map((dict) => {
              const progress = downloadProgress[dict.id] || 0;
              const isDownloadingThis =
                isDownloading && progress > 0 && progress < 100;

              return (
                <div
                  key={dict.id}
                  className={`flex items-center justify-between gap-4 border-b border-zinc-800 px-4 py-3 last:border-b-0 ${
                    selectedDict === dict.id
                      ? "bg-green-500/5"
                      : "bg-zinc-950/30"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-100">
                      {dict.name}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {t("settings:dictionaries.languagePair", {
                        source: dict.sourceLang.toUpperCase(),
                        target: dict.targetLang.toUpperCase(),
                      })}
                      {dict.size &&
                        ` - ${(dict.size / (1024 * 1024)).toFixed(1)}MB`}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {isDownloadingThis ? (
                      <div className="flex items-center gap-2 text-sm text-zinc-400">
                        <RefreshCw size={14} className="animate-spin" />
                        {progress}%
                      </div>
                    ) : dict.isDownloaded ? (
                      <>
                        <button
                          onClick={() => selectDictionary(dict.id)}
                          className={`h-8 rounded px-3 text-sm font-medium transition ${
                            selectedDict === dict.id
                              ? "bg-zinc-100 text-zinc-950"
                              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                          }`}
                        >
                          {selectedDict === dict.id
                            ? t("settings:dictionaries.active")
                            : t("settings:dictionaries.activate")}
                        </button>
                        <button
                          onClick={() => deleteDictionary(dict.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                          title={t("settings:dictionaries.remove")}
                          aria-label={t("settings:dictionaries.removeLabel")}
                        >
                          <Trash2 size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => downloadDictionary(dict.id)}
                        disabled={isDownloading}
                        className="inline-flex h-8 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Download size={14} />
                        {t("settings:dictionaries.download")}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSection>
    </div>
  );
}

export function BetaSettingsPanel() {
  const {
    settings,
    setBetaAtlasEnabled,
    setBetaConversionEnabled,
    setBetaHabitsEnabled,
  } = useAppSettings();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { t } = useTranslation();

  const features = [
    {
      key: "atlas" as const,
      label: t("settings:beta.features.atlas.label"),
      hint: t("settings:beta.features.atlas.hint"),
      enabled: settings.betaAtlasEnabled,
      setEnabled: setBetaAtlasEnabled,
      route: "/atlas",
    },
    {
      key: "conversion" as const,
      label: t("settings:beta.features.conversion.label"),
      hint: t("settings:beta.features.conversion.hint"),
      enabled: settings.betaConversionEnabled,
      setEnabled: setBetaConversionEnabled,
      route: null,
    },
    {
      key: "habits" as const,
      label: t("settings:beta.features.habits.label"),
      hint: t("settings:beta.features.habits.hint"),
      enabled: settings.betaHabitsEnabled,
      setEnabled: setBetaHabitsEnabled,
      route: "/habit_tracker",
    },
  ];

  const handleToggle = (
    route: string | null,
    setEnabled: (value: boolean) => void,
    current: boolean,
  ) => {
    const next = !current;
    setEnabled(next);
    if (!next && route && pathname === route) {
      navigate("/");
    }
  };

  return (
    <div>
      <SettingsSection
        title={t("settings:beta.title")}
        description={t("settings:beta.description")}
      >
        <ul className="space-y-2">
          {features.map((feature) => (
            <li
              key={feature.key}
              className="flex items-center justify-between gap-4 rounded border border-zinc-800 bg-zinc-950/40 px-3 py-2.5"
            >
              <div>
                <p className="text-sm font-medium text-zinc-100">{feature.label}</p>
                <p className="mt-0.5 text-xs text-zinc-500">{feature.hint}</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label={t("settings:beta.toggleLabel", {
                    feature: feature.label,
                  })}
                  aria-pressed={feature.enabled}
                  onClick={() =>
                    handleToggle(feature.route, feature.setEnabled, feature.enabled)
                  }
                  className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
                    feature.enabled ? "bg-green-500" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-white transition-transform ${
                      feature.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </div>
  );
}

export function ZoomSettingsPanel() {
  const { t } = useTranslation();
  const [zoomFactor, setZoomFactorLocal] = useState(1);

  useEffect(() => {
    window.api?.getZoomFactor().then((factor) => {
      setZoomFactorLocal(factor);
    });

    const unsubscribe = window.api?.onZoomFactorChanged((factor) => {
      setZoomFactorLocal(factor);
    });

    return () => {
      unsubscribe?.();
    };
  }, []);

  const zoomPercent = Math.round(zoomFactor * 100);

  const handleZoomIn = () => {
    window.api?.zoomIn();
  };

  const handleZoomOut = () => {
    window.api?.zoomOut();
  };

  const handleReset = () => {
    window.api?.zoomReset();
  };

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value) / 100;
    setZoomFactorLocal(value);
    window.api?.setZoomFactor(value);
  };

  return (
    <div>
      <SettingsSection
        title={t("settings:zoom.title")}
        description={t("settings:zoom.description")}
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleZoomOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-950/40 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              title={t("settings:zoom.zoomOut")}
              aria-label={t("settings:zoom.zoomOut")}
            >
              <Minus size={16} />
            </button>

            <div className="flex-1">
              <input
                type="range"
                min={50}
                max={300}
                value={zoomPercent}
                onChange={handleSliderChange}
                className="w-full accent-green-500"
              />
            </div>

            <button
              onClick={handleZoomIn}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-950/40 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              title={t("settings:zoom.zoomIn")}
              aria-label={t("settings:zoom.zoomIn")}
            >
              <Plus size={16} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-zinc-400">{zoomPercent}%</span>
            <button
              onClick={handleReset}
              className="inline-flex h-8 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <RotateCcw size={14} />
              {t("settings:zoom.reset")}
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            {t("settings:zoom.shortcutsHint")}
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}

export function PerformanceSettingsPanel() {
  const { settings, setReducedEffects } = useAppSettings();
  const { t } = useTranslation();

  return (
    <div>
      <SettingsSection
        title={t("settings:performance.title")}
        description={t("settings:performance.description")}
      >
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              {t("settings:performance.reduceEffects.title")}
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              {t("settings:performance.reduceEffects.description")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("settings:performance.reduceEffects.toggleLabel")}
            onClick={() => setReducedEffects(!settings.reducedEffects)}
            className={`flex h-5 w-9 flex-shrink-0 items-center rounded-full p-0.5 transition-colors ${
              settings.reducedEffects ? "bg-green-500" : "bg-zinc-700"
            }`}
            aria-pressed={settings.reducedEffects}
          >
            <span
              className={`h-4 w-4 rounded-full bg-white transition-transform ${
                settings.reducedEffects ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </SettingsSection>
    </div>
  );
}

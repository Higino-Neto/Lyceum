import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
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

function formatUpdateDate(value?: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getUpdateStatusLabel(state: DesktopUpdateState) {
  switch (state.status) {
    case "disabled":
      return "Atualizacoes disponiveis apenas no app instalado.";
    case "checking":
      return "Buscando atualizacoes...";
    case "available":
      return "Atualizacao encontrada. O download deve iniciar automaticamente.";
    case "downloading":
      return "Baixando atualizacao...";
    case "downloaded":
      return "Atualizacao pronta para instalar.";
    case "not-available":
      return "Voce esta usando a versao mais recente.";
    case "error":
      return "Nao foi possivel verificar atualizacoes.";
    default:
      return "Nenhuma verificacao feita nesta sessao.";
  }
}

const themeOptions: Array<{
  id: AppTheme;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    id: "light",
    label: "Claro",
    description: "Interface clara em todos os ambientes.",
    icon: Sun,
  },
  {
    id: "dark",
    label: "Escuro",
    description: "Interface escura fixa.",
    icon: Moon,
  },
  {
    id: "system",
    label: "Sistema",
    description: "Segue o tema do sistema operacional.",
    icon: Monitor,
  },
];

export function AppearanceSettingsPanel() {
  const { settings, effectiveTheme, setTheme, setAccentColor } =
    useAppSettings();

  return (
    <div>
      <SettingsSection
        title="Tema"
        description="Escolha entre claro, escuro ou deixe o Lyceum seguir o sistema."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isSelected = settings.theme === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
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
            Tema ativo agora: {effectiveTheme === "light" ? "claro" : "escuro"}.
          </p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Cor de destaque"
        description="A cor escolhida aparece em foco, botões primários, estados ativos e pequenos realces."
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
                    {color.label}
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
            Prévia
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button className="inline-flex h-9 items-center rounded bg-green-600 px-4 text-sm font-medium text-white transition hover:bg-green-500">
              Botão principal
            </button>
            <span className="rounded border border-green-500/30 bg-green-500/10 px-3 py-1.5 text-sm text-green-400">
              Estado ativo
            </span>
            <span className="text-sm text-green-500">Link destacado</span>
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
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUploading, setIsUploading] = useState(false);

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
      toast.error("Use uma imagem JPG, PNG ou WEBP");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("A imagem deve ter no máximo 5MB");
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
      toast.error("Erro ao fazer upload da imagem");
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
      toast.success("Conta atualizada com sucesso!");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => updateAccountPassword(newPassword),
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso!");
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
      toast.error("As senhas não coincidem");
      return;
    }

    const passwordError = validatePasswordStrength(newPassword);
    if (passwordError) {
      toast.error(passwordError);
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
        title="Informações pessoais"
        description="Dados usados para identificar sua conta dentro do Lyceum."
      >
        <form onSubmit={handleNameSubmit} className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-[104px_1fr]">
            <div className="relative h-24 w-24">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-900">
                {avatarPreview || avatarUrl ? (
                  <img
                    src={avatarPreview || avatarUrl}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={38} className="text-zinc-500" />
                )}
              </div>
              <button
                type="button"
                title="Alterar avatar"
                aria-label="Alterar avatar"
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
                <FieldLabel>Nome</FieldLabel>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClasses()}
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  value={user?.email || ""}
                  disabled
                  className={inputClasses(true)}
                />
              </div>
              <div>
                <FieldLabel>Nickname</FieldLabel>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-600">
                    @
                  </span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className={`${inputClasses()} pl-7`}
                    placeholder="seu_nickname"
                  />
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  Usado para encontrar amigos no Lyceum.
                </p>
              </div>
            </div>
          </div>

          <PrimaryButton type="submit" disabled={accountMutation.isPending}>
            <Save size={16} />
            {accountMutation.isPending ? "Salvando..." : "Salvar conta"}
          </PrimaryButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Segurança"
        description="Atualize sua senha de acesso."
      >
        <form onSubmit={handlePasswordSubmit} className="max-w-xl space-y-4">
          <div>
            <FieldLabel>Nova senha</FieldLabel>
            <input
              type="password"
              minLength={MIN_PASSWORD_LENGTH}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClasses()}
            />
          </div>
          <div>
            <FieldLabel>Confirmar senha</FieldLabel>
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
            {passwordMutation.isPending ? "Alterando..." : "Alterar senha"}
          </PrimaryButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Sessão"
        description="Encerre o acesso deste usuario ao aplicativo."
      >
        <DangerButton onClick={handleSignOut}>
          Sair da conta
        </DangerButton>
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

  return (
    <div>
      <SettingsSection
        title="Interface"
        description="Configurações da barra de título e sidebar."
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-100">
                Auto-ocultar
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Oculta automaticamente a barra de título e sidebar.
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
                  Modo sobrepor
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  A barra de título aparece sobre o conteúdo ao invés de empurrá-lo.
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
        title="Dashboard"
        description="Configurações do painel principal."
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Copiar leituras de ontem
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              O botão "Leituras diárias" copiará as leituras do dia anterior ao invés de hoje.
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

export function LibrarySettingsPanel() {
  const {
    settings,
    setShowSubfolderBooks,
    setUnifiedLibraryView,
  } = useAppSettings();

  return (
    <div>
      <SettingsSection
        title="Pastas"
        description="Controle como os livros aparecem quando você navega pela árvore da biblioteca."
      >
        <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-zinc-100">
              Mostrar livros de subpastas
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Quando ativado, uma pasta também lista os livros que estão dentro das subpastas dela.
            </p>
          </div>
          <button
            type="button"
            aria-label="Alternar livros de subpastas"
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
              Exibição unificada
            </p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Pastas comuns aparecem no grid da biblioteca. Colecoes e livros mesclados aparecem como cards de livro e seguem os mesmos filtros.
            </p>
          </div>
          <button
            type="button"
            aria-label="Alternar exibição unificada"
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
      toast.error("Atualizacoes indisponiveis neste ambiente");
      return;
    }

    try {
      setIsRequesting(true);
      const nextState = await window.api.updatesCheck();
      setUpdateState(nextState);
      if (nextState.status === "not-available") {
        toast.success("Voce ja esta na versao mais recente");
      } else if (nextState.status === "disabled") {
        toast("Atualizacoes automaticas funcionam apenas no app instalado");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao buscar atualizacoes");
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
      toast.error(error instanceof Error ? error.message : "Falha ao baixar atualizacao");
    } finally {
      setIsRequesting(false);
    }
  };

  const installNow = async () => {
    if (!window.api?.updatesInstallNow) return;

    const result = await window.api.updatesInstallNow();
    if (!result.success) {
      toast.error(result.error || "Nenhuma atualizacao pronta para instalar");
    }
  };

  const progress = updateState.progress?.percent ?? 0;
  const checkedAt = formatUpdateDate(updateState.checkedAt);
  const downloadedAt = formatUpdateDate(updateState.downloadedAt);
  const releaseDate = formatUpdateDate(updateState.updateInfo?.releaseDate);
  const isChecking = updateState.status === "checking" || isRequesting;
  const isDownloading = updateState.status === "downloading";
  const canDownload = updateState.status === "available" && !isRequesting;

  return (
    <div>
      <SettingsSection
        title="Atualizacoes"
        description="Busque novas versoes, acompanhe o download e instale sem fechar e abrir o Lyceum manualmente."
      >
        <div className="space-y-5">
          <div className="rounded border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-zinc-100">
                  Lyceum {updateState.currentVersion}
                </p>
                <p className="mt-1 text-sm leading-6 text-zinc-500">
                  {getUpdateStatusLabel(updateState)}
                </p>
                {updateState.updateInfo?.version && updateState.updateInfo.version !== updateState.currentVersion ? (
                  <p className="mt-2 text-sm text-green-400">
                    Versao disponivel: {updateState.updateInfo.version}
                    {releaseDate ? ` - publicada em ${releaseDate}` : ""}
                  </p>
                ) : null}
                {checkedAt ? (
                  <p className="mt-2 text-xs text-zinc-600">Ultima verificacao: {checkedAt}</p>
                ) : null}
                {downloadedAt ? (
                  <p className="mt-1 text-xs text-zinc-600">Download concluido: {downloadedAt}</p>
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
                  Buscar
                </button>
                {canDownload ? (
                  <button
                    type="button"
                    onClick={downloadUpdate}
                    className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-500"
                  >
                    <Download size={14} />
                    Baixar
                  </button>
                ) : null}
                {updateState.canInstall ? (
                  <button
                    type="button"
                    onClick={installNow}
                    className="inline-flex h-9 items-center gap-2 rounded bg-green-600 px-3 text-sm font-medium text-white transition hover:bg-green-500"
                  >
                    <Download size={14} />
                    Instalar agora
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
                Se voce nao instalar agora, a atualizacao sera aplicada automaticamente quando o aplicativo for fechado.
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
              <p className="text-sm font-semibold text-zinc-100">Notas da versao</p>
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

  return (
    <div>
      <SettingsSection
        title="Dicionários offline"
        description="Baixe dicionários locais para consultas e tradução sem depender da rede."
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-zinc-400">
            <BookOpen size={16} className="text-zinc-500" />
            <span>{dictionaries.length} dicionário(s) disponível(is)</span>
          </div>
          <button
            onClick={() => refreshIndex()}
            className="inline-flex h-8 items-center gap-2 rounded border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            title="Atualizar lista"
          >
            <RefreshCw size={14} />
            Atualizar
          </button>
        </div>

        {!isDictsLoaded ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : dictionaries.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            Nenhum dicionário disponível.
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
                      {dict.sourceLang.toUpperCase()} para{" "}
                      {dict.targetLang.toUpperCase()}
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
                          {selectedDict === dict.id ? "Ativo" : "Ativar"}
                        </button>
                        <button
                          onClick={() => deleteDictionary(dict.id)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
                          title="Remover"
                          aria-label="Remover dicionário"
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
                        Baixar
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

export function ZoomSettingsPanel() {
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
        title="Zoom"
        description="Ajuste o nível de zoom da interface."
      >
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <button
              onClick={handleZoomOut}
              className="inline-flex h-9 w-9 items-center justify-center rounded border border-zinc-700 bg-zinc-950/40 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
              title="Diminuir zoom"
              aria-label="Diminuir zoom"
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
              title="Aumentar zoom"
              aria-label="Aumentar zoom"
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
              Resetar
            </button>
          </div>

          <p className="text-xs text-zinc-500">
            Atalhos: Ctrl + / Ctrl - para ajustar o zoom. Ctrl 0 para resetar.
          </p>
        </div>
      </SettingsSection>
    </div>
  );
}

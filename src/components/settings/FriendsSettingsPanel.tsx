import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Copy,
  Search,
  Send,
  User,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  findUserByNickname,
  getFriendProfile,
  getFriendRequests,
  getFriends,
  getUserProfile,
  removeFriend,
  sendFriendRequest,
  updateProfileNickname,
} from "../../api/database";
import type {
  FriendRequest,
  FriendSearchResult,
  FriendSummary,
} from "../../api/database";
import Skeleton from "../Skeleton";

const ICON_SIZE = 16;

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

function SmallButton({
  children,
  disabled,
  onClick,
  type = "button",
  variant = "default",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "default" | "primary" | "danger";
}) {
  const variantClass = {
    default:
      "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100",
    primary:
      "border-green-600 bg-green-600 text-black hover:border-green-500 hover:bg-green-500",
    danger:
      "border-red-500/30 bg-red-500/10 text-red-300 hover:border-red-500/50 hover:bg-red-500/20",
  }[variant];

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-2 rounded border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${variantClass}`}
    >
      {children}
    </button>
  );
}

function Avatar({
  src,
  name,
  sizeClass = "h-10 w-10",
}: {
  src?: string | null;
  name?: string | null;
  sizeClass?: string;
}) {
  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-zinc-700 bg-zinc-800 ${sizeClass}`}
    >
      {src ? (
        <img src={src} alt={name || "Avatar"} className="h-full w-full object-cover" />
      ) : (
        <User size={ICON_SIZE} className="text-zinc-500" />
      )}
    </div>
  );
}

function displayName(name?: string | null, nickname?: string | null) {
  return name || nickname || "Usuario";
}

function invalidateFriendQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
  queryClient.invalidateQueries({ queryKey: ["friends"] });
  queryClient.invalidateQueries({ queryKey: ["friendProfile"] });
  queryClient.invalidateQueries({ queryKey: ["ranking"] });
  queryClient.invalidateQueries({ queryKey: ["selectedUsersReadings"] });
  queryClient.invalidateQueries({ queryKey: ["weeklyStreakSelectedReadings"] });
}

function RequestRow({
  request,
  onAccept,
  onDecline,
  onCancel,
  busy,
}: {
  request: FriendRequest;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  busy: boolean;
}) {
  const isIncoming = request.direction === "incoming";

  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={request.other_avatar_url} name={request.other_name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {displayName(request.other_name, request.other_nickname)}
          </p>
          <p className="truncate text-xs text-zinc-500">
            @{request.other_nickname}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {isIncoming ? (
          <>
            <SmallButton
              onClick={() => onAccept(request.id)}
              disabled={busy}
              variant="primary"
            >
              <Check size={14} />
              Aceitar
            </SmallButton>
            <SmallButton
              onClick={() => onDecline(request.id)}
              disabled={busy}
              variant="danger"
            >
              <X size={14} />
              Recusar
            </SmallButton>
          </>
        ) : (
          <SmallButton
            onClick={() => onCancel(request.id)}
            disabled={busy}
            variant="danger"
          >
            Cancelar
          </SmallButton>
        )}
      </div>
    </div>
  );
}

function FriendProfileCard({
  friendId,
  onClose,
}: {
  friendId: string | null;
  onClose: () => void;
}) {
  const { data: profile, isLoading } = useQuery({
    queryKey: ["friendProfile", friendId],
    queryFn: () => getFriendProfile(friendId!),
    enabled: Boolean(friendId),
  });

  if (!friendId) return null;

  if (isLoading) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950/40 p-4">
        <Skeleton className="mb-4 h-16 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!profile) return null;

  const stats = [
    ["Total", profile.total_pages],
    ["Hoje", profile.today_pages],
    ["Semana", profile.this_week_pages],
    ["Mes", profile.month_pages],
  ];

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar
            src={profile.avatar_url}
            name={profile.name}
            sizeClass="h-14 w-14"
          />
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-zinc-100">
              {displayName(profile.name, profile.nickname)}
            </p>
            <p className="truncate text-sm text-zinc-500">@{profile.nickname}</p>
            {profile.friends_since && (
              <p className="mt-1 text-xs text-zinc-600">
                Amigo desde{" "}
                {new Date(profile.friends_since).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Fechar perfil"
          aria-label="Fechar perfil"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded border border-zinc-800 bg-zinc-900/60 p-3">
            <p className="text-xs text-zinc-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-zinc-100">
              {Number(value)}p
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FriendRow({
  friend,
  onOpenProfile,
  onRemove,
  busy,
}: {
  friend: FriendSummary;
  onOpenProfile: (friendId: string) => void;
  onRemove: (friendId: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => onOpenProfile(friend.user_id)}
        className="flex min-w-0 flex-1 items-center gap-3 rounded text-left transition hover:text-zinc-100"
      >
        <Avatar src={friend.avatar_url} name={friend.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {displayName(friend.name, friend.nickname)}
          </p>
          <p className="truncate text-xs text-zinc-500">@{friend.nickname}</p>
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-4">
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-zinc-200">
            {Number(friend.total_pages)}p
          </p>
          <p className="text-xs text-zinc-500">total</p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(friend.user_id)}
          disabled={busy}
          className="inline-flex h-8 w-8 items-center justify-center rounded text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-50"
          title="Remover amigo"
          aria-label="Remover amigo"
        >
          <UserMinus size={16} />
        </button>
      </div>
    </div>
  );
}

function SearchResultCard({
  result,
  onSend,
  onAccept,
  onOpenProfile,
  busy,
}: {
  result: FriendSearchResult;
  onSend: (nickname: string) => void;
  onAccept: (requestId: string) => void;
  onOpenProfile: (friendId: string) => void;
  busy: boolean;
}) {
  const action = (() => {
    switch (result.friend_status) {
      case "self":
        return <span className="text-sm text-zinc-500">Este e voce</span>;
      case "friends":
        return (
          <SmallButton onClick={() => onOpenProfile(result.user_id)}>
            Ver perfil
          </SmallButton>
        );
      case "request_sent":
        return <span className="text-sm text-zinc-500">Solicitacao enviada</span>;
      case "request_received":
        return result.request_id ? (
          <SmallButton
            onClick={() => onAccept(result.request_id!)}
            disabled={busy}
            variant="primary"
          >
            <Check size={14} />
            Aceitar
          </SmallButton>
        ) : null;
      default:
        return (
          <SmallButton
            onClick={() => onSend(result.nickname)}
            disabled={busy}
            variant="primary"
          >
            <UserPlus size={14} />
            Enviar
          </SmallButton>
        );
    }
  })();

  return (
    <div className="mt-3 flex items-center justify-between gap-3 rounded border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={result.avatar_url} name={result.name} />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-zinc-100">
            {displayName(result.name, result.nickname)}
          </p>
          <p className="truncate text-xs text-zinc-500">@{result.nickname}</p>
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

export default function FriendsSettingsPanel({
  focusedFriendId,
}: {
  focusedFriendId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [nicknameDraft, setNicknameDraft] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState<FriendSearchResult | null>(
    null,
  );
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(
    focusedFriendId || null,
  );

  const { data: profile, isLoading: isProfileLoading } = useQuery({
    queryKey: ["userProfile"],
    queryFn: getUserProfile,
  });

  const { data: friends = [], isLoading: isFriendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getFriends,
  });

  const { data: requests = [], isLoading: isRequestsLoading } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
  });

  useEffect(() => {
    if (profile?.nickname) {
      setNicknameDraft(profile.nickname);
    }
  }, [profile?.nickname]);

  useEffect(() => {
    if (focusedFriendId) {
      setSelectedFriendId(focusedFriendId);
    }
  }, [focusedFriendId]);

  const incomingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.direction === "incoming" && request.status === "pending",
      ),
    [requests],
  );

  const outgoingRequests = useMemo(
    () =>
      requests.filter(
        (request) =>
          request.direction === "outgoing" && request.status === "pending",
      ),
    [requests],
  );

  const nicknameMutation = useMutation({
    mutationFn: updateProfileNickname,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userProfile"] });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      queryClient.invalidateQueries({ queryKey: ["ranking"] });
      toast.success("Nickname atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const searchMutation = useMutation({
    mutationFn: findUserByNickname,
    onSuccess: (result) => {
      setSearchResult(result);
      if (!result) {
        toast.error("Nenhum usuario encontrado com esse nickname");
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendMutation = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: (status) => {
      invalidateFriendQueries(queryClient);
      toast.success(
        status === "friends"
          ? "Voces ja sao amigos"
          : "Solicitacao enviada",
      );
      if (searchTerm.trim()) {
        searchMutation.mutate(searchTerm.trim().replace(/^@/, ""));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const acceptMutation = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      invalidateFriendQueries(queryClient);
      toast.success("Solicitacao aceita");
      if (searchTerm.trim()) {
        searchMutation.mutate(searchTerm.trim().replace(/^@/, ""));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const declineMutation = useMutation({
    mutationFn: declineFriendRequest,
    onSuccess: () => {
      invalidateFriendQueries(queryClient);
      toast.success("Solicitacao recusada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: cancelFriendRequest,
    onSuccess: () => {
      invalidateFriendQueries(queryClient);
      toast.success("Solicitacao cancelada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeFriend,
    onSuccess: () => {
      setSelectedFriendId(null);
      invalidateFriendQueries(queryClient);
      toast.success("Amigo removido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isActionBusy =
    sendMutation.isPending ||
    acceptMutation.isPending ||
    declineMutation.isPending ||
    cancelMutation.isPending ||
    removeMutation.isPending;

  const handleCopyNickname = async () => {
    if (!profile?.nickname) return;

    try {
      await navigator.clipboard.writeText(profile.nickname);
      toast.success("Nickname copiado");
    } catch {
      toast.error("Nao foi possivel copiar o nickname");
    }
  };

  const handleNicknameSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextNickname = nicknameDraft.trim().replace(/^@/, "").toLowerCase();

    if (!nextNickname) {
      toast.error("Informe um nickname");
      return;
    }

    nicknameMutation.mutate(nextNickname);
  };

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nickname = searchTerm.trim().replace(/^@/, "").toLowerCase();

    if (nickname.length < 3) {
      toast.error("Digite pelo menos 3 caracteres");
      return;
    }

    searchMutation.mutate(nickname);
  };

  const isLoading =
    isProfileLoading || isFriendsLoading || isRequestsLoading;

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div>
      <SettingsSection
        title="Seu nickname"
        description="Compartilhe este nickname com quem voce quer adicionar como amigo."
      >
        <form onSubmit={handleNicknameSubmit} className="space-y-3">
          <div>
            <FieldLabel>Nickname</FieldLabel>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-2 text-sm text-zinc-600">
                  @
                </span>
                <input
                  type="text"
                  value={nicknameDraft}
                  onChange={(event) => setNicknameDraft(event.target.value)}
                  className={`${inputClasses()} pl-7`}
                  placeholder="seu_nickname"
                />
              </div>
              <SmallButton onClick={handleCopyNickname} disabled={!profile?.nickname}>
                <Copy size={14} />
                Copiar
              </SmallButton>
            </div>
          </div>
          <SmallButton
            type="submit"
            variant="primary"
            disabled={
              nicknameMutation.isPending ||
              nicknameDraft.trim().replace(/^@/, "").toLowerCase() ===
                profile?.nickname
            }
          >
            Salvar nickname
          </SmallButton>
        </form>
      </SettingsSection>

      <SettingsSection
        title="Adicionar amigo"
        description="Pesquise pelo nickname exato que a outra pessoa compartilhou com voce."
      >
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-2.5 text-zinc-600"
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className={`${inputClasses()} pl-9`}
              placeholder="nickname_do_amigo"
            />
          </div>
          <SmallButton
            type="submit"
            variant="primary"
            disabled={searchMutation.isPending}
          >
            <Send size={14} />
            Buscar
          </SmallButton>
        </form>

        {searchResult && (
          <SearchResultCard
            result={searchResult}
            onSend={(nickname) => sendMutation.mutate(nickname)}
            onAccept={(requestId) => acceptMutation.mutate(requestId)}
            onOpenProfile={(friendId) => setSelectedFriendId(friendId)}
            busy={isActionBusy}
          />
        )}
      </SettingsSection>

      <SettingsSection
        title={`Solicitacoes recebidas (${incomingRequests.length})`}
      >
        {incomingRequests.length === 0 ? (
          <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center text-sm text-zinc-500">
            Nenhuma solicitacao recebida.
          </div>
        ) : (
          <div className="overflow-hidden rounded border border-zinc-800">
            {incomingRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                onAccept={(requestId) => acceptMutation.mutate(requestId)}
                onDecline={(requestId) => declineMutation.mutate(requestId)}
                onCancel={(requestId) => cancelMutation.mutate(requestId)}
                busy={isActionBusy}
              />
            ))}
          </div>
        )}
      </SettingsSection>

      {outgoingRequests.length > 0 && (
        <SettingsSection title="Solicitacoes enviadas">
          <div className="overflow-hidden rounded border border-zinc-800">
            {outgoingRequests.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                onAccept={(requestId) => acceptMutation.mutate(requestId)}
                onDecline={(requestId) => declineMutation.mutate(requestId)}
                onCancel={(requestId) => cancelMutation.mutate(requestId)}
                busy={isActionBusy}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      <SettingsSection
        title={`Amigos (${friends.length})`}
        description="Somente amigos aceitos aparecem no leaderboard e nas comparacoes."
      >
        <div className="space-y-4">
          <FriendProfileCard
            friendId={selectedFriendId}
            onClose={() => setSelectedFriendId(null)}
          />

          {friends.length === 0 ? (
            <div className="rounded border border-dashed border-zinc-800 bg-zinc-950/40 px-4 py-8 text-center">
              <Users className="mx-auto mb-3 text-zinc-600" size={24} />
              <p className="text-sm font-medium text-zinc-300">
                Nenhum amigo adicionado ainda
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Compartilhe seu nickname ou pesquise o nickname de outra pessoa.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded border border-zinc-800">
              {friends.map((friend) => (
                <FriendRow
                  key={friend.user_id}
                  friend={friend}
                  onOpenProfile={(friendId) => setSelectedFriendId(friendId)}
                  onRemove={(friendId) => removeMutation.mutate(friendId)}
                  busy={isActionBusy}
                />
              ))}
            </div>
          )}
        </div>
      </SettingsSection>
    </div>
  );
}

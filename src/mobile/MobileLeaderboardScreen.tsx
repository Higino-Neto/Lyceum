import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  Crown,
  Filter,
  Loader2,
  Search,
  Send,
  Trash2,
  Trophy,
  User,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import MobileAccountGate from "./MobileAccountGate";
import {
  acceptMobileFriendRequest,
  cancelMobileFriendRequest,
  declineMobileFriendRequest,
  findMobileUserByNickname,
  getMobileCategories,
  getMobileFriendRequests,
  getMobileFriends,
  getMobileRanking,
  getMobileReadingQueryEnabled,
  getMobileUserProfile,
  removeMobileFriend,
  sendMobileFriendRequest,
  updateMobileProfileNickname,
  type MobileFriendRequest,
  type MobileFriendSummary,
  type MobileRankingUser,
} from "./readingApi";

interface MobileLeaderboardScreenProps {
  sessionEmail: string | null;
  onOpenProfile: () => void;
}

type RankingPeriod = "today" | "this_week" | "this_month" | "all_time";

const PERIODS: Array<{ key: RankingPeriod; label: string }> = [
  { key: "today", label: "Hoje" },
  { key: "this_week", label: "Semana" },
  { key: "this_month", label: "Mes" },
  { key: "all_time", label: "Total" },
];

function invalidateSocialQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["mobile-friends"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-friend-requests"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-ranking"] });
  queryClient.invalidateQueries({ queryKey: ["mobile-user-profile"] });
}

function Avatar({
  src,
  name,
  current,
}: {
  src?: string | null;
  name?: string | null;
  current?: boolean;
}) {
  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border ${
        current ? "border-emerald-500 bg-emerald-500/10" : "border-zinc-800 bg-zinc-950"
      }`}
    >
      {src ? (
        <img className="h-full w-full object-cover" src={src} alt={name || "Avatar"} />
      ) : (
        <User size={17} className={current ? "text-emerald-400" : "text-zinc-500"} />
      )}
    </div>
  );
}

function displayName(name?: string | null, nickname?: string | null) {
  return name || nickname || "Usuario";
}

function pageFieldForPeriod(period: RankingPeriod, categoryId?: string | null) {
  if (categoryId) return "total_pages" as const;
  if (period === "today") return "today_pages" as const;
  if (period === "this_week") return "this_week_pages" as const;
  if (period === "this_month") return "month_pages" as const;
  return "total_pages" as const;
}

function RequestRow({
  request,
  busy,
  onAccept,
  onDecline,
  onCancel,
}: {
  request: MobileFriendRequest;
  busy: boolean;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  const incoming = request.direction === "incoming";
  return (
    <article className="flex items-center gap-3 border-b border-zinc-800 p-3 last:border-b-0">
      <Avatar src={request.other_avatar_url} name={request.other_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">
          {displayName(request.other_name, request.other_nickname)}
        </p>
        <p className="truncate text-xs text-zinc-500">@{request.other_nickname}</p>
      </div>
      {incoming ? (
        <div className="flex gap-1">
          <button
            className="grid h-9 w-9 place-items-center rounded bg-emerald-600 text-white disabled:opacity-60"
            disabled={busy}
            onClick={() => onAccept(request.id)}
            type="button"
            aria-label="Aceitar convite"
          >
            <Check size={16} />
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded bg-red-950/60 text-red-300 disabled:opacity-60"
            disabled={busy}
            onClick={() => onDecline(request.id)}
            type="button"
            aria-label="Recusar convite"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          className="h-9 rounded border border-zinc-800 bg-zinc-950 px-3 text-xs font-semibold text-zinc-300 disabled:opacity-60"
          disabled={busy}
          onClick={() => onCancel(request.id)}
          type="button"
        >
          Cancelar
        </button>
      )}
    </article>
  );
}

function FriendRow({
  friend,
  busy,
  onRemove,
}: {
  friend: MobileFriendSummary;
  busy: boolean;
  onRemove: (id: string) => void;
}) {
  return (
    <article className="flex items-center gap-3 border-b border-zinc-800 p-3 last:border-b-0">
      <Avatar src={friend.avatar_url} name={friend.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{displayName(friend.name, friend.nickname)}</p>
        <p className="truncate text-xs text-zinc-500">@{friend.nickname} · {friend.total_pages}p</p>
      </div>
      <button
        className="grid h-9 w-9 place-items-center rounded bg-zinc-950 text-red-300 disabled:opacity-60"
        disabled={busy}
        onClick={() => onRemove(friend.user_id)}
        type="button"
        aria-label="Remover amigo"
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}

function MobileFriendsPanel({ enabled }: { enabled: boolean }) {
  const queryClient = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [friendNickname, setFriendNickname] = useState("");
  const [searchResult, setSearchResult] = useState<string | null>(null);

  const { data: profile } = useQuery({
    queryKey: ["mobile-user-profile"],
    queryFn: getMobileUserProfile,
    enabled,
  });

  const { data: requests = [], isLoading: requestsLoading } = useQuery({
    queryKey: ["mobile-friend-requests"],
    queryFn: getMobileFriendRequests,
    enabled,
  });

  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ["mobile-friends"],
    queryFn: getMobileFriends,
    enabled,
  });

  useEffect(() => {
    setNickname(profile?.nickname || "");
  }, [profile?.nickname]);

  const nicknameMutation = useMutation({
    mutationFn: () => updateMobileProfileNickname(nickname.trim()),
    onSuccess: () => {
      invalidateSocialQueries(queryClient);
      toast.success("Nickname salvo");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchMutation = useMutation({
    mutationFn: () => findMobileUserByNickname(friendNickname.trim()),
    onSuccess: (result) => {
      if (!result) {
        setSearchResult("Usuario nao encontrado.");
        return;
      }
      setSearchResult(`@${result.nickname} · ${result.friend_status}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const sendMutation = useMutation({
    mutationFn: () => sendMobileFriendRequest(friendNickname.trim()),
    onSuccess: () => {
      invalidateSocialQueries(queryClient);
      setSearchResult("Convite enviado.");
      toast.success("Convite enviado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const requestMutation = useMutation({
    mutationFn: async ({ action, id }: { action: "accept" | "decline" | "cancel"; id: string }) => {
      if (action === "accept") return acceptMobileFriendRequest(id);
      if (action === "decline") return declineMobileFriendRequest(id);
      return cancelMobileFriendRequest(id);
    },
    onSuccess: () => {
      invalidateSocialQueries(queryClient);
      toast.success("Convite atualizado");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeMobileFriend,
    onSuccess: () => {
      invalidateSocialQueries(queryClient);
      toast.success("Amigo removido");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = nicknameMutation.isPending || sendMutation.isPending || requestMutation.isPending || removeMutation.isPending;
  const incomingCount = requests.filter((request) => request.direction === "incoming" && request.status === "pending").length;

  return (
    <div className="space-y-4">
      <section className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center gap-2">
          <Users size={17} className="text-zinc-500" />
          <h2 className="text-sm font-semibold text-zinc-100">Amigos</h2>
          {incomingCount > 0 && (
            <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {incomingCount}
            </span>
          )}
        </div>

        <form
          className="mt-4 space-y-2"
          onSubmit={(event) => {
            event.preventDefault();
            nicknameMutation.mutate();
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Seu nickname</label>
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              className="h-11 min-w-0 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder="ex: leitor_2026"
            />
            <button
              className="h-11 rounded bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
              disabled={busy || !nickname.trim()}
              type="submit"
            >
              Salvar
            </button>
          </div>
        </form>

        <form
          className="mt-5 space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            sendMutation.mutate();
          }}
        >
          <label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Adicionar por nickname</label>
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <input
              className="h-11 min-w-0 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
              value={friendNickname}
              onChange={(event) => {
                setFriendNickname(event.target.value);
                setSearchResult(null);
              }}
              placeholder="@amigo"
            />
            <button
              className="grid h-11 w-11 place-items-center rounded border border-zinc-800 bg-zinc-950 text-zinc-300 disabled:opacity-60"
              disabled={busy || !friendNickname.trim()}
              onClick={() => searchMutation.mutate()}
              type="button"
              aria-label="Buscar usuario"
            >
              {searchMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
            </button>
            <button
              className="grid h-11 w-11 place-items-center rounded bg-emerald-600 text-white disabled:opacity-60"
              disabled={busy || !friendNickname.trim()}
              type="submit"
              aria-label="Enviar convite"
            >
              {sendMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            </button>
          </div>
          {searchResult && <p className="text-xs text-zinc-500">{searchResult}</p>}
        </form>
      </section>

      <section className="overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Convites</h2>
          {requestsLoading && <Loader2 className="animate-spin text-zinc-500" size={16} />}
        </div>
        {requests.length > 0 ? (
          requests.map((request) => (
            <RequestRow
              key={request.id}
              request={request}
              busy={busy}
              onAccept={(id) => requestMutation.mutate({ action: "accept", id })}
              onDecline={(id) => requestMutation.mutate({ action: "decline", id })}
              onCancel={(id) => requestMutation.mutate({ action: "cancel", id })}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-zinc-500">Nenhum convite pendente.</p>
        )}
      </section>

      <section className="overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <h2 className="text-sm font-semibold text-zinc-100">Sua rede</h2>
          {friendsLoading && <Loader2 className="animate-spin text-zinc-500" size={16} />}
        </div>
        {friends.length > 0 ? (
          friends.map((friend) => (
            <FriendRow
              key={friend.user_id}
              friend={friend}
              busy={busy}
              onRemove={(id) => {
                if (window.confirm(`Remover @${friend.nickname}?`)) {
                  removeMutation.mutate(id);
                }
              }}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-zinc-500">Adicione amigos para comparar leituras no ranking.</p>
        )}
      </section>
    </div>
  );
}

function RankingRow({
  user,
  index,
  pages,
}: {
  user: MobileRankingUser;
  index: number;
  pages: number;
}) {
  const current = Boolean(user.is_current_user);
  return (
    <article
      className={`flex items-center gap-3 border-b border-zinc-800 p-4 last:border-b-0 ${
        current ? "bg-emerald-500/5" : ""
      }`}
    >
      <div className="w-8 text-center">
        {index === 0 ? (
          <Crown size={18} className="mx-auto text-emerald-400" />
        ) : (
          <span className="text-sm font-semibold text-zinc-500">#{index + 1}</span>
        )}
      </div>
      <Avatar src={user.avatar_url} name={user.username} current={current} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-zinc-100">
          {current ? "Voce" : user.username}
        </p>
        <p className="mt-1 truncate text-xs text-zinc-500">
          {user.nickname ? `@${user.nickname}` : current ? "Sua conta" : "Amigo"}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-semibold text-zinc-100">{pages}p</p>
        <p className="text-[11px] uppercase tracking-wide text-zinc-600">paginas</p>
      </div>
    </article>
  );
}

export default function MobileLeaderboardScreen({
  sessionEmail,
  onOpenProfile,
}: MobileLeaderboardScreenProps) {
  const enabled = getMobileReadingQueryEnabled(sessionEmail);
  const [period, setPeriod] = useState<RankingPeriod>("this_week");
  const [categoryId, setCategoryId] = useState<string>("");
  const [showFriends, setShowFriends] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: getMobileCategories,
    enabled,
  });

  const { data: ranking = [], isLoading } = useQuery({
    queryKey: ["mobile-ranking", categoryId || "all", period],
    queryFn: () => getMobileRanking(categoryId || null, period),
    enabled,
  });

  const pageField = pageFieldForPeriod(period, categoryId);
  const sortedRanking = useMemo(
    () => [...ranking].sort((left, right) => Number(right[pageField] || 0) - Number(left[pageField] || 0)),
    [pageField, ranking],
  );

  if (!enabled) {
    return (
      <MobileAccountGate
        title="Ranking com seus amigos"
        body="Entre com sua conta para carregar amigos do desktop ou adicionar novos amigos pelo mobile."
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <section className="space-y-4 p-4">
      <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">Leaderboard</p>
            <h1 className="mt-1 text-xl font-semibold text-zinc-50">Voce e seus amigos</h1>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              O mobile usa a mesma rede da conta desktop.
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded bg-emerald-500/10 text-emerald-400">
            <Trophy size={22} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-1 rounded bg-zinc-950 p-1">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              className={`h-9 rounded text-xs font-semibold ${
                period === item.key ? "bg-emerald-600 text-white" : "text-zinc-500"
              }`}
              onClick={() => setPeriod(item.key)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-[auto_1fr] items-center gap-2">
          <Filter size={16} className="text-zinc-500" />
          <select
            className="h-10 min-w-0 rounded border border-zinc-800 bg-zinc-950 px-3 text-sm"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">Todas as categorias</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>

        <button
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded border border-zinc-800 bg-zinc-950 text-sm font-semibold text-zinc-200"
          onClick={() => setShowFriends((current) => !current)}
          type="button"
        >
          <UserPlus size={17} />
          {showFriends ? "Ocultar amigos" : "Gerenciar amigos"}
        </button>
      </div>

      {showFriends && <MobileFriendsPanel enabled={enabled} />}

      <section className="overflow-hidden rounded border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 p-4">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-zinc-500" />
            <h2 className="text-sm font-semibold text-zinc-100">Ranking</h2>
          </div>
          {isLoading && <Loader2 className="animate-spin text-zinc-500" size={16} />}
        </div>

        {sortedRanking.length > 0 ? (
          sortedRanking.map((user, index) => (
            <RankingRow
              key={user.user_id}
              user={user}
              index={index}
              pages={Number(user[pageField] || 0)}
            />
          ))
        ) : (
          <div className="p-8 text-center">
            <Users size={24} className="mx-auto text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-300">Ranking vazio</p>
            <p className="mt-1 text-xs leading-5 text-zinc-500">
              Registre leituras e adicione amigos para competir.
            </p>
          </div>
        )}
      </section>
    </section>
  );
}

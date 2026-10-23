import { useMobileConfirm } from "./MobileConfirmDialog";
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
import MobileQueryError from "./MobileQueryError";
import { MobileCard, MobileFieldFrame, MobileInput, MobileSelect } from "./MobileControls";
import { formatNumber, translate, useTranslation, type TranslationKey } from "../i18n";
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

const PERIODS: Array<{ key: RankingPeriod; labelKey: TranslationKey }> = [
  { key: "today", labelKey: "mobile:leaderboard.periods.today" },
  { key: "this_week", labelKey: "mobile:leaderboard.periods.thisWeek" },
  { key: "this_month", labelKey: "mobile:leaderboard.periods.thisMonth" },
  { key: "all_time", labelKey: "mobile:leaderboard.periods.allTime" },
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
  const { t } = useTranslation();

  return (
    <div
      className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border ${
        current ? "border-primary bg-primary-muted" : "border-border bg-background"
      }`}
    >
      {src ? (
        <img className="h-full w-full object-cover" src={src} alt={name || t("mobile:leaderboard.avatarAlt")} />
      ) : (
        <User size={17} className={current ? "text-primary" : "text-foreground-subtle"} />
      )}
    </div>
  );
}

function displayName(name?: string | null, nickname?: string | null) {
  return name || nickname || translate("mobile:leaderboard.unknownUser");
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
  const { t } = useTranslation();
  const incoming = request.direction === "incoming";
  return (
    <article className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
      <Avatar src={request.other_avatar_url} name={request.other_name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {displayName(request.other_name, request.other_nickname)}
        </p>
        <p className="truncate text-xs text-foreground-subtle">@{request.other_nickname}</p>
      </div>
      {incoming ? (
        <div className="flex gap-1">
          <button
            className="grid h-11 w-11 place-items-center rounded-xl bg-primary text-primary-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => onAccept(request.id)}
            type="button"
            aria-label={t("mobile:leaderboard.acceptInvite")}
          >
            <Check size={16} />
          </button>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl bg-destructive text-destructive-foreground disabled:opacity-60"
            disabled={busy}
            onClick={() => onDecline(request.id)}
            type="button"
            aria-label={t("mobile:leaderboard.declineInvite")}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          className="h-11 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground disabled:opacity-60"
          disabled={busy}
          onClick={() => onCancel(request.id)}
          type="button"
        >
          {t("mobile:leaderboard.cancel")}
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
  const { t, i18n } = useTranslation();

  return (
    <article className="flex items-center gap-3 border-b border-border p-3 last:border-b-0">
      <Avatar src={friend.avatar_url} name={friend.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{displayName(friend.name, friend.nickname)}</p>
        <p className="truncate text-xs text-foreground-subtle">
        @{friend.nickname} · {formatNumber(friend.total_pages, i18n.language)}p
      </p>
      </div>
      <button
        className="grid h-11 w-11 place-items-center rounded-xl bg-background text-destructive disabled:opacity-60"
        disabled={busy}
        onClick={() => onRemove(friend.user_id)}
        type="button"
        aria-label={t("mobile:leaderboard.removeFriend")}
      >
        <Trash2 size={15} />
      </button>
    </article>
  );
}

function MobileFriendsPanel({ enabled }: { enabled: boolean }) {
  const { t } = useTranslation();
  const confirm = useMobileConfirm();
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
      toast.success(t("mobile:leaderboard.nicknameSaved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const searchMutation = useMutation({
    mutationFn: () => findMobileUserByNickname(friendNickname.trim()),
    onSuccess: (result) => {
      if (!result) {
        setSearchResult(t("mobile:leaderboard.userNotFound"));
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
      setSearchResult(t("mobile:leaderboard.inviteSentBody"));
      toast.success(t("mobile:leaderboard.inviteSent"));
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
      toast.success(t("mobile:leaderboard.inviteUpdated"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMutation = useMutation({
    mutationFn: removeMobileFriend,
    onSuccess: () => {
      invalidateSocialQueries(queryClient);
      toast.success(t("mobile:leaderboard.friendRemoved"));
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const busy = nicknameMutation.isPending || sendMutation.isPending || requestMutation.isPending || removeMutation.isPending;
  const incomingCount = requests.filter((request) => request.direction === "incoming" && request.status === "pending").length;

  return (
    <div className="space-y-4">
      <MobileCard className="p-5">
        <div className="flex items-center gap-2">
          <Users size={17} className="text-foreground-subtle" />
          <h2 className="text-sm font-semibold text-foreground">{t("mobile:leaderboard.friendsTitle")}</h2>
          {incomingCount > 0 && (
            <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
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
          <MobileFieldFrame
          label={t("mobile:leaderboard.yourNickname")}
          htmlFor="mobile-nickname"
          hint={t("mobile:leaderboard.yourNicknameHint")}
        >
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <MobileInput
              id="mobile-nickname"
              icon={User}
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              placeholder={t("mobile:leaderboard.nicknamePlaceholder")}
            />
            <button
              className="h-11 rounded bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              disabled={busy || !nickname.trim()}
              type="submit"
            >
              {t("mobile:leaderboard.save")}
            </button>
          </div>
          </MobileFieldFrame>
        </form>

        <form
          className="mt-5 space-y-2"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            sendMutation.mutate();
          }}
        >
          <MobileFieldFrame
            label={t("mobile:leaderboard.addByNickname")}
            htmlFor="mobile-friend-nickname"
          >
          <div className="grid grid-cols-[1fr_auto_auto] gap-2">
            <MobileInput
              id="mobile-friend-nickname"
              icon={Search}
              value={friendNickname}
              onChange={(event) => {
                setFriendNickname(event.target.value);
                setSearchResult(null);
              }}
              placeholder={t("mobile:leaderboard.friendNicknamePlaceholder")}
            />
            <button
              className="grid h-11 w-11 place-items-center rounded border border-border bg-background text-foreground disabled:opacity-60"
              disabled={busy || !friendNickname.trim()}
              onClick={() => searchMutation.mutate()}
              type="button"
              aria-label={t("mobile:leaderboard.searchUser")}
            >
              {searchMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Search size={17} />}
            </button>
            <button
              className="grid h-11 w-11 place-items-center rounded bg-primary text-primary-foreground disabled:opacity-60"
              disabled={busy || !friendNickname.trim()}
              type="submit"
              aria-label={t("mobile:leaderboard.sendInvite")}
            >
              {sendMutation.isPending ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}
            </button>
          </div>
          </MobileFieldFrame>
          {searchResult && <p className="text-xs text-foreground-subtle">{searchResult}</p>}
        </form>
      </MobileCard>

      <MobileCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("mobile:leaderboard.invites")}</h2>
          {requestsLoading && <Loader2 className="animate-spin text-foreground-subtle" size={16} />}
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
          <p className="p-4 text-sm text-foreground-subtle">{t("mobile:leaderboard.noPendingInvites")}</p>
        )}
      </MobileCard>

      <MobileCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-sm font-semibold text-foreground">{t("mobile:leaderboard.yourNetwork")}</h2>
          {friendsLoading && <Loader2 className="animate-spin text-foreground-subtle" size={16} />}
        </div>
        {friends.length > 0 ? (
          friends.map((friend) => (
            <FriendRow
              key={friend.user_id}
              friend={friend}
              busy={busy}
              onRemove={async (id) => {
                if (
                  await confirm(
                    t("mobile:leaderboard.removeFriendConfirm", { nickname: friend.nickname }),
                  )
                ) {
                  removeMutation.mutate(id);
                }
              }}
            />
          ))
        ) : (
          <p className="p-4 text-sm text-foreground-subtle">{t("mobile:leaderboard.noFriends")}</p>
        )}
      </MobileCard>
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
  const { t, i18n } = useTranslation();
  const current = Boolean(user.is_current_user);
  return (
    <article
      className={`flex items-center gap-3 border-b border-border p-4 last:border-b-0 ${
        current ? "bg-primary-muted" : ""
      }`}
    >
      <div className="w-8 text-center">
        {index === 0 ? (
          <Crown size={18} className="mx-auto text-primary" />
        ) : (
          <span className="text-sm font-semibold text-foreground-subtle">#{index + 1}</span>
        )}
      </div>
      <Avatar src={user.avatar_url} name={user.username} current={current} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">
          {current ? t("mobile:leaderboard.you") : user.username}
        </p>
        <p className="mt-1 truncate text-xs text-foreground-subtle">
          {user.nickname
            ? `@${user.nickname}`
            : current
              ? t("mobile:leaderboard.yourAccount")
              : t("mobile:leaderboard.friend")}
        </p>
      </div>
      <div className="text-right">
        <p className="text-base font-semibold text-foreground">
          {formatNumber(pages, i18n.language)}p
        </p>
        <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">
          {t("mobile:leaderboard.pages")}
        </p>
      </div>
    </article>
  );
}

export default function MobileLeaderboardScreen({
  sessionEmail,
  onOpenProfile,
}: MobileLeaderboardScreenProps) {
  const { t } = useTranslation();
  const enabled = getMobileReadingQueryEnabled(sessionEmail);
  const [period, setPeriod] = useState<RankingPeriod>("this_week");
  const [categoryId, setCategoryId] = useState<string>("");
  const [showFriends, setShowFriends] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ["mobile-categories"],
    queryFn: getMobileCategories,
    enabled,
  });

  const { data: ranking = [], isLoading, error: rankingError, refetch: refetchRanking } = useQuery({
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
        title={t("mobile:leaderboard.gateTitle")}
        body={t("mobile:leaderboard.gateBody")}
        onOpenProfile={onOpenProfile}
      />
    );
  }

  return (
    <section className="space-y-4 p-4">
      <MobileQueryError error={rankingError} onRetry={() => { void refetchRanking(); }} />
      <MobileCard className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">
              {t("mobile:leaderboard.kicker")}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-foreground">
              {t("mobile:leaderboard.headline")}
            </h1>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              {t("mobile:leaderboard.body")}
            </p>
          </div>
          <div className="grid h-11 w-11 place-items-center rounded bg-primary-muted text-primary">
            <Trophy size={22} />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-1 rounded-2xl border border-border/[0.05] bg-background/80 p-1.5">
          {PERIODS.map((item) => (
            <button
              key={item.key}
              className={`min-h-10 rounded-xl text-xs font-semibold transition active:scale-95 ${
                period === item.key ? "bg-primary-muted text-primary shadow-sm" : "text-foreground-subtle"
              }`}
              onClick={() => setPeriod(item.key)}
              type="button"
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <MobileFieldFrame label={t("mobile:leaderboard.category")} htmlFor="ranking-category">
          <MobileSelect
            id="ranking-category"
            icon={Filter}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t("mobile:leaderboard.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </MobileSelect>
          </MobileFieldFrame>
        </div>

        <button
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded border border-border bg-background text-sm font-semibold text-foreground"
          onClick={() => setShowFriends((current) => !current)}
          type="button"
        >
          <UserPlus size={17} />
          {showFriends
            ? t("mobile:leaderboard.hideFriends")
            : t("mobile:leaderboard.manageFriends")}
        </button>
      </MobileCard>

      {showFriends && <div className="fixed inset-0 z-50 bg-backdrop" onClick={() => setShowFriends(false)}><div className="ml-auto h-full w-full max-w-[480px] overflow-y-auto bg-background p-4 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(20px,env(safe-area-inset-top))]" role="dialog" aria-modal="true" aria-label={t("mobile:leaderboard.manageFriends")} onClick={(event) => event.stopPropagation()}><div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-semibold text-foreground">{t("mobile:leaderboard.manageFriends")}</h2><button className="grid h-11 w-11 place-items-center rounded-full bg-surface" onClick={() => setShowFriends(false)} aria-label={t("mobile:leaderboard.closeFriends")} type="button"><X size={19} /></button></div><MobileFriendsPanel enabled={enabled} /></div></div>}

      <MobileCard className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2">
            <Trophy size={16} className="text-foreground-subtle" />
            <h2 className="text-sm font-semibold text-foreground">{t("mobile:leaderboard.ranking")}</h2>
          </div>
          {isLoading && <Loader2 className="animate-spin text-foreground-subtle" size={16} />}
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
            <Users size={24} className="mx-auto text-foreground-subtle" />
            <p className="mt-3 text-sm font-medium text-foreground">
              {t("mobile:leaderboard.rankingEmpty")}
            </p>
            <p className="mt-1 text-xs leading-5 text-foreground-subtle">
              {t("mobile:leaderboard.rankingEmptyBody")}
            </p>
          </div>
        )}
      </MobileCard>
    </section>
  );
}

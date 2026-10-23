import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useRanking from "../../../../hooks/useRanking";
import { getCategories } from "../../../../api/database";
import { RankingTableSkeleton } from "../../../../components/skeletons";
import { Crown, Filter, Minus, Plus, User, UserPlus } from "lucide-react";
import { useSelectedUsers } from "../../../../contexts/SelectedUsersContext";
import SelectPeriodButton from "./SelectPeriodButton";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";
import { useTranslation } from "../../../../i18n";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

type Period = "today" | "this_week" | "this_month" | "all_time";

export default function RankingTable() {
  const { t } = useTranslation();
  const { data: ranking, isLoading } = useRanking();
  const { selectedUsers, currentUserId, toggleUser, isUserSelected } =
    useSelectedUsers();

  const [period, setPeriod] = useLocalStorage<Period>(
    "ranking_type",
    "all_time",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useLocalStorage<
    string | null
  >("ranking_category", null);
  const [chipsOpen, setChipsOpen] = useLocalStorage(
    "ranking_chips_open",
    false,
  );

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: categoryRanking, isLoading: isCategoryLoading } = useRanking(
    selectedCategoryId,
    period,
  );

  const isCategoryActive = Boolean(selectedCategoryId);
  const displayRanking = isCategoryActive ? categoryRanking : ranking;
  const isRankingLoading = isCategoryActive ? isCategoryLoading : isLoading;

  const pageField = useMemo(() => {
    switch (period) {
      case "today":
        return "today_pages" as const;
      case "this_week":
        return "this_week_pages" as const;
      case "this_month":
        return "month_pages" as const;
      default:
        return "total_pages" as const;
    }
  }, [period]);

  const sortedRanking = displayRanking
    ? [...displayRanking].sort(
        (a, b) => Number(b[pageField] || 0) - Number(a[pageField] || 0),
      )
    : [];

  const canSelectMore = selectedUsers.length < 2;

  const openFriendsSettings = (friendId?: string) => {
    window.dispatchEvent(
      new CustomEvent("lyceum:open-settings", {
        detail: { tab: "friends", friendId },
      }),
    );
  };

  const getSelectionState = (userId: string) => {
    if (userId === currentUserId) return "current";
    if (isUserSelected(userId)) return "selected";
    return "none";
  };

  if (isRankingLoading) {
    return <RankingTableSkeleton />;
  }

  const friendRows = sortedRanking.filter(
    (user) => !user.is_current_user && user.user_id !== currentUserId,
  );
  const shouldShowAddFriendPrompt = friendRows.length === 0;

  return (
    <div className="overflow-hidden rounded-sm">
      <div className="flex border-b border-border">
        <SelectPeriodButton onChange={setPeriod} />
        <button
          onClick={() => setChipsOpen((value: boolean) => !value)}
          className={`flex cursor-pointer items-center justify-center px-2 py-3 text-xs transition ${
            isCategoryActive
              ? "bg-primary-muted text-primary"
              : "text-foreground-subtle hover:bg-surface-muted/40 hover:text-foreground"
          }`}
          title={t("dashboard:ranking.filterByCategory")}
        >
          <Filter size={13} strokeWidth={1.5} />
        </button>
      </div>

      {chipsOpen && (
        <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-surface-muted px-2 py-1.5">
          <button
            onClick={() => setSelectedCategoryId(null)}
            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-sm px-2 py-1 text-[11px] font-medium transition ${
              !selectedCategoryId
                ? "bg-primary-muted text-primary"
                : "text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {t("dashboard:ranking.allCategories")}
          </button>
          {(categories || []).map((category) => (
            <button
              key={category.id}
              onClick={() =>
                setSelectedCategoryId(
                  selectedCategoryId === category.id ? null : category.id,
                )
              }
              className={`shrink-0 cursor-pointer whitespace-nowrap rounded-sm px-2 py-1 text-[11px] font-medium transition ${
                selectedCategoryId === category.id
                  ? "bg-primary-muted text-primary"
                  : "text-foreground-subtle hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      )}

      <table className="w-full text-base">
        <thead className="bg-surface-muted text-xs uppercase tracking-wider text-foreground-muted" />
        <tbody>
          {shouldShowAddFriendPrompt ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-8 text-center text-sm text-foreground-subtle"
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface">
                    <UserPlus size={18} className="text-foreground-subtle" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {t("dashboard:ranking.addFriendsTitle")}
                    </p>
                    <p className="mt-1 text-xs text-foreground-subtle">
                      {t("dashboard:ranking.addFriendsDescription")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openFriendsSettings()}
                    className="inline-flex h-8 items-center gap-2 rounded bg-primary px-3 text-xs font-medium text-primary-foreground transition hover:bg-primary-hover"
                  >
                    <UserPlus size={14} />
                    {t("dashboard:ranking.addFriend")}
                  </button>
                </div>
              </td>
            </tr>
          ) : (
            sortedRanking.map((user, index) => {
              const isCurrentUser =
                user.is_current_user || user.user_id === currentUserId;
              const selectionState = getSelectionState(user.user_id);

              return (
                <tr
                  key={user.user_id}
                  className="border-t border-border transition hover:bg-surface-muted/40"
                >
                  <td className="w-10 px-4 py-4 font-medium">
                    {index === 0 ? (
                      <Crown
                        className="text-foreground"
                        size={ICON_SIZE}
                        strokeWidth={STROKE_WIDTH}
                      />
                    ) : (
                      <span className="text-sm text-foreground-subtle">
                        #{index + 1}
                      </span>
                    )}
                  </td>
                  <td className="py-4">
                    <button
                      type="button"
                      onClick={() =>
                        !isCurrentUser && openFriendsSettings(user.user_id)
                      }
                      disabled={isCurrentUser}
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-surface-muted disabled:cursor-default"
                      title={
                        isCurrentUser
                          ? t("dashboard:ranking.you")
                          : t("dashboard:ranking.viewProfile")
                      }
                    >
                      {user.avatar_url ? (
                        <img
                          src={user.avatar_url}
                          alt={t("dashboard:ranking.avatar")}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <User size={ICON_SIZE} className="text-foreground-subtle" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-4 text-foreground">
                    <button
                      type="button"
                      onClick={() =>
                        !isCurrentUser && openFriendsSettings(user.user_id)
                      }
                      disabled={isCurrentUser}
                      className="flex min-w-0 items-center gap-2 text-left disabled:cursor-default"
                      title={
                        isCurrentUser
                          ? t("dashboard:ranking.you")
                          : t("dashboard:ranking.viewProfile")
                      }
                    >
                      <span className="truncate">{user.username}</span>
                    </button>
                  </td>
                  <td className="px-4 py-4 text-right font-semibold text-foreground">
                    {Number(user[pageField] || 0)}p
                  </td>
                  <td className="w-10 px-2 py-4">
                    {currentUserId && !isCurrentUser && (
                      <button
                        onClick={() => toggleUser(user)}
                        className={`rounded p-1.5 transition ${
                          selectionState === "selected"
                            ? "text-foreground-subtle hover:bg-surface-muted"
                            : canSelectMore
                              ? "cursor-pointer hover:bg-surface-muted hover:text-foreground"
                              : "cursor-not-allowed"
                        }`}
                        disabled={!canSelectMore && !isUserSelected(user.user_id)}
                        title={
                          selectionState === "selected"
                            ? t("dashboard:ranking.removeFromCharts")
                            : canSelectMore
                              ? t("dashboard:ranking.addToCharts")
                              : t("dashboard:ranking.selectionLimit")
                        }
                      >
                        {selectionState === "selected" ? (
                          <Minus size={16} />
                        ) : (
                          <Plus size={16} />
                        )}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

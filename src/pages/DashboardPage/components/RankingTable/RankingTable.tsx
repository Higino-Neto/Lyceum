import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useRanking from "../../../../hooks/useRanking";
import { getCategories } from "../../../../api/database";
import { RankingTableSkeleton } from "../../../../components/skeletons";
import { User, Crown, Plus, Minus, Filter } from "lucide-react";
import { useSelectedUsers } from "../../../../contexts/SelectedUsersContext";
import SelectPeriodButton from "./SelectPeriodButton";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

type Period = "today" | "this_week" | "this_month" | "all_time";

export default function RankingTable() {
  const { data: ranking, isLoading } = useRanking();
  const { selectedUsers, currentUserId, toggleUser, isUserSelected } =
    useSelectedUsers();

  const [period, setPeriod] = useLocalStorage<Period>("ranking_type", "all_time");
  const [selectedCategoryId, setSelectedCategoryId] = useLocalStorage<string | null>("ranking_category", null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: getCategories,
    staleTime: 1000 * 60 * 5,
  });

  const { data: categoryRanking, isLoading: isCategoryLoading } = useRanking(
    selectedCategoryId,
    period,
  );

const isCategoryActive = !!selectedCategoryId;

const displayRanking = isCategoryActive ? categoryRanking : ranking;
const isRankingLoading = isCategoryActive ? isCategoryLoading : isLoading;

const pageField = useMemo(() => {
  if (isCategoryActive) return "total_pages" as const;
  switch (period) {
    case "today": return "today_pages" as const;
    case "this_week": return "this_week_pages" as const;
    case "this_month": return "month_pages" as const;
    default: return "total_pages" as const;
  }
}, [isCategoryActive, period]);

const sortedRanking = displayRanking
    ? [...displayRanking].sort((a, b) => b[pageField] - a[pageField])
    : [];

  const canSelectMore = selectedUsers.length < 2;

  const getSelectionState = (userId: string) => {
    if (userId === currentUserId) return "current";
    if (isUserSelected(userId)) return "selected";
    return "none";
  };

  if (isRankingLoading) {
    return <RankingTableSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-sm">
      <div className="flex border-b border-zinc-800">
        <SelectPeriodButton onChange={setPeriod} />
      </div>

      <div className="flex items-center gap-1.5 border-b border-zinc-800 bg-zinc-850 px-2 py-1.5 overflow-x-auto">
        <Filter size={12} className="shrink-0 text-zinc-600" strokeWidth={1.5} />
        <button
          onClick={() => setSelectedCategoryId(null)}
          className={`shrink-0 whitespace-nowrap rounded-sm px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
            !selectedCategoryId
              ? "bg-green-600/20 text-green-400"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          Todas
        </button>
        {(categories || []).map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategoryId(isCategoryActive && selectedCategoryId === cat.id ? null : cat.id)}
            className={`shrink-0 whitespace-nowrap rounded-sm px-2 py-1 text-[11px] font-medium transition cursor-pointer ${
              selectedCategoryId === cat.id
                ? "bg-green-600/20 text-green-400"
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <table className="w-full text-base">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {sortedRanking.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500">
                {isCategoryActive
                  ? "Nenhuma leitura nesta categoria"
                  : "Nenhum dado disponível"}
              </td>
            </tr>
          ) : (
            sortedRanking.map((user, index) => (
              <tr
                key={user.user_id}
                className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
              >
                <td className="px-4 py-4 font-medium w-10">
                  {index === 0 ? (
                    <Crown
                      className="text-zinc-300"
                      size={ICON_SIZE}
                      strokeWidth={STROKE_WIDTH}
                    />
                  ) : (
                    <span className="text-zinc-500 text-sm">#{index + 1}</span>
                  )}
                </td>
                <td className="py-4">
                  <div className="w-8 h-8 rounded-full border-2 border-zinc-900 bg-zinc-800 overflow-hidden flex items-center justify-center">
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt="Avatar"
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User size={ICON_SIZE} className="text-zinc-500" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 text-zinc-200">
                  <div className="flex items-center gap-2">{user.username}</div>
                </td>
                <td className="px-4 py-4 text-right font-semibold text-zinc-300">
                  {user[pageField]}p
                </td>
                <td className="px-2 py-4 w-10">
                  {currentUserId && user.user_id !== currentUserId && (
                    <button
                      onClick={() => toggleUser(user)}
                      className={`p-1.5 rounded transition cursor-pointer ${
                        getSelectionState(user.user_id) === "selected"
                          ? "hover:bg-zinc-800 text-zinc-500"
                          : canSelectMore
                            ? " hover:text-zinc-300 hover:bg-zinc-800"
                            : " cursor-not-allowed"
                      }`}
                      disabled={!canSelectMore && !isUserSelected(user.user_id)}
                      title={
                        getSelectionState(user.user_id) === "selected"
                          ? "Remover dos gráficos"
                          : canSelectMore
                            ? "Adicionar aos gráficos"
                            : "Limite atingido (máx. 2)"
                      }
                    >
                      {getSelectionState(user.user_id) === "selected" ? (
                        <Minus size={16} />
                      ) : (
                        <Plus size={16} />
                      )}
                    </button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

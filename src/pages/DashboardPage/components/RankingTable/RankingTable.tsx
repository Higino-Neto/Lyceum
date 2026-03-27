import { useMemo } from "react";
import useRanking from "../../../../hooks/useRanking";
import { RankingTableSkeleton } from "../../../../components/skeletons";
import { User, Crown, Trophy, Plus, Minus } from "lucide-react";
import { useSelectedUsers } from "../../../../contexts/SelectedUsersContext";
import SelectPeriodButton from "./SelectPeriodButton";
import { useLocalStorage } from "../../../../hooks/useLocalStorage";

const ICON_SIZE = 16;
const STROKE_WIDTH = 1.5;

type Period = "today" | "this_week" | "this_month" | "all_time";

interface PeriodOption {
  key: Period;
  icon: React.ReactNode;
  field: "today_pages" | "this_week_pages" | "month_pages" | "total_pages";
}

export default function RankingTable() {
  const { data: ranking, isLoading } = useRanking();
  const { selectedUsers, currentUserId, toggleUser, isUserSelected } =
    useSelectedUsers();

  const [period, setPeriod] = useLocalStorage<Period>("ranking_type", "all_time");

  const currentPeriod = useMemo((): PeriodOption => {
    switch (period) {
      case "today":
        return { key: "today", icon: <span className="text-sm font-medium">Hoje</span>, field: "today_pages" };
      case "this_week":
        return { key: "this_week", icon: <span className="text-sm font-medium">Semanal</span>, field: "this_week_pages" };
      case "this_month":
        return { key: "this_month", icon: <span className="text-sm font-medium">Mensal</span>, field: "month_pages" };
      default:
        return { key: "all_time", icon: <Trophy size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />, field: "total_pages" };
    }
  }, [period]);

  const sortedRanking = ranking
    ? [...ranking].sort((a, b) => {
        const field = currentPeriod.field;
        return (b[field] as number) - (a[field] as number);
      })
    : [];

  const canSelectMore = selectedUsers.length < 2;

  const getSelectionState = (userId: string) => {
    if (userId === currentUserId) return "current";
    if (isUserSelected(userId)) return "selected";
    return "none";
  };

  if (isLoading) {
    return <RankingTableSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-sm">
      <div className="flex border-b border-zinc-800">
        {/* {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`cursor-pointer flex-1 py-3 flex items-center justify-center gap-1  font-medium transition ${
              period === p.key
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
            aria-label={p.key === 'today' ? 'Hoje' : p.key === 'this_week' ? 'Esta semana' : p.key === 'this_month' ? 'Este mês' : 'Geral'}
          >
            {p.icon}
          </button>
        ))} */}
        <SelectPeriodButton onChange={setPeriod} />
      </div>
      <table className="w-full text-base">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {sortedRanking.map((user, index) => (
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
                <div className="w-10 h-10 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
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
                {user[currentPeriod.field] as number}p
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

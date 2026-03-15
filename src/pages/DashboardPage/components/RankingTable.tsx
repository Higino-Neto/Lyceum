import { useState } from "react";
import useRanking from "../../../hooks/useRanking";
import { RankingTableSkeleton } from "../../../components/skeletons";
import { User, Crown, Trophy } from "lucide-react";

type Period = "today" | "this_week" | "this_month" | "all_time";

interface PeriodOption {
  key: Period;
  icon: React.ReactNode;
  field: "today_pages" | "this_week_pages" | "month_pages" | "total_pages";
}

const ICON_SIZE = 20;
const STROKE_WIDTH = 1.5;

const PERIODS: PeriodOption[] = [
  { key: "today", icon: <span className="text-xs font-medium">Hoje</span>, field: "today_pages" },
  { key: "this_week", icon: <span className="text-xs font-medium">Semanal</span>, field: "this_week_pages" },
  { key: "this_month", icon: <span className="text-xs font-medium">Mensal</span>, field: "month_pages" },
  { key: "all_time", icon: <Trophy size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />, field: "total_pages" },
];

export default function RankingTable() {
  const { data: ranking, isLoading } = useRanking();
  const [period, setPeriod] = useState<Period>("all_time");

  const currentPeriod = PERIODS.find((p) => p.key === period);

  const sortedRanking = ranking
    ? [...ranking].sort((a, b) => {
        const field = currentPeriod!.field;
        return (b[field] as number) - (a[field] as number);
      })
    : [];

  if (isLoading) {
    return <RankingTableSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-md">
      <div className="flex border-b border-zinc-800">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-3 flex items-center justify-center gap-1 text-sm font-medium transition ${
              period === p.key
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
            aria-label={p.key === 'today' ? 'Hoje' : p.key === 'this_week' ? 'Esta semana' : p.key === 'this_month' ? 'Este mês' : 'Geral'}
          >
            {p.icon}
          </button>
        ))}
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
                  <Crown className="text-zinc-300" size={ICON_SIZE} strokeWidth={STROKE_WIDTH} />
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
              <td className="px-4 py-4 text-zinc-200">{user.username}</td>
              <td className="px-4 py-4 text-right font-semibold text-zinc-300">
                {user[currentPeriod!.field] as number}p 
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

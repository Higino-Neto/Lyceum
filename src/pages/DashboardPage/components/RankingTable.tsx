import { useState } from "react";
import useRanking from "../../../hooks/useRanking";
import { RankingTableSkeleton } from "../../../components/skeletons";
import { User, Crown } from "lucide-react";

type Period = "today" | "this_week" | "this_month" | "all_time";

interface PeriodOption {
  key: Period;
  label: string;
  field: "today_pages" | "this_week_pages" | "month_pages" | "total_pages";
}

const PERIODS: PeriodOption[] = [
  { key: "today", label: "Hoje", field: "today_pages" },
  { key: "this_week", label: "Semana", field: "this_week_pages" },
  { key: "this_month", label: "Mês", field: "month_pages" },
  { key: "all_time", label: "Geral", field: "total_pages" },
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
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <div className="flex border-b border-zinc-800">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-3 text-xs font-medium transition ${
              period === p.key
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {sortedRanking.map((user, index) => (
            <tr
              key={user.user_id}
              className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
            >
              <td className="px-6 py-4 font-medium">
                {index === 0 ? (
                  <Crown className="text-white" size={18} />
                ) : (
                  `#${index + 1}`
                )}
              </td>
              <td>
                <div className="w-8 h-8 rounded-full bg-zinc-800 overflow-hidden flex items-center justify-center">
                  {user.avatar_url ? (
                    <img
                      src={user.avatar_url}
                      alt="Avatar"
                      loading="lazy"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User size={40} className="text-zinc-500" />
                  )}
                </div>
              </td>
              <td className="px-6 py-4">{user.username}</td>
              <td className="px-6 py-4 text-right font-semibold">
                {user[currentPeriod!.field] as number}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

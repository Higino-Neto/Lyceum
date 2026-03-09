import useRanking from "../../../hooks/useRanking";
import { RankingTableSkeleton } from "../../../components/skeletons";
import { User } from "lucide-react";

export default function RankingTable() {
  const { data: ranking, isLoading } = useRanking();

  if (isLoading) {
    return <RankingTableSkeleton />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {ranking?.map((user, index) => (
            <tr
              key={user.user_id}
              className="border-t border-zinc-800 hover:bg-zinc-800/40 transition"
            >
              <td className="px-6 py-4 font-medium">
                #{index + 1}
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
                {user.total_pages}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

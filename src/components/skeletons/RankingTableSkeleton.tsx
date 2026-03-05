import Skeleton from "../Skeleton";

export function RankingTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="px-6 py-4">
                <Skeleton className="h-4 w-8" />
              </td>
              <td className="px-6 py-4">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="px-6 py-4 text-right">
                <Skeleton className="h-4 w-16 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import Skeleton from "../Skeleton";

export function RankingTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-md md:row-span-2">
      <div className="flex border-b border-zinc-800">
        {["D", "S", "M", "G"].map((d) => (
          <div key={d} className="flex-1 py-2.5 flex items-center justify-center text-xs font-medium text-zinc-400">
            {d}
          </div>
        ))}
      </div>
      <table className="w-full text-sm">
        <thead className="bg-zinc-800 text-zinc-400 uppercase text-xs tracking-wider" />
        <tbody>
          {Array.from({ length: 4 }).map((_, i) => (
            <tr key={i} className="border-t border-zinc-800">
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-6" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-8 w-8 rounded-full" />
              </td>
              <td className="px-4 py-3">
                <Skeleton className="h-4 w-24" />
              </td>
              <td className="px-4 py-3 text-right">
                <Skeleton className="h-4 w-12 ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

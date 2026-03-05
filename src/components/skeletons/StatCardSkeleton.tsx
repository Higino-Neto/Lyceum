import Skeleton from "../Skeleton";

export function StatCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-sm p-6 shadow-xl">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-8 w-32 mt-2" />
      <Skeleton className="h-4 w-20 mt-2" />
      <Skeleton className="h-3 w-16 mt-2" />
    </div>
  );
}

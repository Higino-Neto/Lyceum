import Skeleton from "../Skeleton";

export function StatCardSkeleton() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-md p-4">
      <Skeleton className="h-4 w-16 mb-3" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-20 mt-2" />
    </div>
  );
}

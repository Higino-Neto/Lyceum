import Skeleton from "../Skeleton";

export function StatCardSkeleton() {
  return (
    <div className="bg-surface border border-border rounded-sm p-4">
      <Skeleton className="h-4 w-16 mb-3" />
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-3 w-20 mt-2" />
    </div>
  );
}

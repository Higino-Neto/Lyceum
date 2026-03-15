import Skeleton from "../Skeleton";

export function HeatmapSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center p-6 bg-zinc-950 text-white rounded-md">
      <Skeleton className="h-8 w-20 mb-4" />
      <div className="w-full space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
    </div>
  );
}

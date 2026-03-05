import Skeleton from "../Skeleton";

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-t border-zinc-800">
          <td className="px-6 py-4">
            <Skeleton className="h-4 w-32" />
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-4 w-16" />
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-4 w-12" />
          </td>
          <td className="px-6 py-4">
            <Skeleton className="h-4 w-24" />
          </td>
        </tr>
      ))}
    </tbody>
  );
}

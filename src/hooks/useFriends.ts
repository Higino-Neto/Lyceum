import { useQuery } from "@tanstack/react-query";
import { getFriendRequests } from "../api/database";

export function usePendingFriendRequestCount(enabled = true) {
  return useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled,
    staleTime: 1000 * 30,
    select: (requests) =>
      requests.filter(
        (request) =>
          request.direction === "incoming" && request.status === "pending",
      ).length,
  });
}

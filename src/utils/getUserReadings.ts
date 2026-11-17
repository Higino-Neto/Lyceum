import { getFriendReadings, type ReadingEntry } from "../api/database";

/** Readings of one user (the signed-in user or a friend), via `get_friend_readings`. */
export default async function getUserReadings(userId: string): Promise<ReadingEntry[]> {
  return getFriendReadings(userId);
}

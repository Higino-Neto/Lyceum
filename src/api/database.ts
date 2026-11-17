import { getSupabaseConfigError, isSupabaseConfigured, supabase } from "../lib/supabase";
import { translate } from "../i18n";
import { isMobilePlatform } from "../platform";

/**
 * Account API shared by the desktop and mobile apps. Every Supabase RPC the
 * clients use lives here; screens must not call `supabase.rpc` directly.
 */

/** Account-backed queries can run: Supabase is configured and someone is signed in. */
export function isAccountQueryEnabled(sessionEmail: string | null | undefined) {
  return isSupabaseConfigured && getSupabaseConfigError() === null && Boolean(sessionEmail);
}

/**
 * Desktop routes are already behind `ProtectedRoute`. The mobile app keeps
 * account screens reachable while signed out, so it fails fast with a message
 * the user can act on instead of an opaque RLS/RPC error.
 */
async function ensureSignedIn() {
  if (!isMobilePlatform()) return;
  if (getSupabaseConfigError()) throw new Error(translate("mobile:errors.supabaseNotConfigured"));
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.user) throw new Error(translate("mobile:errors.signInToSync"));
  return data.session.user;
}

async function currentUserId(): Promise<string> {
  const signedIn = await ensureSignedIn();
  if (signedIn) return signedIn.id;
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) throw new Error(translate("mobile:errors.signInToSync"));
  return data.user.id;
}

export interface ReadingEntry {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  created_at?: string;
  category_id: string | null;
  book_id?: string | null;
}

export interface Category {
  id: string;
  name: string;
  points_per_page?: number;
}

export interface ReadingStats {
  readingStats: {
    user_id: string;
    total_pages: number;
    total_minutes: number;
    month_pages: number;
    month_minutes: number;
  };
  userStreak: number;
}

export interface RankingUser {
  user_id: string;
  username: string;
  nickname?: string | null;
  avatar_url: string;
  total_pages: number;
  today_pages: number;
  this_week_pages: number;
  month_pages: number;
  is_current_user?: boolean;
}

export type RankingPeriod = string;

export interface Profile {
  id: string;
  name: string;
  nickname?: string | null;
  avatar_url: string;
  created_at: Date;
}

export interface FriendSummary {
  user_id: string;
  name: string | null;
  nickname: string;
  avatar_url: string | null;
  friends_since: string;
  total_pages: number;
  today_pages: number;
  this_week_pages: number;
  month_pages: number;
}

export interface FriendRequest {
  id: string;
  requester_id: string;
  addressee_id: string;
  other_user_id: string;
  other_name: string | null;
  other_nickname: string;
  other_avatar_url: string | null;
  status: "pending" | "accepted" | "declined" | "canceled";
  direction: "incoming" | "outgoing";
  created_at: string;
  responded_at: string | null;
}

export interface FriendSearchResult {
  user_id: string;
  name: string | null;
  nickname: string;
  avatar_url: string | null;
  friend_status:
    | "none"
    | "self"
    | "friends"
    | "request_sent"
    | "request_received";
  request_id: string | null;
}

export interface FriendProfile {
  user_id: string;
  name: string | null;
  nickname: string;
  avatar_url: string | null;
  friends_since: string | null;
  total_pages: number;
  today_pages: number;
  this_week_pages: number;
  month_pages: number;
}

export async function getUserReadings(): Promise<ReadingEntry[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_user_readings");
  if (error) throw error;
  return data || [];
}

export async function createReadingEntry(
  sourceName: string,
  pages: number,
  readingDate: string,
  readingTime: number,
  categoryId: string,
  bookId?: string | null
): Promise<string> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("create_reading_entry", {
    p_source_name: sourceName,
    p_pages: pages,
    p_reading_date: readingDate,
    p_reading_time: readingTime,
    p_category_id: categoryId,
    p_book_id: bookId || null,
  });
  if (error) throw error;
  return String(data);
}

export async function deleteReadingEntry(readingId: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("delete_reading_entry", {
    p_reading_id: readingId,
  });
  if (error) throw error;
}

export async function updateReadingEntry(
  readingId: string,
  sourceName: string,
  pages: number,
  readingDate: string,
  readingTime: number,
  categoryId?: string | null
): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("update_reading_entry", {
    p_reading_id: readingId,
    p_source_name: sourceName,
    p_pages: pages,
    p_reading_date: readingDate,
    p_reading_time: readingTime,
    p_category_id: categoryId || null,
  });
  if (error) throw error;
}

export interface BookRecordInput {
  title: string;
  author?: string | null;
  thumbnailUrl?: string | null;
  totalPages?: number | string | null;
  isbn?: string | null;
  categoryId?: string | null;
}

/** Finds or creates the account-level book record that readings point to. */
export async function getOrCreateBookRecord(input: BookRecordInput): Promise<string> {
  await ensureSignedIn();
  return getOrCreateBook(
    input.title,
    input.author || undefined,
    input.thumbnailUrl || undefined,
    input.totalPages ? Number(input.totalPages) : undefined,
    input.isbn || undefined,
    undefined,
    undefined,
    undefined,
    input.categoryId || undefined,
  );
}

export async function getOrCreateBook(
  title: string,
  author?: string,
  thumbnailUrl?: string,
  totalPages?: number,
  isbn?: string,
  _description?: string,
  _publishedDate?: string,
  _externalId?: string,
  categoryId?: string
): Promise<string> {
  try {
    const { data, error } = await supabase.rpc("get_or_create_book", {
      p_title: title,
      p_author: author || null,
      p_thumbnail_url: thumbnailUrl || null,
      p_total_pages: totalPages ? Number(totalPages) : null,
      p_isbn: isbn || null,
      p_category_id: categoryId || null,
    });

    if (error) {
      console.error("Supabase RPC error for book:", title, error);
      throw new Error(error.message || translate("common:errors.bookCreateFailed"));
    }

    if (!data) {
      throw new Error(translate("common:errors.bookCreateEmptyResponse", { title }));
    }

    return String(data);
  } catch (err) {
    console.error("getOrCreateBook exception:", err);
    if (err instanceof Error) {
      throw new Error(translate("common:errors.bookCreateFailedFor", { title, reason: err.message }));
    }
    throw new Error(
      translate("common:errors.bookCreateFailedFor", {
        title,
        reason: translate("common:errors.unknownError"),
      }),
    );
  }
}

export async function getCategories(): Promise<Category[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_categories");
  if (error) throw error;
  return data || [];
}

export async function getUserProfile(): Promise<Profile | null> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_user_profile");
  if (error) throw error;
  return data?.[0] || null;
}

export async function updateUserProfile(
  name?: string,
  avatarUrl?: string
): Promise<void> {
  const { error } = await supabase.rpc("update_user_profile", {
    p_name: name || null,
    p_avatar_url: avatarUrl || null,
  });
  if (error) throw error;
}

export async function updateProfileNickname(nickname: string): Promise<string> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("update_profile_nickname", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return String(data);
}

export async function createUserProfile(
  userId: string,
  email: string
): Promise<void> {
  const { error } = await supabase.rpc("create_user_profile", {
    p_user_id: userId,
    p_email: email,
  });
  if (error) throw error;
}

export async function findUserByNickname(
  nickname: string
): Promise<FriendSearchResult | null> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("find_user_by_nickname", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function sendFriendRequest(nickname: string): Promise<string> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return data?.[0]?.status || "request_sent";
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("accept_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("decline_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function cancelFriendRequest(requestId: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("cancel_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function removeFriend(friendId: string): Promise<void> {
  await ensureSignedIn();
  const { error } = await supabase.rpc("remove_friend", {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_friend_requests");
  if (error) throw error;
  return data || [];
}

export async function getFriends(): Promise<FriendSummary[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_friends");
  if (error) throw error;
  return data || [];
}

export async function getFriendProfile(
  friendId: string
): Promise<FriendProfile | null> {
  const { data, error } = await supabase.rpc("get_friend_profile", {
    p_user_id: friendId,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function getFriendReadings(userId: string): Promise<ReadingEntry[]> {
  await ensureSignedIn();
  const { data, error } = await supabase.rpc("get_friend_readings", { p_user_id: userId });
  if (error) throw error;
  return data || [];
}

export async function getReadingStats(): Promise<ReadingStats> {
  const userId = await currentUserId();
  const { data: readingStats, error: statsError } = await supabase
    .from("reading_stats")
    .select("user_id, total_pages, total_minutes, month_pages, month_minutes")
    .eq("user_id", userId)
    .maybeSingle();
  if (statsError) throw statsError;

  const { data: userStreak, error: streakError } = await supabase.rpc("get_current_streak", {
    p_user_id: userId,
  });
  if (streakError) throw streakError;

  return {
    readingStats: readingStats || {
      user_id: userId,
      total_pages: 0,
      total_minutes: 0,
      month_pages: 0,
      month_minutes: 0,
    },
    userStreak: Number(userStreak || 0),
  };
}

interface RankingRow {
  user_id: string;
  username?: string | null;
  name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  total_pages?: number | string | null;
  today_pages?: number | string | null;
  this_week_pages?: number | string | null;
  month_pages?: number | string | null;
  is_current_user?: boolean | null;
}

export function mapRankingRow(row: RankingRow): RankingUser {
  return {
    user_id: String(row.user_id),
    username: row.username || row.name || row.nickname || translate("mobile:leaderboard.unknownUser"),
    nickname: row.nickname || null,
    avatar_url: row.avatar_url || "",
    total_pages: Number(row.total_pages || 0),
    today_pages: Number(row.today_pages || 0),
    this_week_pages: Number(row.this_week_pages || 0),
    month_pages: Number(row.month_pages || 0),
    is_current_user: Boolean(row.is_current_user),
  };
}

/** Friend ranking, optionally restricted to one category. Throws on RPC errors. */
export async function getRanking(
  categoryId?: string | null,
  period: RankingPeriod = "all_time",
): Promise<RankingUser[]> {
  await ensureSignedIn();
  const { data, error } = categoryId
    ? await supabase.rpc("get_friend_category_ranking", { p_category_id: categoryId, p_period: period })
    : await supabase.rpc("get_friend_ranking", { p_period: period });
  if (error) throw error;
  return ((data as RankingRow[] | null) || []).map(mapRankingRow);
}

export interface SupabaseBook {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  total_pages: number | null;
  isbn: string | null;
  description: string | null;
  published_date: string | null;
  external_id: string | null;
  category_id?: string | null;
}

export async function getAllBooks(): Promise<SupabaseBook[]> {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
    return [];
  }
  
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user.id)
    .order("title");
  if (error) throw error;
  return data || [];
}

export async function getBookById(bookId: string): Promise<SupabaseBook | null> {
  const { data, error } = await supabase
    .from("books")
    .select("*")
    .eq("id", bookId)
    .single();
  if (error) throw error;
  return data;
}

export async function updateBook(
  bookId: string,
  updates: Partial<SupabaseBook>
): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update(updates)
    .eq("id", bookId);
  if (error) throw error;
}

export async function deleteBook(bookId: string): Promise<void> {
  const { error } = await supabase
    .from("books")
    .delete()
    .eq("id", bookId);
  if (error) throw error;
}

export async function mergeBooks(
  sourceBookId: string,
  targetBookId: string
): Promise<void> {
  const { error: updateError } = await supabase
    .from("readings")
    .update({ book_id: targetBookId })
    .eq("book_id", sourceBookId);
  if (updateError) throw updateError;

  const { error: deleteError } = await supabase
    .from("books")
    .delete()
    .eq("id", sourceBookId);
  if (deleteError) throw deleteError;
}

export interface BookReading {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  category_id: string | null;
}

export async function getBookReadings(bookId: string): Promise<BookReading[]> {
  const { data, error } = await supabase
    .from("readings")
    .select("id, source_name, pages, reading_date, reading_time, category_id")
    .eq("book_id", bookId)
    .order("reading_date", { ascending: false });
  if (error) throw error;
  return data || [];
}

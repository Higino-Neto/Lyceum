import type { User } from "@supabase/supabase-js";
import { getMobileSupabase, hasSupabaseConfig } from "./supabaseMobile";
import type { MobileBook } from "./types";

export interface MobileReadingEntry {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  created_at?: string;
  category_id?: string | null;
  book_id?: string | null;
}

export interface MobileCategory {
  id: string;
  name: string;
  points_per_page?: number;
}

export interface MobileReadingStats {
  readingStats: {
    user_id: string;
    total_pages: number;
    total_minutes: number;
    month_pages: number;
    month_minutes: number;
  };
  userStreak: number;
}

export interface MobileRankingUser {
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

export interface MobileFriendSummary {
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

export interface MobileFriendRequest {
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

export interface MobileProfile {
  id: string;
  name: string | null;
  nickname?: string | null;
  avatar_url: string | null;
  created_at?: string;
}

export interface MobileFriendSearchResult {
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

type MobileSupabase = NonNullable<ReturnType<typeof getMobileSupabase>>;

interface AuthenticatedClient {
  supabase: MobileSupabase;
  user: User;
}

function numberValue(value: number | string | null | undefined) {
  return Number(value || 0);
}

function mapRankingRow(row: Partial<MobileRankingUser> & { name?: string | null }): MobileRankingUser {
  return {
    user_id: String(row.user_id),
    username: row.username || row.name || row.nickname || "Usuario",
    nickname: row.nickname || null,
    avatar_url: row.avatar_url || "",
    total_pages: numberValue(row.total_pages),
    today_pages: numberValue(row.today_pages),
    this_week_pages: numberValue(row.this_week_pages),
    month_pages: numberValue(row.month_pages),
    is_current_user: Boolean(row.is_current_user),
  };
}

export function canUseMobileSupabase() {
  return hasSupabaseConfig();
}

export async function requireMobileSession(): Promise<AuthenticatedClient> {
  const supabase = getMobileSupabase();
  if (!supabase) {
    throw new Error("Supabase nao configurado no mobile.");
  }

  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  if (!data.user) {
    throw new Error("Entre na sua conta para sincronizar leituras.");
  }

  return { supabase, user: data.user };
}

export async function getMobileUserReadings(): Promise<MobileReadingEntry[]> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_user_readings");
  if (error) throw error;
  return data || [];
}

export async function getMobileFriendReadings(userId: string): Promise<MobileReadingEntry[]> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_friend_readings", {
    p_user_id: userId,
  });
  if (error) throw error;
  return data || [];
}

export async function getMobileReadingStats(): Promise<MobileReadingStats> {
  const { supabase, user } = await requireMobileSession();
  const { data: readingStats, error: statsError } = await supabase
    .from("reading_stats")
    .select("user_id, total_pages, total_minutes, month_pages, month_minutes")
    .eq("user_id", user.id)
    .maybeSingle();

  if (statsError) throw statsError;

  const { data: userStreak, error: streakError } = await supabase.rpc(
    "get_current_streak",
    { p_user_id: user.id },
  );

  if (streakError) throw streakError;

  return {
    readingStats: readingStats || {
      user_id: user.id,
      total_pages: 0,
      total_minutes: 0,
      month_pages: 0,
      month_minutes: 0,
    },
    userStreak: Number(userStreak || 0),
  };
}

export async function getMobileCategories(): Promise<MobileCategory[]> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_categories");
  if (error) throw error;
  return data || [];
}

export async function getOrCreateMobileBook(
  title: string,
  categoryId?: string | null,
  book?: MobileBook | null,
): Promise<string> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_or_create_book", {
    p_title: title,
    p_author: book?.author || null,
    p_thumbnail_url: book?.thumbnailUrl || null,
    p_total_pages: book?.totalPages ? Number(book.totalPages) : null,
    p_isbn: book?.isbn || null,
    p_category_id: categoryId || null,
  });

  if (error) throw error;
  if (!data) throw new Error("Livro nao pode ser criado.");
  return String(data);
}

export async function createMobileReadingEntry(input: {
  sourceName: string;
  pages: number;
  readingDate: string;
  readingTime: number;
  categoryId: string;
  bookId?: string | null;
}): Promise<string> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("create_reading_entry", {
    p_source_name: input.sourceName,
    p_pages: input.pages,
    p_reading_date: input.readingDate,
    p_reading_time: input.readingTime,
    p_category_id: input.categoryId,
    p_book_id: input.bookId || null,
  });
  if (error) throw error;
  return String(data);
}

export async function updateMobileReadingEntry(input: {
  readingId: string;
  sourceName: string;
  pages: number;
  readingDate: string;
  readingTime: number;
  categoryId?: string | null;
}): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("update_reading_entry", {
    p_reading_id: input.readingId,
    p_source_name: input.sourceName,
    p_pages: input.pages,
    p_reading_date: input.readingDate,
    p_reading_time: input.readingTime,
    p_category_id: input.categoryId || null,
  });
  if (error) throw error;
}

export async function deleteMobileReadingEntry(readingId: string): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("delete_reading_entry", {
    p_reading_id: readingId,
  });
  if (error) throw error;
}

export async function getMobileRanking(
  categoryId?: string | null,
  period = "all_time",
): Promise<MobileRankingUser[]> {
  const { supabase } = await requireMobileSession();
  const rpc = categoryId ? "get_friend_category_ranking" : "get_friend_ranking";
  const args = categoryId
    ? { p_category_id: categoryId, p_period: period }
    : { p_period: period };
  const { data, error } = await supabase.rpc(rpc, args);
  if (error) throw error;
  return ((data as Array<Partial<MobileRankingUser> & { name?: string | null }> | null) || []).map(mapRankingRow);
}

export async function getMobileFriends(): Promise<MobileFriendSummary[]> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_friends");
  if (error) throw error;
  return data || [];
}

export async function getMobileFriendRequests(): Promise<MobileFriendRequest[]> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_friend_requests");
  if (error) throw error;
  return data || [];
}

export async function getMobileUserProfile(): Promise<MobileProfile | null> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("get_user_profile");
  if (error) throw error;
  return data?.[0] || null;
}

export async function createMobileUserProfile(userId: string, email: string): Promise<void> {
  const supabase = getMobileSupabase();
  if (!supabase) return;
  const { error } = await supabase.rpc("create_user_profile", {
    p_user_id: userId,
    p_email: email,
  });
  if (error) throw error;
}

export async function updateMobileProfileNickname(nickname: string): Promise<string> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("update_profile_nickname", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return String(data);
}

export async function findMobileUserByNickname(
  nickname: string,
): Promise<MobileFriendSearchResult | null> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("find_user_by_nickname", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return data?.[0] || null;
}

export async function sendMobileFriendRequest(nickname: string): Promise<string> {
  const { supabase } = await requireMobileSession();
  const { data, error } = await supabase.rpc("send_friend_request", {
    p_nickname: nickname,
  });
  if (error) throw error;
  return data?.[0]?.status || "request_sent";
}

export async function acceptMobileFriendRequest(requestId: string): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("accept_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function declineMobileFriendRequest(requestId: string): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("decline_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function cancelMobileFriendRequest(requestId: string): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("cancel_friend_request", {
    p_request_id: requestId,
  });
  if (error) throw error;
}

export async function removeMobileFriend(friendId: string): Promise<void> {
  const { supabase } = await requireMobileSession();
  const { error } = await supabase.rpc("remove_friend", {
    p_friend_id: friendId,
  });
  if (error) throw error;
}

export function getMobileReadingQueryEnabled(sessionEmail: string | null) {
  return hasSupabaseConfig() && Boolean(sessionEmail);
}

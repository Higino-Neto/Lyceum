import { supabase } from "../lib/supabase";

export interface ReadingEntry {
  id: string;
  source_name: string;
  pages: number;
  reading_date: string;
  reading_time: number;
  category_id: string;
  book_id?: string;
}

export interface Category {
  id: string;
  name: string;
  points_per_page: number;
}

export interface Profile {
  id: string;
  name: string;
  avatar_url: string;
  created_at: Date;
}

export async function getUserReadings(): Promise<ReadingEntry[]> {
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
  bookId?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("create_reading_entry", {
    p_source_name: sourceName,
    p_pages: pages,
    p_reading_date: readingDate,
    p_reading_time: readingTime,
    p_category_id: categoryId,
    p_book_id: bookId || null,
  });
  if (error) throw error;
  return data;
}

export async function deleteReadingEntry(readingId: string): Promise<void> {
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
  categoryId?: string
): Promise<void> {
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

export async function getOrCreateBook(
  title: string,
  author?: string,
  thumbnailUrl?: string,
  totalPages?: number,
  isbn?: string,
  description?: string,
  publishedDate?: string,
  externalId?: string,
  categoryId?: string
): Promise<string> {
  const { data, error } = await supabase.rpc("get_or_create_book", {
    p_title: title,
    p_author: author || null,
    p_thumbnail_url: thumbnailUrl || null,
    p_total_pages: totalPages || null,
    p_isbn: isbn || null,
    p_description: description || null,
    p_published_date: publishedDate || null,
    p_external_id: externalId || null,
    p_category_id: categoryId || null,
  });
  if (error) throw error;
  return data;
}

export async function getCategories(): Promise<Category[]> {
  const { data, error } = await supabase.rpc("get_categories");
  if (error) throw error;
  return data || [];
}

export async function getUserProfile(): Promise<Profile | null> {
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

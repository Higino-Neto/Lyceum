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

    console.log("getOrCreateBook response:", { data, error, title });

    if (error) {
      console.error("Supabase RPC error for book:", title, error);
      throw new Error(error.message || "Erro ao criar livro no banco de dados");
    }

    if (!data) {
      throw new Error(`Livro "${title}" não pôde ser criado - resposta vazia`);
    }

    return String(data);
  } catch (err) {
    console.error("getOrCreateBook exception:", err);
    if (err instanceof Error) {
      throw new Error(`Erro ao criar livro "${title}": ${err.message}`);
    }
    throw new Error(`Erro ao criar livro "${title}": Erro desconhecido`);
  }
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

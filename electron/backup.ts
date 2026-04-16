import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

export function initBackupClient(url: string, anonKey: string): SupabaseClient {
  supabase = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return supabase;
}

export function getBackupClient(): SupabaseClient | null {
  return supabase;
}

export async function setBackupSession(accessToken: string, refreshToken: string) {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (error) {
    console.error("[Backup] Error setting session:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function clearBackupSession() {
  if (!supabase) {
    return { success: true };
  }

  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("[Backup] Error clearing session:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export interface BackupDocument {
  local_id: number;
  file_hash: string;
  title: string;
  file_path: string | null;
  file_size: number;
  num_pages: number;
  current_page: number;
  current_zoom: number | null;
  current_scroll: number | null;
  annotations: string | null;
  thumbnail_path: string | null;
  created_at: string;
  last_opened_at: string;
  is_synced: number;
  is_favorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publish_date: string | null;
  category: string | null;
  processing_status: string;
  book_id: string | null;
  categories_json: string | null;
  file_type?: string;
}

export async function backupDocument(doc: {
  id: number;
  fileHash: string;
  title: string;
  filePath: string | null;
  fileSize: number;
  numPages: number;
  currentPage: number;
  currentZoom: number | null;
  currentScroll: number | null;
  annotations: string | null;
  thumbnailPath: string | null;
  createdAt: string;
  lastOpenedAt: string;
  isSynced: number;
  isFavorite: number;
  rating: number;
  notes: string | null;
  author: string | null;
  description: string | null;
  isbn: string | null;
  publisher: string | null;
  publishDate: string | null;
  category: string | null;
  processingStatus: string;
  bookId: string | null;
  categoryIds: number[];
  fileType?: string;
}): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.rpc("upsert_document_backup", {
      p_local_id: doc.id,
      p_file_hash: doc.fileHash,
      p_title: doc.title?.replace(/\.pdf$/i, "").replace(/\.epub$/i, ""),
      p_file_path: doc.filePath,
      p_file_size: doc.fileSize,
      p_num_pages: doc.numPages,
      p_current_page: doc.currentPage,
      p_current_zoom: doc.currentZoom,
      p_current_scroll: doc.currentScroll,
      p_annotations: doc.annotations,
      p_thumbnail_path: doc.thumbnailPath,
      p_created_at: doc.createdAt,
      p_last_opened_at: doc.lastOpenedAt,
      p_is_synced: doc.isSynced,
      p_is_favorite: doc.isFavorite,
      p_rating: doc.rating,
      p_notes: doc.notes,
      p_author: doc.author,
      p_description: doc.description,
      p_isbn: doc.isbn,
      p_publisher: doc.publisher,
      p_publish_date: doc.publishDate,
      p_category: doc.category,
      p_processing_status: doc.processingStatus,
      p_book_id: doc.bookId,
      p_categories_json: JSON.stringify(doc.categoryIds),
      p_file_type: doc.fileType || null,
    });

    if (error) {
      console.error("[Backup] Error backing up document:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error & { message?: string };
    console.error("[Backup] Exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function backupAllDocuments(docs: Awaited<ReturnType<typeof import("./local-database").getDocumentsForBackup>>): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const doc of docs) {
    const result = await backupDocument(doc);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${doc.title}: ${result.error}`);
    }
  }

  return { success, failed, errors };
}

export interface BackupHabit {
  id: string;
  name: string;
  createdAt: string;
  unit: string | null;
  valueMode: string;
}

export interface BackupHabitCompletion {
  habitId: string;
  dateKey: string;
  value: string | null;
}

export async function backupHabit(habit: BackupHabit): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.rpc("upsert_habit_backup", {
      p_id: habit.id,
      p_name: habit.name,
      p_created_at: habit.createdAt,
      p_unit: habit.unit,
      p_value_mode: habit.valueMode,
    });

    if (error) {
      console.error("[Backup] Error backing up habit:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error & { message?: string };
    console.error("[Backup] Habit backup exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function backupHabitCompletion(completion: BackupHabitCompletion): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.rpc("upsert_habit_completion_backup", {
      p_habit_id: completion.habitId,
      p_date_key: completion.dateKey,
      p_value: completion.value,
    });

    if (error) {
      console.error("[Backup] Error backing up habit completion:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error & { message?: string };
    console.error("[Backup] Habit completion backup exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function backupAllHabits(
  habits: BackupHabit[],
  completions: BackupHabitCompletion[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const habit of habits) {
    const result = await backupHabit(habit);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${habit.name}: ${result.error}`);
    }
  }

  for (const completion of completions) {
    const result = await backupHabitCompletion(completion);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${completion.habitId}/${completion.dateKey}: ${result.error}`);
    }
  }

  return { success, failed, errors };
}

export interface BackupCategory {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}

export async function backupCategory(category: BackupCategory): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.rpc("upsert_category_backup", {
      p_id: category.id,
      p_name: category.name,
      p_color: category.color,
      p_created_at: category.createdAt,
    });

    if (error) {
      console.error("[Backup] Error backing up category:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error & { message?: string };
    console.error("[Backup] Category backup exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export interface BackupDocumentCategory {
  documentId: number;
  categoryId: number;
}

export async function backupDocumentCategory(rel: BackupDocumentCategory): Promise<{ success: boolean; error?: string }> {
  if (!supabase) {
    return { success: false, error: "Supabase client not initialized" };
  }

  try {
    const { error } = await supabase.rpc("upsert_document_category_backup", {
      p_document_id: rel.documentId,
      p_category_id: rel.categoryId,
    });

    if (error) {
      console.error("[Backup] Error backing up document_category:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const error = err as Error & { message?: string };
    console.error("[Backup] Document category backup exception:", error);
    return { success: false, error: error.message || "Unknown error" };
  }
}

export async function backupAllCategories(
  categories: BackupCategory[],
  documentCategories: BackupDocumentCategory[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  let success = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const category of categories) {
    const result = await backupCategory(category);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${category.name}: ${result.error}`);
    }
  }

  for (const rel of documentCategories) {
    const result = await backupDocumentCategory(rel);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push(`${rel.documentId}/${rel.categoryId}: ${result.error}`);
    }
  }

  return { success, failed, errors };
}

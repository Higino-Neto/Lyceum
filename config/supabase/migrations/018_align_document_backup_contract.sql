-- Keep the desktop client and PostgREST RPC signature in lockstep.
-- `category` stores the legacy folder/sync category, while `categories_json`
-- stores IDs from the normalized categories/document_categories model.

ALTER TABLE public.documents_backup
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS categories_json TEXT,
  ADD COLUMN IF NOT EXISTS file_type TEXT;

-- CREATE OR REPLACE cannot change a function's argument list. Remove every old
-- overload so PostgREST exposes exactly one unambiguous contract.
DO $$
DECLARE
  function_signature regprocedure;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure
    FROM pg_proc AS p
    JOIN pg_namespace AS n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'upsert_document_backup'
  LOOP
    EXECUTE format('DROP FUNCTION %s', function_signature);
  END LOOP;
END;
$$;

CREATE FUNCTION public.upsert_document_backup(
  p_local_id INTEGER,
  p_file_hash TEXT,
  p_title TEXT,
  p_file_path TEXT,
  p_file_size INTEGER,
  p_num_pages INTEGER,
  p_current_page INTEGER,
  p_current_zoom REAL,
  p_current_scroll REAL,
  p_annotations TEXT,
  p_thumbnail_path TEXT,
  p_created_at TEXT,
  p_last_opened_at TEXT,
  p_is_synced INTEGER,
  p_is_favorite INTEGER,
  p_rating REAL,
  p_notes TEXT,
  p_author TEXT,
  p_description TEXT,
  p_isbn TEXT,
  p_publisher TEXT,
  p_publish_date TEXT,
  p_category TEXT,
  p_processing_status TEXT,
  p_book_id TEXT,
  p_categories_json TEXT,
  p_file_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.documents_backup (
    user_id, local_id, file_hash, title, file_path, file_size, num_pages,
    current_page, current_zoom, current_scroll, annotations, thumbnail_path,
    created_at, last_opened_at, is_synced, is_favorite, rating, notes, author,
    description, isbn, publisher, publish_date, category, processing_status,
    book_id, categories_json, file_type
  ) VALUES (
    auth.uid(), p_local_id, p_file_hash, p_title, p_file_path, p_file_size,
    p_num_pages, p_current_page, p_current_zoom, p_current_scroll, p_annotations,
    p_thumbnail_path, p_created_at, p_last_opened_at, p_is_synced, p_is_favorite,
    p_rating, p_notes, p_author, p_description, p_isbn, p_publisher,
    p_publish_date, p_category, p_processing_status, p_book_id,
    p_categories_json, p_file_type
  )
  ON CONFLICT (user_id, file_hash) DO UPDATE SET
    local_id = EXCLUDED.local_id,
    title = EXCLUDED.title,
    file_path = EXCLUDED.file_path,
    file_size = EXCLUDED.file_size,
    num_pages = EXCLUDED.num_pages,
    current_page = EXCLUDED.current_page,
    current_zoom = EXCLUDED.current_zoom,
    current_scroll = EXCLUDED.current_scroll,
    annotations = EXCLUDED.annotations,
    thumbnail_path = EXCLUDED.thumbnail_path,
    created_at = EXCLUDED.created_at,
    last_opened_at = EXCLUDED.last_opened_at,
    is_synced = EXCLUDED.is_synced,
    is_favorite = EXCLUDED.is_favorite,
    rating = EXCLUDED.rating,
    notes = EXCLUDED.notes,
    author = EXCLUDED.author,
    description = EXCLUDED.description,
    isbn = EXCLUDED.isbn,
    publisher = EXCLUDED.publisher,
    publish_date = EXCLUDED.publish_date,
    category = EXCLUDED.category,
    processing_status = EXCLUDED.processing_status,
    book_id = EXCLUDED.book_id,
    categories_json = EXCLUDED.categories_json,
    file_type = EXCLUDED.file_type;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Script SQL para criar ou migrar a tabela de backup de documentos locais
-- Execute este script no Supabase SQL Editor
-- Observação: se você já tiver dados antigos sem user_id, eles precisarão ser
-- atribuídos manualmente antes de tornar a coluna NOT NULL em produção.

CREATE TABLE IF NOT EXISTS public.documents_backup (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    local_id INTEGER NOT NULL,
    file_hash TEXT NOT NULL,
    title TEXT NOT NULL,
    file_path TEXT,
    file_size INTEGER DEFAULT 0,
    num_pages INTEGER DEFAULT 1,
    current_page INTEGER DEFAULT 1,
    current_zoom REAL,
    current_scroll REAL,
    annotations TEXT,
    thumbnail_path TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_opened_at TEXT,
    is_synced INTEGER DEFAULT 0,
    is_favorite INTEGER DEFAULT 0,
    rating REAL DEFAULT 0,
    notes TEXT,
    author TEXT,
    description TEXT,
    isbn TEXT,
    publisher TEXT,
    publish_date TEXT,
    category TEXT,
    processing_status TEXT DEFAULT 'pending',
    book_id TEXT,
    categories_json TEXT
);

ALTER TABLE public.documents_backup
    ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.documents_backup
    ALTER COLUMN user_id SET DEFAULT auth.uid();

DROP INDEX IF EXISTS idx_documents_backup_file_hash;
ALTER TABLE public.documents_backup
    DROP CONSTRAINT IF EXISTS documents_backup_file_hash_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_backup_user_file_hash
    ON public.documents_backup(user_id, file_hash);

CREATE INDEX IF NOT EXISTS idx_documents_backup_user_synced
    ON public.documents_backup(user_id, is_synced);

CREATE INDEX IF NOT EXISTS idx_documents_backup_user_last_opened
    ON public.documents_backup(user_id, last_opened_at);

CREATE OR REPLACE FUNCTION public.upsert_document_backup(
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
    p_categories_json TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    INSERT INTO public.documents_backup (
        user_id,
        local_id,
        file_hash,
        title,
        file_path,
        file_size,
        num_pages,
        current_page,
        current_zoom,
        current_scroll,
        annotations,
        thumbnail_path,
        created_at,
        last_opened_at,
        is_synced,
        is_favorite,
        rating,
        notes,
        author,
        description,
        isbn,
        publisher,
        publish_date,
        category,
        processing_status,
        book_id,
        categories_json
    )
    VALUES (
        auth.uid(),
        p_local_id,
        p_file_hash,
        p_title,
        p_file_path,
        p_file_size,
        p_num_pages,
        p_current_page,
        p_current_zoom,
        p_current_scroll,
        p_annotations,
        p_thumbnail_path,
        p_created_at,
        p_last_opened_at,
        p_is_synced,
        p_is_favorite,
        p_rating,
        p_notes,
        p_author,
        p_description,
        p_isbn,
        p_publisher,
        p_publish_date,
        p_category,
        p_processing_status,
        p_book_id,
        p_categories_json
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
        categories_json = EXCLUDED.categories_json;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_document_backup(p_file_hash TEXT)
RETURNS SETOF public.documents_backup
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.documents_backup
    WHERE user_id = auth.uid()
      AND file_hash = p_file_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_unsynced_documents()
RETURNS SETOF public.documents_backup
LANGUAGE plpgsql
AS $$
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    RETURN QUERY
    SELECT *
    FROM public.documents_backup
    WHERE user_id = auth.uid()
      AND is_synced = 0;
END;
$$;

ALTER TABLE public.documents_backup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can only see their own documents_backup" ON public.documents_backup;
DROP POLICY IF EXISTS "documents_backup_select_own" ON public.documents_backup;
DROP POLICY IF EXISTS "documents_backup_insert_own" ON public.documents_backup;
DROP POLICY IF EXISTS "documents_backup_update_own" ON public.documents_backup;
DROP POLICY IF EXISTS "documents_backup_delete_own" ON public.documents_backup;

CREATE POLICY "documents_backup_select_own"
ON public.documents_backup
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "documents_backup_insert_own"
ON public.documents_backup
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_backup_update_own"
ON public.documents_backup
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "documents_backup_delete_own"
ON public.documents_backup
FOR DELETE
USING (auth.uid() = user_id);

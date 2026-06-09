-- Fix ALL data types to match the actual table schema

DROP FUNCTION IF EXISTS public.get_user_readings();
DROP FUNCTION IF EXISTS public.create_reading_entry(text, smallint, date, smallint, uuid, uuid);
DROP FUNCTION IF EXISTS public.delete_reading_entry(uuid);
DROP FUNCTION IF EXISTS public.get_or_create_book(text, text, text, smallint, text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.get_categories();
DROP FUNCTION IF EXISTS public.get_user_profile();
DROP FUNCTION IF EXISTS public.update_user_profile(text, text);
DROP FUNCTION IF EXISTS public.create_user_profile(uuid, text);

-- Get user's readings (with CORRECT types from table)
CREATE FUNCTION get_user_readings()
RETURNS TABLE (
  id uuid,
  source_name text,
  pages smallint,
  reading_date date,
  reading_time smallint,
  created_at timestamptz,
  category_id uuid,
  book_id uuid
) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.source_name,
    r.pages,
    r.reading_date,
    r.reading_time,
    r.created_at,
    r.category_id,
    r.book_id
  FROM public.readings r
  WHERE r.user_id = auth.uid()
  ORDER BY r.reading_date DESC, r.created_at DESC;
END;
$$;

-- Create reading entry (with CORRECT types from table)
CREATE FUNCTION create_reading_entry(
  p_source_name text,
  p_pages smallint,
  p_reading_date date,
  p_reading_time smallint,
  p_category_id uuid,
  p_book_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_reading_id uuid;
BEGIN
  INSERT INTO public.readings (
    source_name,
    pages,
    reading_date,
    reading_time,
    category_id,
    book_id,
    user_id
  ) VALUES (
    p_source_name,
    p_pages,
    p_reading_date,
    p_reading_time,
    p_category_id,
    p_book_id,
    auth.uid()
  )
  RETURNING id INTO v_reading_id;

  RETURN v_reading_id;
END;
$$;

-- Delete reading entry
CREATE FUNCTION delete_reading_entry(p_reading_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM public.readings
  WHERE id = p_reading_id AND user_id = auth.uid();
END;
$$;

-- Get or create book
CREATE FUNCTION get_or_create_book(
  p_title text,
  p_author text DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL,
  p_total_pages smallint DEFAULT NULL,
  p_isbn text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_published_date text DEFAULT NULL,
  p_external_id text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_book_id uuid;
  v_existing_book uuid;
BEGIN
  SELECT id INTO v_existing_book
  FROM public.books
  WHERE title = p_title AND user_id = auth.uid()
  LIMIT 1;

  IF v_existing_book IS NOT NULL THEN
    IF p_category_id IS NOT NULL THEN
      UPDATE public.books
      SET category_id = p_category_id
      WHERE id = v_existing_book;
    END IF;
    RETURN v_existing_book;
  END IF;

  INSERT INTO public.books (
    title,
    author,
    thumbnail_url,
    total_pages,
    isbn,
    description,
    published_date,
    external_id,
    category_id,
    user_id
  ) VALUES (
    p_title,
    p_author,
    p_thumbnail_url,
    p_total_pages,
    p_isbn,
    p_description,
    p_published_date,
    p_external_id,
    p_category_id,
    auth.uid()
  )
  RETURNING id INTO v_book_id;

  RETURN v_book_id;
END;
$$;

-- Get categories
CREATE FUNCTION get_categories()
RETURNS TABLE (
  id uuid,
  name text,
  color text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.color
  FROM public.categories c
  ORDER BY c.name;
END;
$$;

-- Get user profile
CREATE FUNCTION get_user_profile()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- Update user profile
CREATE FUNCTION update_user_profile(
  p_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    name = COALESCE(p_name, name),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = auth.uid();
END;
$$;

-- Create user profile
CREATE FUNCTION create_user_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (p_user_id, split_part(p_email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
END;
$$;

-- Recreate all RLS policies and functions (excluding reading_stats which is a view)
-- Run this if parts of 004 failed to apply

-- =============================================================================
-- RLS POLICIES (only for actual tables, not views)
-- =============================================================================

-- Books policies
DROP POLICY IF EXISTS "Users can view their own books" ON public.books;
DROP POLICY IF EXISTS "Users can insert their own books" ON public.books;
DROP POLICY IF EXISTS "Users can update their own books" ON public.books;
DROP POLICY IF EXISTS "Users can delete their own books" ON public.books;

CREATE POLICY "Users can view their own books" ON public.books
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own books" ON public.books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own books" ON public.books
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own books" ON public.books
  FOR DELETE USING (auth.uid() = user_id);

-- Readings policies
DROP POLICY IF EXISTS "Users can view their own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can insert their own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can update their own readings" ON public.readings;
DROP POLICY IF EXISTS "Users can delete their own readings" ON public.readings;

CREATE POLICY "Users can view their own readings" ON public.readings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own readings" ON public.readings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own readings" ON public.readings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own readings" ON public.readings
  FOR DELETE USING (auth.uid() = user_id);

-- Profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Categories (read-only for authenticated users)
DROP POLICY IF EXISTS "Anyone can view categories" ON public.categories;
CREATE POLICY "Anyone can view categories" ON public.categories
  FOR SELECT TO authenticated USING (true);

-- =============================================================================
-- DATABASE FUNCTIONS (API)
-- =============================================================================

-- Get user's readings
CREATE OR REPLACE FUNCTION get_user_readings()
RETURNS TABLE (
  id uuid,
  source_name text,
  pages integer,
  reading_date date,
  reading_time integer,
  category_id uuid,
  book_id uuid
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    r.id,
    r.source_name,
    r.pages,
    r.reading_date,
    r.reading_time,
    r.category_id,
    r.book_id
  FROM public.readings r
  WHERE r.user_id = auth.uid()
  ORDER BY r.reading_date DESC;
END;
$$;

-- Create reading entry
CREATE OR REPLACE FUNCTION create_reading_entry(
  p_source_name text,
  p_pages integer,
  p_reading_date date,
  p_reading_time integer,
  p_category_id uuid,
  p_book_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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
CREATE OR REPLACE FUNCTION delete_reading_entry(p_reading_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.readings
  WHERE id = p_reading_id AND user_id = auth.uid();
END;
$$;

-- Get or create book
CREATE OR REPLACE FUNCTION get_or_create_book(
  p_title text,
  p_author text DEFAULT NULL,
  p_thumbnail_url text DEFAULT NULL,
  p_total_pages integer DEFAULT NULL,
  p_isbn text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_published_date text DEFAULT NULL,
  p_external_id text DEFAULT NULL,
  p_category_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
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

-- Get user profile
CREATE OR REPLACE FUNCTION get_user_profile()
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.name, p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

-- Update user profile
CREATE OR REPLACE FUNCTION update_user_profile(
  p_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET 
    name = COALESCE(p_name, name),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = auth.uid();
END;
$$;

-- Get categories
CREATE OR REPLACE FUNCTION get_categories()
RETURNS TABLE (
  id uuid,
  name text,
  color text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.color
  FROM public.categories c
  ORDER BY c.name;
END;
$$;

-- Create user profile
CREATE OR REPLACE FUNCTION create_user_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, name)
  VALUES (p_user_id, split_part(p_email, '@', 1))
  ON CONFLICT (id) DO NOTHING;
END;
$$;

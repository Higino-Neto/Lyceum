-- Add created_at to get_user_readings and order by created_at DESC

DROP FUNCTION IF EXISTS public.get_user_readings();

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
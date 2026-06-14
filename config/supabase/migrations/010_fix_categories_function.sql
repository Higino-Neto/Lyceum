-- Fix get_categories function to match actual table schema

DROP FUNCTION IF EXISTS public.get_categories();

CREATE FUNCTION get_categories()
RETURNS TABLE (
  id uuid,
  name text,
  points_per_page numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT c.id, c.name, c.points_per_page
  FROM public.categories c
  ORDER BY c.name;
END;
$$;

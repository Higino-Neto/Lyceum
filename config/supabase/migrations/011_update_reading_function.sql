-- Add update reading function

CREATE OR REPLACE FUNCTION update_reading_entry(
  p_reading_id uuid,
  p_source_name text,
  p_pages smallint,
  p_reading_date date,
  p_reading_time smallint,
  p_category_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.readings
  SET 
    source_name = p_source_name,
    pages = p_pages,
    reading_date = p_reading_date,
    reading_time = p_reading_time,
    category_id = p_category_id
  WHERE id = p_reading_id AND user_id = auth.uid();
END;
$$;

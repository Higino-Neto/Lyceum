CREATE OR REPLACE FUNCTION get_category_ranking(
  p_category_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all_time'
)
RETURNS TABLE (
  user_id uuid,
  total_pages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_brazil_today date;
  v_start_date date;
BEGIN
  v_brazil_today := (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date;

  v_start_date := CASE p_period
    WHEN 'today' THEN v_brazil_today
    WHEN 'this_week' THEN date_trunc('week', v_brazil_today)::date
    WHEN 'this_month' THEN date_trunc('month', v_brazil_today)::date
    ELSE '1970-01-01'::date
  END;

  RETURN QUERY
  SELECT
    r.user_id,
    SUM(r.pages)::bigint AS total_pages
  FROM public.readings r
  WHERE (p_category_id IS NULL OR r.category_id = p_category_id)
    AND (p_period = 'all_time' OR r.reading_date >= v_start_date)
  GROUP BY r.user_id
  ORDER BY total_pages DESC
  LIMIT 10;
END;
$$;

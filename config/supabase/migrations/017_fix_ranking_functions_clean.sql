-- Fix category ranking functions (cleaned: no INSERT INTO view)
-- reading_stats is a VIEW, not a table. Remove broken trigger/INSERT approach.
-- Only keep helper functions + corrected category ranking functions.

-- 1. Drop broken trigger and functions (if they exist from prior partial migration)
DROP TRIGGER IF EXISTS reading_stats_trigger ON public.readings;
DROP FUNCTION IF EXISTS public.update_reading_stats_trigger();
DROP FUNCTION IF EXISTS public.update_reading_stats_for_user(uuid);

-- 2. Fix helper functions
CREATE OR REPLACE FUNCTION public.get_brazil_date()
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_brazil_week_start()
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_brazil_month_start()
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$;

-- 3. Fix friend category ranking with separated period columns
CREATE OR REPLACE FUNCTION public.get_friend_category_ranking(
  p_category_id uuid DEFAULT NULL,
  p_period text DEFAULT 'all_time'
)
RETURNS TABLE (
  user_id uuid,
  username text,
  nickname text,
  avatar_url text,
  total_pages bigint,
  today_pages bigint,
  this_week_pages bigint,
  month_pages bigint,
  is_current_user boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_brazil_today date;
  v_week_start date;
  v_month_start date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_brazil_today := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
  v_week_start := date_trunc('week', v_brazil_today)::date;
  v_month_start := date_trunc('month', v_brazil_today)::date;

  RETURN QUERY
  WITH allowed_users AS (
    SELECT v_user_id AS id
    UNION
    SELECT CASE WHEN f.user_a = v_user_id THEN f.user_b ELSE f.user_a END
    FROM public.friendships f
    WHERE f.user_a = v_user_id OR f.user_b = v_user_id
  ),
  ranked AS (
    SELECT
      au.id,
      coalesce(sum(r.pages), 0)::bigint AS total_pages,
      coalesce(sum(r.pages) FILTER (WHERE r.reading_date >= v_brazil_today), 0)::bigint AS today_pages,
      coalesce(sum(r.pages) FILTER (WHERE r.reading_date >= v_week_start), 0)::bigint AS this_week_pages,
      coalesce(sum(r.pages) FILTER (WHERE r.reading_date >= v_month_start), 0)::bigint AS month_pages
    FROM allowed_users au
    LEFT JOIN public.readings r
      ON r.user_id = au.id
     AND (p_category_id IS NULL OR r.category_id = p_category_id)
    GROUP BY au.id
  )
  SELECT
    p.id,
    coalesce(p.name, p.nickname, 'Usuario'),
    p.nickname,
    p.avatar_url,
    ranked.total_pages,
    ranked.today_pages,
    ranked.this_week_pages,
    ranked.month_pages,
    p.id = v_user_id
  FROM ranked
  JOIN public.profiles p ON p.id = ranked.id
  ORDER BY
    CASE p_period
      WHEN 'today' THEN ranked.today_pages
      WHEN 'this_week' THEN ranked.this_week_pages
      WHEN 'this_month' THEN ranked.month_pages
      ELSE ranked.total_pages
    END DESC,
    p.name NULLS LAST,
    p.nickname
  LIMIT 10;
END;
$$;

-- 4. Fix category ranking wrapper to return period-appropriate column
CREATE OR REPLACE FUNCTION public.get_category_ranking(
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
BEGIN
  RETURN QUERY
  SELECT
    friend_rank.user_id,
    CASE p_period
      WHEN 'today' THEN friend_rank.today_pages
      WHEN 'this_week' THEN friend_rank.this_week_pages
      WHEN 'this_month' THEN friend_rank.month_pages
      ELSE friend_rank.total_pages
    END
  FROM public.get_friend_category_ranking(p_category_id, p_period) friend_rank;
END;
$$;

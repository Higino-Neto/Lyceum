-- Fix week start consistency: ensure ALL leaderboards use Monday as week start
-- Root cause: CURRENT_DATE AT TIME ZONE is incorrect when server timezone differs from Brazil.
-- Fix: use (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date consistently.

-- 1. Fix helper functions
CREATE OR REPLACE FUNCTION get_brazil_date()
RETURNS date AS $$
BEGIN
  RETURN (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_brazil_week_start()
RETURNS date AS $$
BEGIN
  RETURN date_trunc('week', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_brazil_month_start()
RETURNS date AS $$
BEGIN
  RETURN date_trunc('month', CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

-- 2. Fix reading_stats trigger to handle DELETE (NEW is NULL on DELETE)
CREATE OR REPLACE FUNCTION update_reading_stats_for_user(p_user_id uuid)
RETURNS void AS $$
DECLARE
  brazil_today date;
  brazil_week_start date;
  brazil_month_start date;
  total_pages_sum bigint;
  today_pages_sum bigint;
  week_pages_sum bigint;
  month_pages_sum bigint;
BEGIN
  brazil_today := get_brazil_date();
  brazil_week_start := get_brazil_week_start();
  brazil_month_start := get_brazil_month_start();

  SELECT COALESCE(SUM(pages), 0) INTO total_pages_sum
  FROM readings
  WHERE user_id = p_user_id;

  SELECT COALESCE(SUM(pages), 0) INTO today_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND reading_date = brazil_today;

  SELECT COALESCE(SUM(pages), 0) INTO week_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND reading_date >= brazil_week_start;

  SELECT COALESCE(SUM(pages), 0) INTO month_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND reading_date >= brazil_month_start;

  INSERT INTO reading_stats (user_id, total_pages, today_pages, this_week_pages, month_pages, updated_at)
  VALUES (p_user_id, total_pages_sum, today_pages_sum, week_pages_sum, month_pages_sum, NOW())
  ON CONFLICT (user_id) DO UPDATE SET
    total_pages = total_pages_sum,
    today_pages = today_pages_sum,
    this_week_pages = week_pages_sum,
    month_pages = month_pages_sum,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_reading_stats_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM update_reading_stats_for_user(COALESCE(NEW.user_id, OLD.user_id));
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reading_stats_trigger ON readings;
CREATE TRIGGER reading_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON readings
FOR EACH ROW EXECUTE FUNCTION update_reading_stats_trigger();

-- 3. Fix category ranking functions
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
  v_brazil_today := (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date;

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

-- 4. Fix friend category ranking with separated period columns
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

-- 5. Fix category ranking wrapper to return period-appropriate column
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

-- 6. Refresh reading_stats for all existing users
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM readings LOOP
    PERFORM update_reading_stats_for_user(r.user_id);
  END LOOP;
END $$;

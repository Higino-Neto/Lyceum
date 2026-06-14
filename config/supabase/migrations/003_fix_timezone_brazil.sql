-- Fix timezone issue for Brazil (UTC-3)
-- Recalculate reading_stats using Brazil's timezone

-- Function to get today's date in Brazil timezone
CREATE OR REPLACE FUNCTION get_brazil_date()
RETURNS date AS $$
BEGIN
  RETURN CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo';
END;
$$ LANGUAGE plpgsql;

-- Function to get start of current week in Brazil timezone
CREATE OR REPLACE FUNCTION get_brazil_week_start()
RETURNS date AS $$
BEGIN
  RETURN DATE_TRUNC('week', CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

-- Function to get start of current month in Brazil timezone
CREATE OR REPLACE FUNCTION get_brazil_month_start()
RETURNS date AS $$
BEGIN
  RETURN DATE_TRUNC('month', CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date;
END;
$$ LANGUAGE plpgsql;

-- Update reading_stats for all users using Brazil timezone
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

  -- Calculate total pages
  SELECT COALESCE(SUM(pages), 0) INTO total_pages_sum
  FROM readings
  WHERE user_id = p_user_id;

  -- Calculate today's pages (Brazil timezone)
  SELECT COALESCE(SUM(pages), 0) INTO today_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND (reading_date::date AT TIME ZONE 'America/Sao_Paulo') = brazil_today;

  -- Calculate this week's pages (Brazil timezone)
  SELECT COALESCE(SUM(pages), 0) INTO week_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND (reading_date::date AT TIME ZONE 'America/Sao_Paulo') >= brazil_week_start;

  -- Calculate this month's pages (Brazil timezone)
  SELECT COALESCE(SUM(pages), 0) INTO month_pages_sum
  FROM readings
  WHERE user_id = p_user_id
    AND (reading_date::date AT TIME ZONE 'America/Sao_Paulo') >= brazil_month_start;

  -- Upsert the stats
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

-- Create a trigger to automatically update stats when readings are inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_reading_stats_trigger()
RETURNS trigger AS $$
BEGIN
  PERFORM update_reading_stats_for_user(NEW.user_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reading_stats_trigger ON readings;
CREATE TRIGGER reading_stats_trigger
AFTER INSERT OR UPDATE OR DELETE ON readings
FOR EACH ROW EXECUTE FUNCTION update_reading_stats_trigger();

-- Update stats for all existing users
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM readings LOOP
    PERFORM update_reading_stats_for_user(r.user_id);
  END LOOP;
END $$;

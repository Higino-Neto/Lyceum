-- Correction: reading_stats is a VIEW, not a table
-- RLS cannot be enabled on views, so we remove those policies

-- Drop the problematic policies (they may have been created before the error)
DROP POLICY IF EXISTS "Users can view their own stats" ON public.reading_stats;
DROP POLICY IF EXISTS "Users can insert their own stats" ON public.reading_stats;
DROP POLICY IF EXISTS "Users can update their own stats" ON public.reading_stats;

-- Note: reading_stats is a view that aggregates data from readings
-- Access is controlled through the readings table RLS policies
-- The view will automatically show only data the user has access to via readings

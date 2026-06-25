-- Friend-only competition and nickname-based discovery.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nickname text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_nickname_format'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_nickname_format
      CHECK (nickname IS NULL OR nickname ~ '^[a-z0-9_]{3,24}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_nickname_unique
  ON public.profiles (lower(nickname))
  WHERE nickname IS NOT NULL;

CREATE OR REPLACE FUNCTION public.normalize_profile_nickname(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_base text;
BEGIN
  v_base := lower(coalesce(p_value, ''));
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '_', 'g');
  v_base := regexp_replace(v_base, '^_+|_+$', '', 'g');
  v_base := substring(v_base from 1 for 20);

  IF length(v_base) < 3 THEN
    v_base := 'leitor';
  END IF;

  RETURN v_base;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_available_nickname(
  p_seed text,
  p_user_id uuid DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base text := public.normalize_profile_nickname(p_seed);
  v_candidate text;
  v_suffix integer := 0;
  v_suffix_text text;
BEGIN
  LOOP
    IF v_suffix = 0 THEN
      v_candidate := substring(v_base from 1 for 24);
    ELSE
      v_suffix_text := '_' || v_suffix::text;
      v_candidate := substring(v_base from 1 for greatest(3, 24 - length(v_suffix_text))) || v_suffix_text;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE lower(p.nickname) = lower(v_candidate)
        AND (p_user_id IS NULL OR p.id <> p_user_id)
    ) THEN
      RETURN v_candidate;
    END IF;

    v_suffix := v_suffix + 1;

    IF v_suffix > 9999 THEN
      RETURN substring(v_base from 1 for 15) || '_' || substring(replace(coalesce(p_user_id::text, gen_random_uuid()::text), '-', ''), 1, 8);
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_profile_nickname(p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nickname text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Cannot update another user nickname';
  END IF;

  SELECT p.nickname INTO v_nickname
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_nickname IS NOT NULL THEN
    RETURN v_nickname;
  END IF;

  UPDATE public.profiles p
  SET nickname = public.generate_available_nickname(coalesce(nullif(p.name, ''), 'leitor'), p_user_id)
  WHERE p.id = p_user_id
  RETURNING p.nickname INTO v_nickname;

  RETURN v_nickname;
END;
$$;

DO $$
DECLARE
  v_profile record;
BEGIN
  FOR v_profile IN
    SELECT id, name
    FROM public.profiles
    WHERE nickname IS NULL
    ORDER BY created_at NULLS LAST, id
  LOOP
    UPDATE public.profiles
    SET nickname = public.generate_available_nickname(coalesce(nullif(v_profile.name, ''), 'leitor'), v_profile.id)
    WHERE id = v_profile.id
      AND nickname IS NULL;
  END LOOP;
END;
$$;

CREATE TABLE IF NOT EXISTS public.friend_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'declined', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  CHECK (requester_id <> addressee_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_requester_idx
  ON public.friend_requests (requester_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS friend_requests_addressee_idx
  ON public.friend_requests (addressee_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS friend_requests_pending_pair_unique
  ON public.friend_requests (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.friendships (
  user_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);

CREATE INDEX IF NOT EXISTS friendships_user_b_idx
  ON public.friendships (user_b);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friend_requests_select_participant" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_insert_self" ON public.friend_requests;
DROP POLICY IF EXISTS "friend_requests_update_participant" ON public.friend_requests;
DROP POLICY IF EXISTS "friendships_select_participant" ON public.friendships;

CREATE POLICY "friend_requests_select_participant"
ON public.friend_requests
FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friend_requests_insert_self"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid() = requester_id AND requester_id <> addressee_id);

CREATE POLICY "friend_requests_update_participant"
ON public.friend_requests
FOR UPDATE
USING (auth.uid() = requester_id OR auth.uid() = addressee_id)
WITH CHECK (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "friendships_select_participant"
ON public.friendships
FOR SELECT
USING (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.are_friends(user_one uuid, user_two uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.friendships f
    WHERE f.user_a = least(user_one, user_two)
      AND f.user_b = greatest(user_one, user_two)
  );
$$;

DROP FUNCTION IF EXISTS public.get_user_profile();
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS TABLE (
  id uuid,
  name text,
  nickname text,
  avatar_url text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  PERFORM public.ensure_profile_nickname(auth.uid());

  RETURN QUERY
  SELECT p.id, p.name, p.nickname, p.avatar_url, p.created_at
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.update_user_profile(
  p_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.profiles
  SET
    name = COALESCE(p_name, name),
    avatar_url = COALESCE(p_avatar_url, avatar_url)
  WHERE id = auth.uid();

  PERFORM public.ensure_profile_nickname(auth.uid());
END;
$$;

CREATE OR REPLACE FUNCTION public.create_user_profile(p_user_id uuid, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name text := split_part(coalesce(p_email, 'leitor'), '@', 1);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'Cannot create a profile for another user';
  END IF;

  INSERT INTO public.profiles (id, name, nickname)
  VALUES (
    v_user_id,
    v_name,
    public.generate_available_nickname(v_name, v_user_id)
  )
  ON CONFLICT (id) DO UPDATE SET
    name = COALESCE(public.profiles.name, EXCLUDED.name),
    nickname = COALESCE(public.profiles.nickname, EXCLUDED.nickname);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_profile_nickname(p_nickname text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nickname text := lower(trim(coalesce(p_nickname, '')));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_nickname !~ '^[a-z0-9_]{3,24}$' THEN
    RAISE EXCEPTION 'Nickname must use 3-24 lowercase letters, numbers, or underscores';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE lower(p.nickname) = v_nickname
      AND p.id <> v_user_id
  ) THEN
    RAISE EXCEPTION 'Nickname is already in use';
  END IF;

  UPDATE public.profiles
  SET nickname = v_nickname
  WHERE id = v_user_id;

  RETURN v_nickname;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_nickname(p_nickname text)
RETURNS TABLE (
  user_id uuid,
  name text,
  nickname text,
  avatar_url text,
  friend_status text,
  request_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_nickname text := lower(trim(coalesce(p_nickname, '')));
  v_target_id uuid;
  v_request public.friend_requests%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.id INTO v_target_id
  FROM public.profiles p
  WHERE lower(p.nickname) = v_nickname
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RETURN;
  END IF;

  SELECT fr.* INTO v_request
  FROM public.friend_requests fr
  WHERE fr.status = 'pending'
    AND least(fr.requester_id, fr.addressee_id) = least(v_user_id, v_target_id)
    AND greatest(fr.requester_id, fr.addressee_id) = greatest(v_user_id, v_target_id)
  ORDER BY fr.created_at DESC
  LIMIT 1;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.nickname,
    p.avatar_url,
    CASE
      WHEN p.id = v_user_id THEN 'self'
      WHEN public.are_friends(v_user_id, p.id) THEN 'friends'
      WHEN v_request.id IS NOT NULL AND v_request.requester_id = v_user_id THEN 'request_sent'
      WHEN v_request.id IS NOT NULL AND v_request.addressee_id = v_user_id THEN 'request_received'
      ELSE 'none'
    END,
    v_request.id
  FROM public.profiles p
  WHERE p.id = v_target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_friend_request(p_nickname text)
RETURNS TABLE (
  request_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_target_id uuid;
  v_existing public.friend_requests%rowtype;
  v_request_id uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT p.id INTO v_target_id
  FROM public.profiles p
  WHERE lower(p.nickname) = lower(trim(coalesce(p_nickname, '')))
  LIMIT 1;

  IF v_target_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  IF v_target_id = v_user_id THEN
    RAISE EXCEPTION 'Cannot add yourself as a friend';
  END IF;

  IF public.are_friends(v_user_id, v_target_id) THEN
    RETURN QUERY SELECT NULL::uuid, 'friends'::text;
    RETURN;
  END IF;

  SELECT fr.* INTO v_existing
  FROM public.friend_requests fr
  WHERE fr.status = 'pending'
    AND least(fr.requester_id, fr.addressee_id) = least(v_user_id, v_target_id)
    AND greatest(fr.requester_id, fr.addressee_id) = greatest(v_user_id, v_target_id)
  ORDER BY fr.created_at DESC
  LIMIT 1;

  IF v_existing.id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_existing.id,
      CASE
        WHEN v_existing.requester_id = v_user_id THEN 'request_sent'
        ELSE 'request_received'
      END::text;
    RETURN;
  END IF;

  INSERT INTO public.friend_requests (requester_id, addressee_id)
  VALUES (v_user_id, v_target_id)
  RETURNING id INTO v_request_id;

  RETURN QUERY SELECT v_request_id, 'request_sent'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.accept_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_request public.friend_requests%rowtype;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_request
  FROM public.friend_requests
  WHERE id = p_request_id
    AND addressee_id = v_user_id
    AND status = 'pending'
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;

  UPDATE public.friend_requests
  SET status = 'accepted', responded_at = now()
  WHERE id = p_request_id;

  INSERT INTO public.friendships (user_a, user_b)
  VALUES (
    least(v_request.requester_id, v_request.addressee_id),
    greatest(v_request.requester_id, v_request.addressee_id)
  )
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.decline_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.friend_requests
  SET status = 'declined', responded_at = now()
  WHERE id = p_request_id
    AND addressee_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_friend_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.friend_requests
  SET status = 'canceled', responded_at = now()
  WHERE id = p_request_id
    AND requester_id = auth.uid()
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_friend(p_friend_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  DELETE FROM public.friendships
  WHERE user_a = least(v_user_id, p_friend_id)
    AND user_b = greatest(v_user_id, p_friend_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_requests()
RETURNS TABLE (
  id uuid,
  requester_id uuid,
  addressee_id uuid,
  other_user_id uuid,
  other_name text,
  other_nickname text,
  other_avatar_url text,
  status text,
  direction text,
  created_at timestamptz,
  responded_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    fr.id,
    fr.requester_id,
    fr.addressee_id,
    other_profile.id,
    other_profile.name,
    other_profile.nickname,
    other_profile.avatar_url,
    fr.status,
    CASE WHEN fr.addressee_id = v_user_id THEN 'incoming' ELSE 'outgoing' END,
    fr.created_at,
    fr.responded_at
  FROM public.friend_requests fr
  JOIN public.profiles other_profile
    ON other_profile.id = CASE
      WHEN fr.requester_id = v_user_id THEN fr.addressee_id
      ELSE fr.requester_id
    END
  WHERE fr.status = 'pending'
    AND (fr.requester_id = v_user_id OR fr.addressee_id = v_user_id)
  ORDER BY fr.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friends()
RETURNS TABLE (
  user_id uuid,
  name text,
  nickname text,
  avatar_url text,
  friends_since timestamptz,
  total_pages bigint,
  today_pages bigint,
  this_week_pages bigint,
  month_pages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.nickname,
    p.avatar_url,
    f.created_at,
    coalesce(rs.total_pages, 0)::bigint,
    coalesce(rs.today_pages, 0)::bigint,
    coalesce(rs.this_week_pages, 0)::bigint,
    coalesce(rs.month_pages, 0)::bigint
  FROM public.friendships f
  JOIN public.profiles p
    ON p.id = CASE WHEN f.user_a = v_user_id THEN f.user_b ELSE f.user_a END
  LEFT JOIN public.reading_stats rs
    ON rs.user_id = p.id
  WHERE f.user_a = v_user_id OR f.user_b = v_user_id
  ORDER BY p.name NULLS LAST, p.nickname;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_profile(p_user_id uuid)
RETURNS TABLE (
  user_id uuid,
  name text,
  nickname text,
  avatar_url text,
  friends_since timestamptz,
  total_pages bigint,
  today_pages bigint,
  this_week_pages bigint,
  month_pages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id <> v_user_id AND NOT public.are_friends(v_user_id, p_user_id) THEN
    RAISE EXCEPTION 'You can only view friend profiles';
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.nickname,
    p.avatar_url,
    CASE
      WHEN p.id = v_user_id THEN NULL::timestamptz
      ELSE f.created_at
    END,
    coalesce(rs.total_pages, 0)::bigint,
    coalesce(rs.today_pages, 0)::bigint,
    coalesce(rs.this_week_pages, 0)::bigint,
    coalesce(rs.month_pages, 0)::bigint
  FROM public.profiles p
  LEFT JOIN public.friendships f
    ON f.user_a = least(v_user_id, p_user_id)
   AND f.user_b = greatest(v_user_id, p_user_id)
  LEFT JOIN public.reading_stats rs
    ON rs.user_id = p.id
  WHERE p.id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_readings(p_user_id uuid)
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
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id <> v_user_id AND NOT public.are_friends(v_user_id, p_user_id) THEN
    RAISE EXCEPTION 'You can only view readings from friends';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    CASE WHEN r.user_id = v_user_id THEN r.source_name ELSE ''::text END,
    r.pages,
    r.reading_date,
    r.reading_time,
    r.created_at,
    r.category_id,
    CASE WHEN r.user_id = v_user_id THEN r.book_id ELSE NULL::uuid END
  FROM public.readings r
  WHERE r.user_id = p_user_id
  ORDER BY r.reading_date DESC, r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_friend_ranking(p_period text DEFAULT 'all_time')
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  RETURN QUERY
  WITH allowed_users AS (
    SELECT v_user_id AS id
    UNION
    SELECT CASE WHEN f.user_a = v_user_id THEN f.user_b ELSE f.user_a END
    FROM public.friendships f
    WHERE f.user_a = v_user_id OR f.user_b = v_user_id
  )
  SELECT
    p.id,
    coalesce(p.name, p.nickname, 'Usuario'),
    p.nickname,
    p.avatar_url,
    coalesce(rs.total_pages, 0)::bigint,
    coalesce(rs.today_pages, 0)::bigint,
    coalesce(rs.this_week_pages, 0)::bigint,
    coalesce(rs.month_pages, 0)::bigint,
    p.id = v_user_id
  FROM allowed_users au
  JOIN public.profiles p ON p.id = au.id
  LEFT JOIN public.reading_stats rs ON rs.user_id = p.id
  ORDER BY
    CASE p_period
      WHEN 'today' THEN coalesce(rs.today_pages, 0)
      WHEN 'this_week' THEN coalesce(rs.this_week_pages, 0)
      WHEN 'this_month' THEN coalesce(rs.month_pages, 0)
      ELSE coalesce(rs.total_pages, 0)
    END DESC,
    p.name NULLS LAST,
    p.nickname
  LIMIT 10;
END;
$$;

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
  v_start_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  v_brazil_today := (CURRENT_DATE AT TIME ZONE 'America/Sao_Paulo')::date;

  v_start_date := CASE p_period
    WHEN 'today' THEN v_brazil_today
    WHEN 'this_week' THEN date_trunc('week', v_brazil_today)::date
    WHEN 'this_month' THEN date_trunc('month', v_brazil_today)::date
    ELSE '1970-01-01'::date
  END;

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
      coalesce(sum(r.pages), 0)::bigint AS pages
    FROM allowed_users au
    LEFT JOIN public.readings r
      ON r.user_id = au.id
     AND (p_category_id IS NULL OR r.category_id = p_category_id)
     AND (p_period = 'all_time' OR r.reading_date >= v_start_date)
    GROUP BY au.id
  )
  SELECT
    p.id,
    coalesce(p.name, p.nickname, 'Usuario'),
    p.nickname,
    p.avatar_url,
    ranked.pages,
    ranked.pages,
    ranked.pages,
    ranked.pages,
    p.id = v_user_id
  FROM ranked
  JOIN public.profiles p ON p.id = ranked.id
  ORDER BY ranked.pages DESC, p.name NULLS LAST, p.nickname
  LIMIT 10;
END;
$$;

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
  SELECT friend_rank.user_id, friend_rank.total_pages
  FROM public.get_friend_category_ranking(p_category_id, p_period) friend_rank;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.normalize_profile_nickname(text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.generate_available_nickname(text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ensure_profile_nickname(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_profile(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_profile(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_profile_nickname(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_user_by_nickname(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_friend_request(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decline_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_friend_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_requests() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friends() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_readings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_ranking(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_category_ranking(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_ranking(uuid, text) TO authenticated;

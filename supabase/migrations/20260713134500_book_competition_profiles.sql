CREATE TABLE IF NOT EXISTS public.book_competition_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  joined boolean NOT NULL DEFAULT false,
  page_goal integer NOT NULL DEFAULT 1000 CHECK (page_goal > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.book_competition_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own reading challenge profile"
ON public.book_competition_profiles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own reading challenge profile"
ON public.book_competition_profiles FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own reading challenge profile"
ON public.book_competition_profiles FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.book_competition_leaderboard()
RETURNS TABLE (display_name text, books_completed bigint, pages_read bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'קורא/ת Tabro') AS display_name,
    count(c.id) AS books_completed,
    coalesce(sum(c.page_count), 0) AS pages_read
  FROM public.book_competition_profiles cp
  LEFT JOIN public.book_competition_completions c ON c.user_id = cp.user_id AND c.joins_competition = true
  LEFT JOIN public.profiles p ON p.user_id = cp.user_id
  WHERE cp.joined = true
  GROUP BY cp.user_id, p.display_name, p.username
  ORDER BY pages_read DESC, books_completed DESC
  LIMIT 50;
$$;

GRANT SELECT, INSERT, UPDATE ON public.book_competition_profiles TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_competition_leaderboard() TO authenticated;

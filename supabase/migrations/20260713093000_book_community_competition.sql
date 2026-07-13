-- Community book catalog and challenge. Private reflections never leave the owner's row.
CREATE TABLE IF NOT EXISTS public.book_catalog_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(trim(title)) > 0),
  author text,
  page_count integer CHECK (page_count IS NULL OR page_count > 0),
  language_code text NOT NULL DEFAULT 'he',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS book_catalog_entries_unique_edition
  ON public.book_catalog_entries (lower(title), lower(coalesce(author, '')), lower(language_code));

ALTER TABLE public.book_catalog_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can browse shared book catalog"
ON public.book_catalog_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can contribute book catalog entries"
ON public.book_catalog_entries FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.book_competition_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  catalog_entry_id uuid REFERENCES public.book_catalog_entries(id) ON DELETE SET NULL,
  title text NOT NULL,
  author text,
  page_count integer NOT NULL CHECK (page_count > 0),
  language_code text NOT NULL DEFAULT 'he',
  completed_on date NOT NULL DEFAULT current_date,
  rating smallint CHECK (rating IS NULL OR rating BETWEEN 1 AND 5),
  private_reflection text,
  share_reflection boolean NOT NULL DEFAULT false,
  joins_competition boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS book_competition_completions_user_created
  ON public.book_competition_completions (user_id, created_at DESC);

ALTER TABLE public.book_competition_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own book completions"
ON public.book_competition_completions FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.record_book_competition_completion(
  p_title text,
  p_author text DEFAULT NULL,
  p_page_count integer DEFAULT NULL,
  p_language_code text DEFAULT 'he',
  p_completed_on date DEFAULT current_date,
  p_rating smallint DEFAULT NULL,
  p_private_reflection text DEFAULT NULL,
  p_share_reflection boolean DEFAULT false,
  p_joins_competition boolean DEFAULT false,
  p_add_to_catalog boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_catalog_id uuid;
  v_completion_id uuid;
BEGIN
  IF auth.uid() IS NULL OR nullif(trim(p_title), '') IS NULL OR coalesce(p_page_count, 0) <= 0 THEN
    RAISE EXCEPTION 'A signed-in user, title, and positive page count are required';
  END IF;

  IF p_add_to_catalog THEN
    INSERT INTO public.book_catalog_entries (title, author, page_count, language_code, created_by)
    VALUES (trim(p_title), nullif(trim(p_author), ''), p_page_count, coalesce(nullif(trim(p_language_code), ''), 'he'), auth.uid())
    ON CONFLICT (lower(title), lower(coalesce(author, '')), lower(language_code))
    DO UPDATE SET page_count = coalesce(public.book_catalog_entries.page_count, excluded.page_count)
    RETURNING id INTO v_catalog_id;
  END IF;

  INSERT INTO public.book_competition_completions (
    user_id, catalog_entry_id, title, author, page_count, language_code, completed_on,
    rating, private_reflection, share_reflection, joins_competition
  ) VALUES (
    auth.uid(), v_catalog_id, trim(p_title), nullif(trim(p_author), ''), p_page_count,
    coalesce(nullif(trim(p_language_code), ''), 'he'), coalesce(p_completed_on, current_date),
    p_rating, nullif(trim(p_private_reflection), ''), p_share_reflection, p_joins_competition
  ) RETURNING id INTO v_completion_id;

  RETURN v_completion_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.book_competition_leaderboard()
RETURNS TABLE (display_name text, books_completed bigint, pages_read bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    coalesce(nullif(p.display_name, ''), nullif(p.username, ''), 'קורא/ת Tabro') AS display_name,
    count(*) AS books_completed,
    coalesce(sum(c.page_count), 0) AS pages_read
  FROM public.book_competition_completions c
  LEFT JOIN public.profiles p ON p.user_id = c.user_id
  WHERE c.joins_competition = true
  GROUP BY p.display_name, p.username
  ORDER BY pages_read DESC, books_completed DESC
  LIMIT 50;
$$;

REVOKE ALL ON FUNCTION public.record_book_competition_completion(text, text, integer, text, date, smallint, text, boolean, boolean, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.book_competition_leaderboard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_book_competition_completion(text, text, integer, text, date, smallint, text, boolean, boolean, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.book_competition_leaderboard() TO authenticated;

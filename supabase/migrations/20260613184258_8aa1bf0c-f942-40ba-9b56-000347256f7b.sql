CREATE TABLE public.export_tokens (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX export_tokens_project_id_idx ON public.export_tokens(project_id);
CREATE INDEX export_tokens_user_id_idx ON public.export_tokens(user_id);

GRANT SELECT, INSERT, DELETE ON public.export_tokens TO authenticated;
GRANT ALL ON public.export_tokens TO service_role;

ALTER TABLE public.export_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own export tokens"
  ON public.export_tokens
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
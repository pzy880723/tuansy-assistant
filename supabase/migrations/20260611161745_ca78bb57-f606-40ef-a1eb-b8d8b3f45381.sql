CREATE TABLE public.copy_logics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '未命名文案逻辑',
  description TEXT NOT NULL DEFAULT '',
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX copy_logics_user_id_idx ON public.copy_logics(user_id);
CREATE UNIQUE INDEX copy_logics_one_active_per_user
  ON public.copy_logics(user_id) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_logics TO authenticated;
GRANT ALL ON public.copy_logics TO service_role;

ALTER TABLE public.copy_logics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own copy logics"
  ON public.copy_logics
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER copy_logics_touch_updated_at
  BEFORE UPDATE ON public.copy_logics
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
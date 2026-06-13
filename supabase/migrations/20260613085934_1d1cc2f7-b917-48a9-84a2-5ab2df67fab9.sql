
CREATE TABLE public.inbox_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'text', 'link')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'consumed', 'failed')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX inbox_items_user_status_idx ON public.inbox_items (user_id, status, created_at DESC);
CREATE INDEX inbox_items_project_status_idx ON public.inbox_items (project_id, status) WHERE status = 'pending';

GRANT ALL ON public.inbox_items TO service_role;

ALTER TABLE public.inbox_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to inbox items"
  ON public.inbox_items
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

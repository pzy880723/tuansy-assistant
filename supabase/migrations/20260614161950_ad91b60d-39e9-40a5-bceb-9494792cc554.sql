CREATE TABLE public.wechat_login_states (
  state TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','expired','error')),
  user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL,
  session_token TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 minutes'),
  consumed_at TIMESTAMPTZ
);

GRANT ALL ON public.wechat_login_states TO service_role;

ALTER TABLE public.wechat_login_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.wechat_login_states FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX wechat_login_states_expires_at_idx ON public.wechat_login_states (expires_at);
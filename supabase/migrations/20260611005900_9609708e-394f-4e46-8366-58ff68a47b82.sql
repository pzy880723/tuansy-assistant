CREATE TABLE public.app_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);
GRANT ALL ON public.app_sessions TO service_role;
ALTER TABLE public.app_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX app_sessions_user_id_idx ON public.app_sessions (user_id);
CREATE INDEX app_sessions_token_hash_idx ON public.app_sessions (token_hash);
CREATE INDEX app_sessions_active_expires_idx ON public.app_sessions (expires_at) WHERE revoked_at IS NULL;

CREATE TABLE public.sms_verification_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  code_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  provider text NOT NULL DEFAULT 'tencent',
  provider_request_id text,
  error_message text
);
GRANT ALL ON public.sms_verification_codes TO service_role;
ALTER TABLE public.sms_verification_codes ENABLE ROW LEVEL SECURITY;

CREATE INDEX sms_verification_codes_phone_idx ON public.sms_verification_codes (phone, created_at DESC);
CREATE INDEX sms_verification_codes_active_idx ON public.sms_verification_codes (phone, expires_at DESC) WHERE consumed_at IS NULL;

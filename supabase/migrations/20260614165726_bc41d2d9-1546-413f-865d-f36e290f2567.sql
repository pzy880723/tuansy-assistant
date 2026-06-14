ALTER TABLE public.sms_verification_codes
  ADD COLUMN IF NOT EXISTS delivery_status text NOT NULL DEFAULT 'sending',
  ADD COLUMN IF NOT EXISTS delivery_code text,
  ADD COLUMN IF NOT EXISTS delivery_message text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS report_received_at timestamptz;

CREATE INDEX IF NOT EXISTS sms_verification_codes_request_id_idx
  ON public.sms_verification_codes (provider_request_id);
CREATE INDEX IF NOT EXISTS sms_verification_codes_status_idx
  ON public.sms_verification_codes (delivery_status, created_at DESC);
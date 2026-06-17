DROP POLICY IF EXISTS "shipping_templates_public_read" ON public.shipping_templates;
REVOKE ALL ON public.shipping_templates FROM anon, authenticated;

-- 1. App users (mock auth identity)
CREATE TABLE public.app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text UNIQUE,
  wechat_openid text UNIQUE,
  nickname text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.app_users TO service_role;
ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (server functions) accesses this table.

-- 2. Add owner_id to user data tables
ALTER TABLE public.projects        ADD COLUMN owner_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.project_images  ADD COLUMN owner_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.copy_versions   ADD COLUMN owner_id uuid REFERENCES public.app_users(id) ON DELETE CASCADE;

CREATE INDEX projects_owner_idx       ON public.projects (owner_id);
CREATE INDEX project_images_owner_idx ON public.project_images (owner_id);
CREATE INDEX copy_versions_owner_idx  ON public.copy_versions (owner_id);

-- 3. Remove "public ALL" policies and lock writes to service_role only
DROP POLICY IF EXISTS "Public access projects"          ON public.projects;
DROP POLICY IF EXISTS "Public access project_images"    ON public.project_images;
DROP POLICY IF EXISTS "Public access copy_versions"     ON public.copy_versions;
DROP POLICY IF EXISTS "Public access shipping_templates" ON public.shipping_templates;

REVOKE ALL ON public.projects        FROM anon, authenticated;
REVOKE ALL ON public.project_images  FROM anon, authenticated;
REVOKE ALL ON public.copy_versions   FROM anon, authenticated;
REVOKE ALL ON public.shipping_templates FROM anon, authenticated;

GRANT ALL ON public.projects        TO service_role;
GRANT ALL ON public.project_images  TO service_role;
GRANT ALL ON public.copy_versions   TO service_role;
GRANT ALL ON public.shipping_templates TO service_role;

-- shipping_templates stays readable for any future direct client read (currently unused),
-- but writes only via service_role.
GRANT SELECT ON public.shipping_templates TO anon, authenticated;
CREATE POLICY "shipping_templates_public_read"
  ON public.shipping_templates
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 4. Storage: drop public write/update/delete on product-images bucket.
-- Reads stay public; uploads go through server functions (service_role bypasses RLS).
DROP POLICY IF EXISTS "Public insert product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public update product-images" ON storage.objects;
DROP POLICY IF EXISTS "Public delete product-images" ON storage.objects;

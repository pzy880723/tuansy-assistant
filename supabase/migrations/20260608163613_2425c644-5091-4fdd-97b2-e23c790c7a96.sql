
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '未命名项目',
  status TEXT NOT NULL DEFAULT 'draft',
  cover_image_url TEXT,
  intro JSONB NOT NULL DEFAULT '{"title":"","blocks":[]}'::jsonb,
  product JSONB NOT NULL DEFAULT '{"name":"","category":[],"description":"","tags":[],"weight":null,"video_url":"","spec_groups":[]}'::jsonb,
  skus JSONB NOT NULL DEFAULT '[]'::jsonb,
  delivery JSONB NOT NULL DEFAULT '{"express":{"enabled":true,"first_weight":1,"first_fee":0,"extra_weight":1,"extra_fee":0,"remote_enabled":false,"free_over":null},"local":{"enabled":false},"pickup":{"enabled":false}}'::jsonb,
  schedule JSONB NOT NULL DEFAULT '{"start_at":null,"end_at":null,"notify":false}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO anon, authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access projects" ON public.projects FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.project_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'product',
  analysis JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX project_images_project_idx ON public.project_images(project_id, sort_order);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_images TO anon, authenticated;
GRANT ALL ON public.project_images TO service_role;
ALTER TABLE public.project_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access project_images" ON public.project_images FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.shipping_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipping_templates TO anon, authenticated;
GRANT ALL ON public.shipping_templates TO service_role;
ALTER TABLE public.shipping_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access shipping_templates" ON public.shipping_templates FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE public.copy_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  label TEXT,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX copy_versions_project_idx ON public.copy_versions(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.copy_versions TO anon, authenticated;
GRANT ALL ON public.copy_versions TO service_role;
ALTER TABLE public.copy_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public access copy_versions" ON public.copy_versions FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER projects_touch_updated_at BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

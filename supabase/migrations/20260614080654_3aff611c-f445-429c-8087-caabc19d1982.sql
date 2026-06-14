ALTER TABLE public.project_images
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.project_images
  DROP CONSTRAINT IF EXISTS project_images_source_check;

ALTER TABLE public.project_images
  ADD CONSTRAINT project_images_source_check
  CHECK (source IN ('manual', 'ai', 'inbox'));
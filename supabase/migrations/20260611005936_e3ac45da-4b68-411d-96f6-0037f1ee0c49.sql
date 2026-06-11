CREATE POLICY "No direct client access to app sessions"
ON public.app_sessions
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "No direct client access to SMS codes"
ON public.sms_verification_codes
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_users' AND policyname = 'No direct client access to app users'
  ) THEN
    CREATE POLICY "No direct client access to app users"
    ON public.app_users
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'projects' AND policyname = 'No direct client access to projects'
  ) THEN
    CREATE POLICY "No direct client access to projects"
    ON public.projects
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'project_images' AND policyname = 'No direct client access to project images'
  ) THEN
    CREATE POLICY "No direct client access to project images"
    ON public.project_images
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'copy_versions' AND policyname = 'No direct client access to copy versions'
  ) THEN
    CREATE POLICY "No direct client access to copy versions"
    ON public.copy_versions
    FOR ALL
    TO anon, authenticated
    USING (false)
    WITH CHECK (false);
  END IF;
END $$;

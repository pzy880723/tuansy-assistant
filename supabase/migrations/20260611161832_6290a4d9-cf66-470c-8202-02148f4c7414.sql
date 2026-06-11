DROP POLICY IF EXISTS "Users manage their own copy logics" ON public.copy_logics;
CREATE POLICY "No direct client access to copy_logics"
  ON public.copy_logics
  FOR ALL
  USING (false)
  WITH CHECK (false);
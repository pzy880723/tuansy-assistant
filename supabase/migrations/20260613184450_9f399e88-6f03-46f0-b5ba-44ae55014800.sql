ALTER TABLE public.export_tokens DROP CONSTRAINT export_tokens_user_id_fkey;
ALTER TABLE public.export_tokens
  ADD CONSTRAINT export_tokens_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;

-- 项目使用自定义会话；RLS 的 auth.uid() 始终为空，但我们的 server fn 总走 supabaseAdmin，
-- 所以现有 policy 写法不影响 server 端，留作占位。
DROP POLICY IF EXISTS "Users manage own export tokens" ON public.export_tokens;
CREATE POLICY "Server-only access" ON public.export_tokens
  FOR ALL TO authenticated USING (false) WITH CHECK (false);
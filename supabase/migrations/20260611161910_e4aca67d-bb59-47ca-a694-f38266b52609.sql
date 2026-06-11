ALTER TABLE public.copy_logics DROP CONSTRAINT IF EXISTS copy_logics_user_id_fkey;
ALTER TABLE public.copy_logics
  ADD CONSTRAINT copy_logics_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.copy_logics DROP CONSTRAINT IF EXISTS copy_logics_one_active_per_user;
DROP INDEX IF EXISTS public.copy_logics_one_active_per_user;
alter table public.copy_logics
  add column if not exists formatting jsonb not null default '{}'::jsonb;
alter table public.preset_copy_logics
  add column if not exists formatting jsonb not null default '{}'::jsonb;
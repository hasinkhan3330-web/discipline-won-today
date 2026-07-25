alter table public.subscriptions replica identity full;
alter publication supabase_realtime add table public.subscriptions;
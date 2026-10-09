-- Supabase default grants can include privileges that bypass row-level policies.
revoke truncate, references, trigger on public.workspaces, public.candidates from authenticated, anon, public;

-- Remove inherited/default privileges that are unnecessary for the import pipeline.
-- Normal SELECT/INSERT/UPDATE/DELETE and owner RLS remain unchanged.
revoke truncate, references, trigger on public.pdf_imports from authenticated, anon, public;

-- Automatic data retention (daily, pg_cron). Removes data that already served its purpose; candidate
-- profiles are never removed automatically (inactive ones are flagged in "Saúde da base" for review).
-- Deadlines are documented in README.md ("Retenção automática") and must stay in sync with this file.
create extension if not exists pg_cron with schema pg_catalog;

-- Proof that retention ran: counts only, no personal data.
create table private.retention_runs(
 id bigserial primary key,
 ran_at timestamptz not null default now(),
 counts jsonb not null
);
alter table private.retention_runs enable row level security;
revoke all on private.retention_runs from public,anon,authenticated;

create function private.apply_retention() returns jsonb language plpgsql security definer set search_path='' as $$
declare n integer; counts jsonb:='{}';
begin
 -- 1. Applications never reviewed: 60 days after submission (the PDF goes with them by cascade).
 delete from public.candidate_applications where reviewed_at is null and created_at<now()-interval '60 days';
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('pendingApplications',n);
 -- 2. Accepted applications: their declared data already lives in the profile once the import is no longer running or retryable.
 delete from public.candidate_applications a where a.decision='accepted' and a.reviewed_at<now()-interval '30 days'
  and not exists(select 1 from public.pdf_imports p where p.id=a.import_id and p.status in('sending','processing','failed'));
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('acceptedApplications',n);
 -- 3. Minimal records of discarded applications: 12 months.
 delete from public.candidate_applications where decision='discarded' and reviewed_at<now()-interval '12 months';
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('discardedApplications',n);
 -- 4. Update-link answers were incorporated (or discarded) at review: clear them 30 days later.
 update public.candidate_refresh_links set response=null where response is not null and reviewed_at<now()-interval '30 days';
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('refreshAnswersCleared',n);
 -- 5. Update links: unanswered and closed for 90 days, or reviewed 12 months ago.
 delete from public.candidate_refresh_links where (submitted_at is null and least(coalesce(revoked_at,expires_at),expires_at)<now()-interval '90 days') or reviewed_at<now()-interval '12 months';
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('refreshLinks',n);
 -- 6. Application links closed for 90 days with nothing left referencing them.
 delete from public.application_links l where least(coalesce(l.revoked_at,l.expires_at),l.expires_at)<now()-interval '90 days'
  and not exists(select 1 from public.candidate_applications a where a.link_id=l.id);
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('applicationLinks',n);
 -- 7. Failed imports keep a PDF in storage: 30 days. The file is queued unless a profile uses it.
 insert into public.pending_file_deletions(owner,file_key)
  select p.owner,p.file_key from public.pdf_imports p where p.status='failed' and p.created_at<now()-interval '30 days'
  and not exists(select 1 from public.candidates c where c.owner=p.owner and c.file_key=p.file_key)
 on conflict do nothing;
 delete from public.pdf_imports where status='failed' and created_at<now()-interval '30 days';
 get diagnostics n=row_count; counts:=counts||jsonb_build_object('failedImports',n);
 -- 8. Housekeeping: attempt counters (2 days) and the retention log itself (24 months).
 delete from private.public_attempts where window_start<now()-interval '2 days';
 delete from private.retention_runs where ran_at<now()-interval '24 months';
 insert into private.retention_runs(counts) values(counts);
 return counts;
end;$$;
revoke all on function private.apply_retention() from public,anon,authenticated;

-- Daily at 03:15 UTC (00:15 in Brasília). Re-running this migration keeps a single job with this name.
select cron.schedule('talentia-retention','15 3 * * *','select private.apply_retention()');

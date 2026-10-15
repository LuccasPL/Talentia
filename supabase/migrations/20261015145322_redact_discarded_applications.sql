-- Generated with the Supabase CLI. Only future discards are changed.
-- Abort if historical discarded records need a separately reviewed cleanup.
do $$
begin
 if exists(select 1 from public.candidate_applications where decision='discarded') then
  raise exception 'Existing discarded applications require a reviewed cleanup before this migration';
 end if;
end;
$$;

alter table public.candidate_applications
 alter column response drop not null,
 alter column file_name drop not null,
 alter column file_sha256 drop not null,
 alter column file_size drop not null;

alter table public.candidate_applications add constraint application_retained_data check (
 case when decision='discarded' then
  reviewed_at is not null and response is null and file_name is null
  and file_sha256 is null and file_size is null and import_id is null
 else response is not null and file_name is not null
  and file_sha256 is not null and file_size is not null
 end
);

create or replace function private.review_application(application_id uuid,accept boolean,import_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if accept is null then raise exception 'decision required'; end if;
 if accept and import_id is null then raise exception 'import required'; end if;
 update public.candidate_applications a
 set reviewed_at=now(), decision=case when accept then 'accepted' else 'discarded' end,
  import_id=case when accept then review_application.import_id end,
  response=case when accept then a.response end,
  file_name=case when accept then a.file_name end,
  file_sha256=case when accept then a.file_sha256 end,
  file_size=case when accept then a.file_size end
 where a.id=review_application.application_id and a.owner=auth.uid() and a.reviewed_at is null;
 if not found then return false; end if;
 delete from private.application_files f where f.application_id=review_application.application_id;
 return true;
end;
$$;
revoke all on function private.review_application(uuid,boolean,uuid) from public,anon;
grant execute on function private.review_application(uuid,boolean,uuid) to authenticated;

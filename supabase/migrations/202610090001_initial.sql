begin;
create table public.workspaces (
 owner uuid primary key references auth.users(id) on delete cascade,
 jobs jsonb not null default '[]', records jsonb not null default '[]',
 version integer not null default 1 check(version>0), updated timestamptz not null default now(),
 check(jsonb_typeof(jobs)='array'), check(jsonb_typeof(records)='array')
);
create table public.candidates (
 owner uuid not null references auth.users(id) on delete cascade,
 id uuid not null, name text not null, city text not null default '', role text not null default '',
 file_key text, payload jsonb not null, created_at timestamptz not null default now(),
 primary key(owner,id), unique(owner,file_key),
 check(payload->>'id'=id::text),
 check(file_key is null or split_part(file_key,'/',1)=owner::text)
);
create index candidates_owner_city on public.candidates(owner,city);
alter table public.workspaces enable row level security;
alter table public.candidates enable row level security;
create policy workspace_owner on public.workspaces for all to authenticated
 using((select auth.uid())=owner) with check((select auth.uid())=owner);
create policy candidate_owner on public.candidates for all to authenticated
 using((select auth.uid())=owner) with check((select auth.uid())=owner);
revoke all on public.workspaces,public.candidates from anon;
grant select,insert,update,delete on public.workspaces,public.candidates to authenticated;
-- Atomic optimistic concurrency: a stale browser cannot overwrite newer changes.
create function public.save_workspace(expected_version integer,new_jobs jsonb,new_records jsonb)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare changed integer;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if jsonb_typeof(new_jobs)<>'array' or jsonb_typeof(new_records)<>'array'
 or jsonb_array_length(new_jobs)>100 or jsonb_array_length(new_jobs)<1
 or jsonb_array_length(new_records)>10000 then raise exception 'invalid workspace';end if;
 update public.workspaces set jobs=new_jobs,records=new_records,version=version+1,updated=now()
 where owner=auth.uid() and version=expected_version;
 get diagnostics changed=row_count;
 return changed=1;
end;$$;
revoke all on function public.save_workspace(integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_workspace(integer,jsonb,jsonb) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('curriculos','curriculos',false,4194304,array['application/pdf']);
create policy private_cv_read on storage.objects for select to authenticated
 using(bucket_id='curriculos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_cv_insert on storage.objects for insert to authenticated
 with check(bucket_id='curriculos' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_cv_delete on storage.objects for delete to authenticated
 using(bucket_id='curriculos' and (storage.foldername(name))[1]=(select auth.uid())::text);
commit;

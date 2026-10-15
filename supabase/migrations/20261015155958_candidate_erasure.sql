-- Permanent erasure of a candidate (LGPD request) in one transaction. The server prepares the workspace
-- JSON without the person (lib/candidate-erasure.ts); this function verifies it, deletes every related row
-- and queues the storage files, which the server removes right after (the bucket is outside the transaction).

-- Files to remove from the private bucket. Rows disappear once the server confirms the deletion.
create table public.pending_file_deletions(
 owner uuid not null references auth.users(id) on delete cascade,
 file_key text not null check(split_part(file_key,'/',1)=owner::text),
 created_at timestamptz not null default now(),
 primary key(owner,file_key)
);
alter table public.pending_file_deletions enable row level security;
revoke all on public.pending_file_deletions from public,anon,authenticated;
grant select,delete on public.pending_file_deletions to authenticated;
create policy pending_file_deletion_owner on public.pending_file_deletions for all to authenticated using((select auth.uid())=owner) with check((select auth.uid())=owner);

create function private.erase_candidate(expected_version integer,candidate_ids uuid[],new_jobs jsonb,new_records jsonb,rewritten jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); workspace_version integer; ids_text text[]; keys text[]; batches text[]; item jsonb; old jsonb;
begin
 if uid is null then raise exception 'authentication required'; end if;
 if candidate_ids is null or cardinality(candidate_ids)<1 or cardinality(candidate_ids)>50 then raise exception 'invalid candidates'; end if;
 if jsonb_typeof(new_jobs) is distinct from 'array' or jsonb_typeof(new_records) is distinct from 'array' or jsonb_typeof(rewritten) is distinct from 'array' then raise exception 'invalid data'; end if;
 if jsonb_array_length(new_jobs)<1 or jsonb_array_length(new_jobs)>100 or jsonb_array_length(new_records)>10000 or jsonb_array_length(rewritten)>500 then raise exception 'invalid workspace'; end if;
 select version into workspace_version from public.workspaces where owner=uid for update;
 if workspace_version is null or workspace_version<>expected_version then return null; end if;
 ids_text:=array(select unnest(candidate_ids)::text);
 perform 1 from public.candidates where owner=uid and id=any(candidate_ids) for update;
 if (select count(*) from public.candidates where owner=uid and id=any(candidate_ids))<>cardinality(candidate_ids) then return null; end if;
 -- The whole merge group must go: no remaining profile may point into it.
 if exists(select 1 from public.candidates where owner=uid and not(id=any(candidate_ids)) and (payload->>'mergedInto'=any(ids_text) or payload->>'cvSourceId'=any(ids_text))) then raise exception 'incomplete group'; end if;
 -- The submitted workspace must already be free of the person.
 if exists(select 1 from jsonb_array_elements(new_records) r where r->>'candidateId'=any(ids_text))
 or exists(select 1 from jsonb_array_elements(new_jobs) j,jsonb_array_elements(coalesce(j->'analyses','[]')) a where a->>'candidateId'=any(ids_text)) then raise exception 'person still in workspace'; end if;
 -- Other profiles may only lose merge-history snapshots of the person.
 for item in select * from jsonb_array_elements(rewritten) loop
  select payload into old from public.candidates where owner=uid and id::text=item->>'id' and not(id=any(candidate_ids)) for update;
  if old is null or item->'payload'->>'id' is distinct from item->>'id' or (item->'payload')-'mergeHistory' is distinct from old-'mergeHistory' then raise exception 'invalid rewrite'; end if;
  update public.candidates set payload=item->'payload' where owner=uid and id::text=item->>'id';
 end loop;
 if exists(select 1 from public.candidates c,jsonb_array_elements(coalesce(c.payload->'mergeHistory','[]')) h where c.owner=uid and not(c.id=any(candidate_ids)) and h->'candidate'->>'id'=any(ids_text)) then raise exception 'snapshots remain'; end if;

 keys:=array(select distinct k from (
  select file_key k from public.candidates where owner=uid and id=any(candidate_ids) and file_key is not null
  union select file_key from public.pdf_imports where owner=uid and candidate_id=any(candidate_ids)) s);
 batches:=array(select batch_id from public.pdf_imports where owner=uid and (candidate_id=any(candidate_ids) or file_key=any(keys)) and batch_id is not null);
 delete from public.candidate_applications where owner=uid and import_id in(select id from public.pdf_imports where owner=uid and (candidate_id=any(candidate_ids) or file_key=any(keys)));
 delete from public.pdf_imports where owner=uid and (candidate_id=any(candidate_ids) or file_key=any(keys));
 delete from public.candidates where owner=uid and id=any(candidate_ids); -- refresh links cascade
 insert into public.pending_file_deletions(owner,file_key) select uid,k from unnest(keys) k on conflict do nothing;
 update public.workspaces set jobs=new_jobs,records=new_records,version=version+1,updated=now() where owner=uid;
 return jsonb_build_object('fileKeys',to_jsonb(keys),'batchIds',to_jsonb(batches));
end;$$;
revoke all on function private.erase_candidate(integer,uuid[],jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function private.erase_candidate(integer,uuid[],jsonb,jsonb,jsonb) to authenticated;
create function public.erase_candidate(expected_version integer,candidate_ids uuid[],new_jobs jsonb,new_records jsonb,rewritten jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.erase_candidate(expected_version,candidate_ids,new_jobs,new_records,rewritten)$$;
revoke all on function public.erase_candidate(integer,uuid[],jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.erase_candidate(integer,uuid[],jsonb,jsonb,jsonb) to authenticated;

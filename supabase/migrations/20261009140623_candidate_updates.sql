create function public.update_candidate(expected_version integer,candidate_id uuid,new_payload jsonb,new_jobs jsonb,new_records jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare workspace_version integer; old_payload jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if jsonb_typeof(new_payload) is distinct from 'object' or jsonb_typeof(new_jobs) is distinct from 'array' or jsonb_typeof(new_records) is distinct from 'array' then raise exception 'invalid data'; end if;
 if jsonb_array_length(new_jobs)<1 or jsonb_array_length(new_jobs)>100 or jsonb_array_length(new_records)>10000 then raise exception 'invalid workspace'; end if;
 select version into workspace_version from public.workspaces where owner=auth.uid() for update;
 if workspace_version is null or workspace_version<>expected_version then return false; end if;
 select payload into old_payload from public.candidates where owner=auth.uid() and id=candidate_id for update;
 if old_payload is null then return false; end if;
 if new_payload->>'id' is distinct from candidate_id::text or new_payload->>'fileKey' is distinct from old_payload->>'fileKey'
 or new_payload->>'source' is distinct from old_payload->>'source'
 or new_payload->>'originalText' is distinct from coalesce(old_payload->>'originalText',old_payload->>'text')
 or new_payload->>'updated' is distinct from old_payload->>'updated' then raise exception 'immutable source changed'; end if;
 update public.candidates set payload=new_payload,name=new_payload->>'name',city=coalesce(new_payload->>'city',''),role=coalesce(new_payload->>'role','') where owner=auth.uid() and id=candidate_id;
 update public.workspaces set jobs=new_jobs,records=new_records,version=version+1,updated=now() where owner=auth.uid();
 return true;
end;$$;
revoke all on function public.update_candidate(integer,uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.update_candidate(integer,uuid,jsonb,jsonb,jsonb) to authenticated;
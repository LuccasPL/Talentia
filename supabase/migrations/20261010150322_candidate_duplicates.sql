create function public.merge_candidates(expected_version integer,primary_id uuid,secondary_id uuid,new_payload jsonb,new_jobs jsonb,new_records jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare workspace_version integer; original jsonb; secondary jsonb;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if primary_id=secondary_id then raise exception 'different profiles required';end if;
 if jsonb_typeof(new_payload) is distinct from 'object' or jsonb_typeof(new_jobs) is distinct from 'array' or jsonb_typeof(new_records) is distinct from 'array' then raise exception 'invalid data';end if;
 if jsonb_array_length(new_jobs)<1 or jsonb_array_length(new_jobs)>100 or jsonb_array_length(new_records)>10000 then raise exception 'invalid workspace';end if;
 select version into workspace_version from public.workspaces where owner=auth.uid() for update;
 if workspace_version is null or workspace_version<>expected_version then return false;end if;
 select payload into original from public.candidates where owner=auth.uid() and id=primary_id for update;
 select payload into secondary from public.candidates where owner=auth.uid() and id=secondary_id for update;
 if original is null or secondary is null or original ? 'mergedInto' or secondary ? 'mergedInto' then return false;end if;
 if exists(select 1 from public.candidates where owner=auth.uid() and payload->>'mergedInto'=secondary_id::text) then raise exception 'keep existing principal';end if;
 if new_payload->>'id' is distinct from primary_id::text or new_payload->>'fileKey' is distinct from original->>'fileKey'
 or new_payload->>'source' is distinct from original->>'source' or new_payload->>'updated' is distinct from original->>'updated'
 or new_payload->>'originalText' is distinct from coalesce(original->>'originalText',original->>'text') or new_payload ? 'mergedInto' then raise exception 'immutable source changed';end if;
 if new_payload ? 'cvSourceId' and not exists(select 1 from public.candidates where owner=auth.uid() and id::text=new_payload->>'cvSourceId') then raise exception 'invalid curriculum';end if;
 update public.candidates set payload=new_payload,name=new_payload->>'name',city=coalesce(new_payload->>'city',''),role=coalesce(new_payload->>'role','') where owner=auth.uid() and id=primary_id;
 update public.candidates set payload=secondary||jsonb_build_object('mergedInto',primary_id::text,'mergedAt',now()) where owner=auth.uid() and id=secondary_id;
 update public.workspaces set jobs=new_jobs,records=new_records,version=version+1,updated=now() where owner=auth.uid();
 return true;
end;$$;
revoke all on function public.merge_candidates(integer,uuid,uuid,jsonb,jsonb,jsonb) from public,anon;
grant execute on function public.merge_candidates(integer,uuid,uuid,jsonb,jsonb,jsonb) to authenticated;

create function public.restore_candidate(expected_version integer,candidate_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
declare workspace_version integer;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select version into workspace_version from public.workspaces where owner=auth.uid() for update;
 if workspace_version is null or workspace_version<>expected_version then return false;end if;
 update public.candidates set payload=payload-'mergedInto'-'mergedAt' where owner=auth.uid() and id=candidate_id and payload ? 'mergedInto';
 if not found then return false;end if;
 update public.workspaces set version=version+1,updated=now() where owner=auth.uid();
 return true;
end;$$;
revoke all on function public.restore_candidate(integer,uuid) from public,anon;
grant execute on function public.restore_candidate(integer,uuid) to authenticated;

-- All temporary edits are rolled back. No persistent fixture accounts or clients.
begin;
select set_config('request.jwt.claim.sub',(select owner::text from public.workspaces order by owner limit 1),true);
set local role authenticated;
do $$
declare original public.workspaces%rowtype; changed public.workspaces%rowtype; fixture jsonb;
begin
 select * into original from public.workspaces where owner=auth.uid();
 if original.owner is null then raise exception 'test needs an existing workspace'; end if;
 fixture:=original.clients||jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'name','Cliente temporário com rollback','contact','','email','','phone','','notes','','archived',false,'updated',now()));
 if not public.save_clients(original.version,fixture) then raise exception 'save failed'; end if;
 select * into changed from public.workspaces where owner=auth.uid();
 if changed.version<>original.version+1 or changed.jobs<>original.jobs or changed.records<>original.records or changed.clients<>fixture then raise exception 'unrelated records changed'; end if;
 if public.save_clients(original.version,fixture) then raise exception 'stale update accepted'; end if;
 begin
  perform public.save_clients(changed.version,original.clients);
  raise exception 'removal unexpectedly accepted';
 exception when raise_exception then
  if sqlerrm<>'archive clients to preserve history' then raise; end if;
 end;
 fixture:=jsonb_set(fixture,array[(jsonb_array_length(fixture)-1)::text,'archived'],'true'::jsonb);
 if not public.save_clients(changed.version,fixture) then raise exception 'archive failed'; end if;
 if exists(select 1 from public.workspaces where owner<>auth.uid()) then raise exception 'foreign workspace exposed'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if public.save_clients(1,'[]'::jsonb) then raise exception 'foreign update accepted'; end if;
 if exists(select 1 from public.workspaces) then raise exception 'unknown owner can read clients'; end if;
 if has_function_privilege('anon','public.save_clients(integer,jsonb)','execute') then raise exception 'anonymous write enabled'; end if;
end $$;
rollback;

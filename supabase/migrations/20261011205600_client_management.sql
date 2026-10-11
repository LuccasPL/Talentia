begin;
alter table public.workspaces add column clients jsonb not null default '[]'::jsonb
 check(jsonb_typeof(clients)='array' and jsonb_array_length(clients)<=300);
create function public.save_clients(expected_version integer,new_clients jsonb)
returns boolean language plpgsql security invoker set search_path='' as $$
declare previous jsonb; previous_version integer;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if jsonb_typeof(new_clients) is distinct from 'array' or jsonb_array_length(new_clients)>300 then raise exception 'invalid clients'; end if;
 if exists(select 1 from jsonb_array_elements(new_clients) c where jsonb_typeof(c) is distinct from 'object' or length(coalesce(c->>'id',''))<>36 or length(coalesce(c->>'name','')) not between 2 and 200 or jsonb_typeof(c->'archived') is distinct from 'boolean') then raise exception 'invalid client'; end if;
 if (select count(*) from jsonb_array_elements(new_clients))<>(select count(distinct c->>'id') from jsonb_array_elements(new_clients)c) then raise exception 'duplicate clients'; end if;
 select clients,version into previous,previous_version from public.workspaces where owner=auth.uid() for update;
 if previous_version is null or previous_version<>expected_version then return false; end if;
 if exists(select 1 from jsonb_array_elements(previous) c where not exists(select 1 from jsonb_array_elements(new_clients) n where n->>'id'=c->>'id')) then raise exception 'archive clients to preserve history'; end if;
 update public.workspaces set clients=new_clients,version=version+1,updated=now() where owner=auth.uid();
 return true;
end;$$;
revoke all on function public.save_clients(integer,jsonb) from public,anon;
grant execute on function public.save_clients(integer,jsonb) to authenticated;
comment on column public.workspaces.clients is 'Private client directory; inherits workspace owner RLS and optimistic version.';
commit;

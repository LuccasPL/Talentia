begin;
update storage.buckets set file_size_limit=2097152 where id='curriculos';
create table public.pdf_imports (
 id uuid primary key, owner uuid not null references auth.users(id) on delete cascade,
 source text not null check(length(source)<=300), file_key text not null,
 status text not null check(status in ('sending','processing','completed','failed')),
 batch_id text, candidate_id uuid not null, error text not null default '',
 created_at timestamptz not null default now(), checked_at timestamptz,
 unique(owner,file_key), check(split_part(file_key,'/',1)=owner::text)
);
create index pdf_imports_owner_pending on public.pdf_imports(owner,status,checked_at);
alter table public.pdf_imports enable row level security;
create policy pdf_import_owner on public.pdf_imports for all to authenticated
 using((select auth.uid())=owner) with check((select auth.uid())=owner);
revoke all on public.pdf_imports from public,anon;
grant select,insert,update,delete on public.pdf_imports to authenticated;
create function public.complete_pdf_import(import_id uuid,new_payload jsonb)
 returns boolean language plpgsql security invoker set search_path='' as $$
declare item public.pdf_imports;
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 select * into item from public.pdf_imports where id=import_id and owner=auth.uid() for update;
 if not found then return false;end if;
 if item.status='completed' then return true;end if;
 if item.status<>'processing' or new_payload->>'id' is distinct from item.candidate_id::text
 or new_payload->>'fileKey' is distinct from item.file_key then raise exception 'invalid import';end if;
 insert into public.candidates(owner,id,name,city,role,file_key,payload)
 values(auth.uid(),item.candidate_id,new_payload->>'name',coalesce(new_payload->>'city',''),coalesce(new_payload->>'role',''),item.file_key,new_payload);
 update public.pdf_imports set status='completed',error='' where id=import_id and owner=auth.uid();
 return true;
end;$$;
revoke all on function public.complete_pdf_import(uuid,jsonb) from public,anon;
grant execute on function public.complete_pdf_import(uuid,jsonb) to authenticated;
commit;

-- Application links: anyone holding a vacancy link may send declared data and one PDF.
-- Submissions wait in a private queue; nothing reaches the talent pool before the owner accepts it.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon,authenticated;

create table public.application_links(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 job_id text not null, token_hash text not null unique, context jsonb not null,
 created_at timestamptz not null default now(), expires_at timestamptz not null, revoked_at timestamptz,
 max_submissions integer not null check(max_submissions between 1 and 200), submission_count integer not null default 0,
 access_window timestamptz not null default now(), access_count integer not null default 0,
 submit_window timestamptz not null default now(), submit_count integer not null default 0
);
create index application_links_owner on public.application_links(owner,created_at desc);
alter table public.application_links enable row level security;
revoke all on public.application_links from public,anon,authenticated;
grant select(id,owner,job_id,context,created_at,expires_at,revoked_at,max_submissions,submission_count) on public.application_links to authenticated;
create policy application_link_owner_read on public.application_links for select to authenticated using((select auth.uid())=owner);

create table public.candidate_applications(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 link_id uuid not null references public.application_links(id) on delete cascade,
 job_id text not null, job_title text not null, response jsonb not null,
 file_name text not null check(length(file_name) between 1 and 300),
 file_sha256 text not null check(file_sha256 ~ '^[a-f0-9]{64}$'),
 file_size integer not null check(file_size between 1 and 2097152),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 decision text check(decision in ('accepted','discarded')), import_id uuid,
 unique(link_id,file_sha256)
);
create index candidate_applications_pending on public.candidate_applications(owner,reviewed_at,created_at desc);
alter table public.candidate_applications enable row level security;
revoke all on public.candidate_applications from public,anon,authenticated;
grant select on public.candidate_applications to authenticated;
create policy candidate_application_owner_read on public.candidate_applications for select to authenticated using((select auth.uid())=owner);

-- PDFs stay outside every exposed schema until the owner accepts or discards the application.
create table private.application_files(
 application_id uuid primary key references public.candidate_applications(id) on delete cascade,
 content bytea not null
);
alter table private.application_files enable row level security;
revoke all on private.application_files from public,anon,authenticated;

create function private.issue_application_link(job_id text,recruiter text,days integer,max_submissions integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); j jsonb; token text; link_id uuid; expiry timestamptz;
begin
 if uid is null then raise exception 'authentication required'; end if;
 if days not in (7,14,30) or max_submissions not in (10,50,200) or length(trim(recruiter))<2 or length(recruiter)>200 then raise exception 'invalid input'; end if;
 perform 1 from public.workspaces w where w.owner=uid for update;
 select item into j from public.workspaces w, lateral jsonb_array_elements(w.jobs) item where w.owner=uid and item->>'id'=job_id;
 if j is null then raise exception 'unavailable job'; end if;
 if (select count(*) from public.application_links l where l.owner=uid and l.revoked_at is null and l.expires_at>now())>=20 then raise exception 'too many links'; end if;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); expiry:=now()+make_interval(days=>days);
 insert into public.application_links(owner,job_id,token_hash,context,expires_at,max_submissions)
 values(uid,job_id,encode(sha256(convert_to(token,'UTF8')),'hex'),jsonb_build_object('title',j->>'title','recruiter',trim(recruiter),'conditions',coalesce(j->'conditions','{}'::jsonb)),expiry,max_submissions) returning id into link_id;
 return jsonb_build_object('id',link_id,'token',token,'expiresAt',expiry);
end;$$;

-- Returns the public vacancy snapshot, or null when the link cannot receive applications.
create function private.access_application_link(token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.application_links;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into link from public.application_links l where l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if link.id is null or link.revoked_at is not null or link.expires_at<=now() or link.submission_count>=link.max_submissions
 or not exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.jobs) j where w.owner=link.owner and j->>'id'=link.job_id) then return null; end if;
 if link.access_window<=now()-interval '1 hour' then link.access_count:=0;link.access_window:=now();end if;
 if link.access_count>=600 then return null;end if;
 update public.application_links set access_count=link.access_count+1,access_window=link.access_window where id=link.id;
 return jsonb_build_object('context',link.context,'expiresAt',link.expires_at);
end;$$;

create function private.submit_application(token text,answer jsonb,file_name text,file_base64 text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.application_links; content bytea; digest text; keys integer; app_id uuid;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into link from public.application_links l where l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if link.id is null or link.revoked_at is not null or link.expires_at<=now() or link.submission_count>=link.max_submissions
 or not exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.jobs) j where w.owner=link.owner and j->>'id'=link.job_id) then return null; end if;
 if link.submit_window<=now()-interval '1 hour' then link.submit_count:=0;link.submit_window:=now();end if;
 -- Bounds abuse of a widely shared link and the size of the private queue.
 if link.submit_count>=30 or (select count(*) from public.candidate_applications a where a.owner=link.owner and a.reviewed_at is null)>=100 then return null; end if;
 if jsonb_typeof(answer) is distinct from 'object' or octet_length(answer::text)>8000 then raise exception 'invalid answer'; end if;
 select count(*) into keys from jsonb_object_keys(answer);
 if keys<>7 or not(answer ?& array['name','email','phone','city','role','message','consent']) then raise exception 'invalid fields'; end if;
 if exists(select 1 from jsonb_each(answer) a where a.key<>'consent' and jsonb_typeof(a.value)<>'string')
 or answer->'consent' is distinct from 'true'::jsonb
 or length(answer->>'name') not between 2 and 200 or length(answer->>'email')>300 or length(answer->>'phone')>100
 or length(answer->>'city') not between 2 and 300 or length(answer->>'role')>300 or length(answer->>'message')>2000
 or (answer->>'phone'='' and answer->>'email'='') then raise exception 'invalid answer'; end if;
 if file_name is null or length(file_name) not between 1 and 300 or file_base64 is null or length(file_base64)>2796204 then raise exception 'invalid file'; end if;
 content:=decode(file_base64,'base64');
 if octet_length(content) not between 5 and 2097152 or substring(content from 1 for 5)<>'\x255044462d'::bytea then raise exception 'invalid file'; end if;
 digest:=encode(sha256(content),'hex');
 -- Resending the same PDF through the same link is idempotent and does not consume the quota.
 if exists(select 1 from public.candidate_applications a where a.link_id=link.id and a.file_sha256=digest) then return jsonb_build_object('received',true); end if;
 insert into public.candidate_applications(owner,link_id,job_id,job_title,response,file_name,file_sha256,file_size)
 values(link.owner,link.id,link.job_id,coalesce(link.context->>'title',''),answer,file_name,digest,octet_length(content)) returning id into app_id;
 insert into private.application_files(application_id,content) values(app_id,content);
 update public.application_links set submission_count=link.submission_count+1,submit_count=link.submit_count+1,submit_window=link.submit_window where id=link.id;
 return jsonb_build_object('received',true);
end;$$;

create function private.application_file(application_id uuid)
returns text language plpgsql security definer set search_path='' as $$
declare result text;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select encode(f.content,'base64') into result from private.application_files f join public.candidate_applications a on a.id=f.application_id
 where a.id=application_file.application_id and a.owner=auth.uid() and a.reviewed_at is null;
 return result;
end;$$;

create function private.review_application(application_id uuid,accept boolean,import_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 if accept and import_id is null then raise exception 'import required'; end if;
 update public.candidate_applications a set reviewed_at=now(),decision=case when accept then 'accepted' else 'discarded' end,import_id=case when accept then review_application.import_id end
 where a.id=review_application.application_id and a.owner=auth.uid() and a.reviewed_at is null;
 if not found then return false; end if;
 delete from private.application_files f where f.application_id=review_application.application_id;
 return true;
end;$$;

create function private.revoke_application_link(link_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 update public.application_links set revoked_at=now() where id=link_id and owner=auth.uid() and revoked_at is null;
 return found;
end;$$;

revoke all on function private.issue_application_link(text,text,integer,integer),private.access_application_link(text),private.submit_application(text,jsonb,text,text),private.application_file(uuid),private.review_application(uuid,boolean,uuid),private.revoke_application_link(uuid) from public,anon,authenticated;
grant execute on function private.issue_application_link(text,text,integer,integer),private.application_file(uuid),private.review_application(uuid,boolean,uuid),private.revoke_application_link(uuid) to authenticated;
grant execute on function private.access_application_link(text),private.submit_application(text,jsonb,text,text) to anon;

-- Public wrappers are invokers; privileged routines stay outside the exposed schema.
create function public.issue_application_link(job_id text,recruiter text,days integer,max_submissions integer) returns jsonb language sql security invoker set search_path='' as $$select private.issue_application_link(job_id,recruiter,days,max_submissions)$$;
create function public.access_application_link(token text) returns jsonb language sql security invoker set search_path='' as $$select private.access_application_link(token)$$;
create function public.submit_application(token text,answer jsonb,file_name text,file_base64 text) returns jsonb language sql security invoker set search_path='' as $$select private.submit_application(token,answer,file_name,file_base64)$$;
create function public.application_file(application_id uuid) returns text language sql security invoker set search_path='' as $$select private.application_file(application_id)$$;
create function public.review_application(application_id uuid,accept boolean,import_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.review_application(application_id,accept,import_id)$$;
create function public.revoke_application_link(link_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.revoke_application_link(link_id)$$;
revoke all on function public.issue_application_link(text,text,integer,integer),public.access_application_link(text),public.submit_application(text,jsonb,text,text),public.application_file(uuid),public.review_application(uuid,boolean,uuid),public.revoke_application_link(uuid) from public,anon,authenticated;
grant execute on function public.issue_application_link(text,text,integer,integer),public.application_file(uuid),public.review_application(uuid,boolean,uuid),public.revoke_application_link(uuid) to authenticated;
grant execute on function public.access_application_link(text),public.submit_application(text,jsonb,text,text) to anon;

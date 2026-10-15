-- Phase A of the public application gateway. The anon key is public (it ships to browsers), so the
-- application entry points must not trust "anon" alone: they now require a server-held gateway key,
-- count attempts per hashed client before any validation, and serialize the pending quota per owner.
-- The previous anon functions stay until the new site is deployed; phase B revokes them.

-- Only the SHA-256 of the gateway key lives in the database. The key itself is a Vercel env var.
create table private.gateway_keys(
 purpose text primary key check(purpose in ('public-applications')),
 key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'),
 created_at timestamptz not null default now()
);
alter table private.gateway_keys enable row level security;
revoke all on private.gateway_keys from public,anon,authenticated;

-- Hourly attempt counters per HMAC of the client IP (computed by the server; the raw IP is never stored).
create table private.public_attempts(
 client_hash text not null check(client_hash ~ '^[a-f0-9]{64}$'),
 action text not null check(action in ('view','submit')),
 window_start timestamptz not null,
 hits integer not null default 0,
 primary key(client_hash,action,window_start)
);
create index public_attempts_window on private.public_attempts(window_start);
alter table private.public_attempts enable row level security;
revoke all on private.public_attempts from public,anon,authenticated;

create function private.gateway_allows(gateway_key text) returns boolean language sql stable security definer set search_path='' as $$
 select gateway_key is not null and length(gateway_key) between 32 and 200 and exists(
  select 1 from private.gateway_keys k where k.purpose='public-applications' and k.key_hash=encode(sha256(convert_to(gateway_key,'UTF8')),'hex'))
$$;

-- Counts the attempt and reports whether it is within the hourly limit. Callers must not raise afterwards
-- (a raised exception would roll the counter back), so validation failures are returned as values.
create function private.count_public_attempt(p_client text,p_action text,max_hits integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits_now integer;
begin
 insert into private.public_attempts as p(client_hash,action,window_start,hits)
 values(p_client,p_action,date_trunc('hour',now()),1)
 on conflict(client_hash,action,window_start) do update set hits=p.hits+1 returning p.hits into hits_now;
 if random()<0.02 then delete from private.public_attempts where window_start<now()-interval '2 days'; end if;
 return hits_now<=max_hits;
end;$$;

create function private.application_view(token text,gateway_key text,client_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.application_links;
begin
 if not private.gateway_allows(gateway_key) then return jsonb_build_object('error','gateway'); end if;
 if client_hash is null or client_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','client'); end if;
 if not private.count_public_attempt(client_hash,'view',60) then return jsonb_build_object('error','rate'); end if;
 if token is null or token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','unavailable'); end if;
 select * into link from public.application_links l where l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if link.id is null or link.revoked_at is not null or link.expires_at<=now() or link.submission_count>=link.max_submissions
 or not exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.jobs) j where w.owner=link.owner and j->>'id'=link.job_id) then return jsonb_build_object('error','unavailable'); end if;
 if link.access_window<=now()-interval '1 hour' then link.access_count:=0;link.access_window:=now();end if;
 if link.access_count>=600 then return jsonb_build_object('error','unavailable');end if;
 update public.application_links set access_count=link.access_count+1,access_window=link.access_window where id=link.id;
 return jsonb_build_object('context',link.context,'expiresAt',link.expires_at);
end;$$;

create function private.application_submit(token text,answer jsonb,file_name text,file_base64 text,gateway_key text,client_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.application_links; content bytea; digest text; keys integer; app_id uuid;
begin
 if not private.gateway_allows(gateway_key) then return jsonb_build_object('error','gateway'); end if;
 if client_hash is null or client_hash !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','client'); end if;
 -- Every attempt counts, including invalid ones and repeated PDFs, before any decoding or hashing.
 if not private.count_public_attempt(client_hash,'submit',5) then return jsonb_build_object('error','rate'); end if;
 if token is null or token !~ '^[a-f0-9]{64}$' then return jsonb_build_object('error','unavailable'); end if;
 select * into link from public.application_links l where l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if link.id is null or link.revoked_at is not null or link.expires_at<=now() or link.submission_count>=link.max_submissions
 or not exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.jobs) j where w.owner=link.owner and j->>'id'=link.job_id) then return jsonb_build_object('error','unavailable'); end if;
 if link.submit_window<=now()-interval '1 hour' then link.submit_count:=0;link.submit_window:=now();end if;
 -- Links of the same owner run concurrently; this lock makes the 100-pending ceiling exact.
 perform pg_advisory_xact_lock(hashtextextended('application-queue:'||link.owner::text,0));
 if link.submit_count>=30 or (select count(*) from public.candidate_applications a where a.owner=link.owner and a.reviewed_at is null)>=100 then return jsonb_build_object('error','unavailable'); end if;
 if jsonb_typeof(answer) is distinct from 'object' or octet_length(answer::text)>8000 then return jsonb_build_object('error','invalid'); end if;
 select count(*) into keys from jsonb_object_keys(answer);
 if keys<>7 or not(answer ?& array['name','email','phone','city','role','message','consent']) then return jsonb_build_object('error','invalid'); end if;
 if exists(select 1 from jsonb_each(answer) a where a.key<>'consent' and jsonb_typeof(a.value)<>'string')
 or answer->'consent' is distinct from 'true'::jsonb
 or length(answer->>'name') not between 2 and 200 or length(answer->>'email')>300 or length(answer->>'phone')>100
 or length(answer->>'city') not between 2 and 300 or length(answer->>'role')>300 or length(answer->>'message')>2000
 or (answer->>'phone'='' and answer->>'email'='') then return jsonb_build_object('error','invalid'); end if;
 if file_name is null or length(file_name) not between 1 and 300 or file_base64 is null or length(file_base64)>2796204 or file_base64 !~ '^[A-Za-z0-9+/]*={0,2}$' then return jsonb_build_object('error','file'); end if;
 content:=decode(file_base64,'base64');
 if octet_length(content) not between 5 and 2097152 or substring(content from 1 for 5)<>'\x255044462d'::bytea then return jsonb_build_object('error','file'); end if;
 digest:=encode(sha256(content),'hex');
 if exists(select 1 from public.candidate_applications a where a.link_id=link.id and a.file_sha256=digest) then return jsonb_build_object('received',true); end if;
 insert into public.candidate_applications(owner,link_id,job_id,job_title,response,file_name,file_sha256,file_size)
 values(link.owner,link.id,link.job_id,coalesce(link.context->>'title',''),answer,file_name,digest,octet_length(content)) returning id into app_id;
 insert into private.application_files(application_id,content) values(app_id,content);
 update public.application_links set submission_count=link.submission_count+1,submit_count=link.submit_count+1,submit_window=link.submit_window where id=link.id;
 return jsonb_build_object('received',true);
end;$$;

revoke all on function private.gateway_allows(text),private.count_public_attempt(text,text,integer),private.application_view(text,text,text),private.application_submit(text,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function private.application_view(text,text,text),private.application_submit(text,jsonb,text,text,text,text) to anon;

create function public.application_view(token text,gateway_key text,client_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.application_view(token,gateway_key,client_hash)$$;
create function public.application_submit(token text,answer jsonb,file_name text,file_base64 text,gateway_key text,client_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.application_submit(token,answer,file_name,file_base64,gateway_key,client_hash)$$;
revoke all on function public.application_view(text,text,text),public.application_submit(text,jsonb,text,text,text,text) from public,anon,authenticated;
grant execute on function public.application_view(text,text,text),public.application_submit(text,jsonb,text,text,text,text) to anon;

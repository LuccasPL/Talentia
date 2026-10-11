-- Capability links expose a vacancy snapshot only. Replies await the owner's review.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon,authenticated;
create table public.candidate_refresh_links(
 id uuid primary key default gen_random_uuid(), owner uuid not null references auth.users(id) on delete cascade,
 candidate_id uuid not null, job_id text not null, token_hash text not null unique,
 context jsonb not null, response jsonb,
 created_at timestamptz not null default now(), expires_at timestamptz not null,
 submitted_at timestamptz, reviewed_at timestamptz, revoked_at timestamptz,
 decision text check(decision in ('applied','discarded')),
 access_window timestamptz not null default now(), access_count integer not null default 0,
 foreign key(owner,candidate_id) references public.candidates(owner,id) on delete cascade
);
create index refresh_owner_candidate on public.candidate_refresh_links(owner,candidate_id,created_at desc);
alter table public.candidate_refresh_links enable row level security;
revoke all on public.candidate_refresh_links from public,anon,authenticated;
grant select(id,owner,candidate_id,job_id,context,response,created_at,expires_at,submitted_at,reviewed_at,revoked_at,decision) on public.candidate_refresh_links to authenticated;
create policy refresh_owner_read on public.candidate_refresh_links for select to authenticated using ((select auth.uid())=owner);

create function private.issue_candidate_refresh(candidate_id uuid,job_id text,recruiter text,days integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); j jsonb; token text; link_id uuid; expiry timestamptz;
begin
 if uid is null then raise exception 'authentication required'; end if;
 if days not in (3,7,14) or length(recruiter)<2 or length(recruiter)>200 then raise exception 'invalid input'; end if;
 perform 1 from public.workspaces w where w.owner=uid for update;
 select item into j from public.workspaces w, lateral jsonb_array_elements(w.jobs) item where w.owner=uid and item->>'id'=job_id;
 if j is null or not exists(select 1 from public.candidates c where c.owner=uid and c.id=candidate_id and c.payload->>'mergedInto' is null)
 or exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.records) r where w.owner=uid and r->>'candidateId'=candidate_id::text and r->>'jobId'=job_id and r->>'status'='Não contatar') then raise exception 'unavailable contact'; end if;
 update public.candidate_refresh_links l set revoked_at=now() where l.owner=uid and l.candidate_id=issue_candidate_refresh.candidate_id and l.job_id=issue_candidate_refresh.job_id and l.submitted_at is null and l.revoked_at is null;
 token:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''); expiry:=now()+make_interval(days=>days);
 insert into public.candidate_refresh_links(owner,candidate_id,job_id,token_hash,context,expires_at)
 values(uid,candidate_id,job_id,encode(sha256(convert_to(token,'UTF8')),'hex'),jsonb_build_object('title',j->>'title','recruiter',recruiter,'conditions',coalesce(j->'conditions','{}'::jsonb)),expiry) returning id into link_id;
 return jsonb_build_object('id',link_id,'token',token,'expiresAt',expiry);
end;$$;

create function private.access_candidate_refresh(token text,answer jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare link public.candidate_refresh_links; keys integer;
begin
 if token is null or token !~ '^[a-f0-9]{64}$' then return null; end if;
 select * into link from public.candidate_refresh_links l where l.token_hash=encode(sha256(convert_to(token,'UTF8')),'hex') for update;
 if link.id is null or link.revoked_at is not null or link.submitted_at is not null or link.expires_at<=now()
 or not exists(select 1 from public.candidates c where c.owner=link.owner and c.id=link.candidate_id and c.payload->>'mergedInto' is null)
 or not exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.jobs) j where w.owner=link.owner and j->>'id'=link.job_id)
 or exists(select 1 from public.workspaces w,lateral jsonb_array_elements(w.records) r where w.owner=link.owner and r->>'candidateId'=link.candidate_id::text and r->>'jobId'=link.job_id and r->>'status'='Não contatar') then return null; end if;
 if link.access_window<=now()-interval '1 hour' then link.access_count:=0;link.access_window:=now();end if;
 if link.access_count>=60 then return null;end if;
 update public.candidate_refresh_links set access_count=link.access_count+1,access_window=link.access_window where id=link.id;
 if answer is null then return jsonb_build_object('context',link.context,'expiresAt',link.expires_at);end if;
 if jsonb_typeof(answer) is distinct from 'object' or octet_length(answer::text)>12000 then raise exception 'invalid answer'; end if;
 select count(*) into keys from jsonb_object_keys(answer);
 if keys<>10 or not(answer ?& array['phone','email','city','employment','interest','availability','conditions','question','allowContact','acknowledged']) then raise exception 'invalid fields';end if;
 if exists(select 1 from jsonb_each(answer) a where a.key in ('phone','email','city','employment','interest','availability','conditions','question') and jsonb_typeof(a.value)<>'string')
 or answer->'acknowledged' is distinct from 'true'::jsonb or jsonb_typeof(answer->'allowContact')<>'boolean'
 or length(answer->>'phone')>100 or length(answer->>'email')>300 or length(answer->>'city') not between 2 and 300
 or length(answer->>'availability') not between 2 and 1000 or length(answer->>'question')>2000
 or answer->>'employment' not in ('Trabalhando','Sem trabalho no momento','Prefiro não informar')
 or answer->>'interest' not in ('Interessado','Sem interesse','Quero mais detalhes')
 or answer->>'conditions' not in ('Compatíveis','Não compatíveis','Preciso esclarecer')
 or (answer->>'phone'='' and answer->>'email'='') then raise exception 'invalid answer';end if;
 update public.candidate_refresh_links set response=answer,submitted_at=now() where id=link.id;
 return jsonb_build_object('received',true);
end;$$;

create function private.review_candidate_refresh(link_id uuid,expected_version integer,new_payload jsonb,new_jobs jsonb,new_records jsonb,discard boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); link public.candidate_refresh_links; ok boolean;
begin
 if uid is null then raise exception 'authentication required';end if;
 perform 1 from public.workspaces w where w.owner=uid for update;
 select * into link from public.candidate_refresh_links l where l.id=link_id and l.owner=uid for update;
 if link.id is null or link.submitted_at is null or link.reviewed_at is not null then return false;end if;
 if not discard then
  ok:=public.update_candidate(expected_version,link.candidate_id,new_payload,new_jobs,new_records);
  if not ok then return false;end if;
 end if;
 update public.candidate_refresh_links set reviewed_at=now(),decision=case when discard then 'discarded' else 'applied' end where id=link.id;
 return true;
end;$$;
create function private.revoke_candidate_refresh(link_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 update public.candidate_refresh_links set revoked_at=now() where id=link_id and owner=auth.uid() and submitted_at is null and revoked_at is null;
 return found;
end;$$;
revoke all on function private.issue_candidate_refresh(uuid,text,text,integer),private.access_candidate_refresh(text,jsonb),private.review_candidate_refresh(uuid,integer,jsonb,jsonb,jsonb,boolean),private.revoke_candidate_refresh(uuid) from public,anon,authenticated;
grant execute on function private.issue_candidate_refresh(uuid,text,text,integer),private.review_candidate_refresh(uuid,integer,jsonb,jsonb,jsonb,boolean),private.revoke_candidate_refresh(uuid) to authenticated;
grant execute on function private.access_candidate_refresh(text,jsonb) to anon;
-- Public wrappers are invokers; privileged routines stay outside the exposed schema.
create function public.issue_candidate_refresh(candidate_id uuid,job_id text,recruiter text,days integer) returns jsonb language sql security invoker set search_path='' as $$select private.issue_candidate_refresh(candidate_id,job_id,recruiter,days)$$;
create function public.access_candidate_refresh(token text,answer jsonb default null) returns jsonb language sql security invoker set search_path='' as $$select private.access_candidate_refresh(token,answer)$$;
create function public.review_candidate_refresh(link_id uuid,expected_version integer,new_payload jsonb,new_jobs jsonb,new_records jsonb,discard boolean) returns boolean language sql security invoker set search_path='' as $$select private.review_candidate_refresh(link_id,expected_version,new_payload,new_jobs,new_records,discard)$$;
create function public.revoke_candidate_refresh(link_id uuid) returns boolean language sql security invoker set search_path='' as $$select private.revoke_candidate_refresh(link_id)$$;
revoke all on function public.issue_candidate_refresh(uuid,text,text,integer),public.access_candidate_refresh(text,jsonb),public.review_candidate_refresh(uuid,integer,jsonb,jsonb,jsonb,boolean),public.revoke_candidate_refresh(uuid) from public,anon,authenticated;
grant execute on function public.issue_candidate_refresh(uuid,text,text,integer),public.review_candidate_refresh(uuid,integer,jsonb,jsonb,jsonb,boolean),public.revoke_candidate_refresh(uuid) to authenticated;
grant execute on function public.access_candidate_refresh(text,jsonb) to anon;

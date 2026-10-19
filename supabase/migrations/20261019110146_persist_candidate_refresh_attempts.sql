begin;

create or replace function private.access_candidate_refresh(token text,answer jsonb default null)
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
 -- Return validation failures instead of raising: the exception would roll back the attempt counter above.
 if jsonb_typeof(answer) is distinct from 'object' or octet_length(answer::text)>12000 then return jsonb_build_object('error','invalid'); end if;
 select count(*) into keys from jsonb_object_keys(answer);
 if keys<>10 or not(answer ?& array['phone','email','city','employment','interest','availability','conditions','question','allowContact','acknowledged']) then return jsonb_build_object('error','invalid');end if;
 if exists(select 1 from jsonb_each(answer) a where a.key in ('phone','email','city','employment','interest','availability','conditions','question') and jsonb_typeof(a.value)<>'string')
 or answer->'acknowledged' is distinct from 'true'::jsonb or jsonb_typeof(answer->'allowContact')<>'boolean'
 or length(answer->>'phone')>100 or length(answer->>'email')>300 or length(answer->>'city') not between 2 and 300
 or length(answer->>'availability') not between 2 and 1000 or length(answer->>'question')>2000
 or answer->>'employment' not in ('Trabalhando','Sem trabalho no momento','Prefiro não informar')
 or answer->>'interest' not in ('Interessado','Sem interesse','Quero mais detalhes')
 or answer->>'conditions' not in ('Compatíveis','Não compatíveis','Preciso esclarecer')
 or (answer->>'phone'='' and answer->>'email'='') then return jsonb_build_object('error','invalid');end if;
 update public.candidate_refresh_links set response=answer,submitted_at=now() where id=link.id;
 return jsonb_build_object('received',true);
end;$$;

commit;

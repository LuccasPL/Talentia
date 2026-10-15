-- Run inside BEGIN/ROLLBACK. Uses a throwaway gateway key; the real key hash is restored by the rollback.
do $$
declare uid uuid; jid text:=gen_random_uuid()::text; issued jsonb; token text; answer jsonb; pdf text; r jsonb; k text:='test-gateway-key-'||repeat('x',40); c1 text:=repeat('a',64); c2 text:=repeat('b',64); i integer; lid uuid;
begin
 select owner into uid from public.workspaces limit 1;
 if uid is null then raise exception 'Test needs an existing workspace';end if;
 insert into private.gateway_keys(purpose,key_hash) values('public-applications',encode(sha256(convert_to(k,'UTF8')),'hex')) on conflict(purpose) do update set key_hash=excluded.key_hash;
 update public.workspaces w set jobs=w.jobs||jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia do gateway')) where owner=uid;
 pdf:=encode(convert_to('%PDF-1.4 currículo fictício do gateway','UTF8'),'base64');
 answer:=jsonb_build_object('name','Pessoa Fictícia Gateway','email','gateway@example.test','phone','','city','São Paulo','role','','message','','consent',true);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 issued:=public.issue_application_link(jid,'Recrutadora de teste',7,200); token:=issued->>'token'; lid:=(issued->>'id')::uuid;

 set local role anon;perform set_config('request.jwt.claim.sub','',true);
 -- Private helpers and tables are unreachable for anon.
 begin perform private.gateway_allows(k);raise exception 'Anon called gateway_allows';exception when insufficient_privilege then null;end;
 begin perform private.count_public_attempt(c1,'view',1);raise exception 'Anon called count_public_attempt';exception when insufficient_privilege then null;end;
 begin perform 1 from private.gateway_keys;raise exception 'Anon read gateway keys';exception when insufficient_privilege then null;end;
 begin perform 1 from private.public_attempts;raise exception 'Anon read attempts';exception when insufficient_privilege then null;end;
 -- Without the server key nothing opens, even with a valid link token.
 if public.application_view(token,null,c1)->>'error'<>'gateway' then raise exception 'Missing key accepted';end if;
 if public.application_view(token,'wrong-key-'||repeat('y',40),c1)->>'error'<>'gateway' then raise exception 'Wrong key accepted';end if;
 if public.application_submit(token,answer,'cv.pdf',pdf,'wrong-key-'||repeat('y',40),c1)->>'error'<>'gateway' then raise exception 'Wrong key submit accepted';end if;
 if public.application_view(token,k,'not-a-hash')->>'error'<>'client' then raise exception 'Invalid client accepted';end if;
 r:=public.application_view(token,k,c1);
 if r->'context'->>'title'<>'Vaga fictícia do gateway' then raise exception 'View failed: %',r;end if;
 -- Invalid attempts are counted (no exception rolls the counter back) and the sixth attempt is refused.
 if public.application_submit(token,answer-'consent','cv.pdf',pdf,k,c1)->>'error'<>'invalid' then raise exception 'Invalid answer accepted';end if;
 if public.application_submit(token,answer,'cv.pdf','###',k,c1)->>'error'<>'file' then raise exception 'Bad base64 accepted';end if;
 if (public.application_submit(token,answer,'cv.pdf',pdf,k,c1)->>'received')::boolean is distinct from true then raise exception 'Valid submit failed';end if;
 if (public.application_submit(token,answer,'cv.pdf',pdf,k,c1)->>'received')::boolean is distinct from true then raise exception 'Repeat submit failed';end if;
 if public.application_submit(repeat('0',64),answer,'cv.pdf',pdf,k,c1)->>'error'<>'unavailable' then raise exception 'Unknown link accepted';end if;
 if public.application_submit(token,answer,'cv.pdf',pdf,k,c1)->>'error'<>'rate' then raise exception 'Sixth attempt from one client accepted';end if;
 -- Another client is not affected by the first one's limit.
 if (public.application_submit(token,answer||jsonb_build_object('name','Outra Pessoa Fictícia'),'cv2.pdf',encode(convert_to('%PDF-1.4 outro currículo fictício','UTF8'),'base64'),k,c2)->>'received')::boolean is distinct from true then raise exception 'Second client blocked';end if;

 set local role postgres;
 if (select hits from private.public_attempts where client_hash=c1 and action='submit' and window_start=date_trunc('hour',now()))<>6 then raise exception 'Attempts not persisted';end if;
 if (select count(*) from public.candidate_applications where link_id=lid)<>2 then raise exception 'Unexpected application count';end if;
 -- Pending ceiling: fill the owner's queue to 100 and confirm the next submission is refused.
 for i in 1..(100-(select count(*) from public.candidate_applications where owner=uid and reviewed_at is null)) loop
  insert into public.candidate_applications(owner,link_id,job_id,job_title,response,file_name,file_sha256,file_size)
  values(uid,lid,jid,'Vaga fictícia do gateway',answer,'cheio.pdf',encode(sha256(convert_to('fill'||i,'UTF8')),'hex'),10);
 end loop;
 set local role anon;
 if public.application_submit(token,answer,'cv3.pdf',encode(convert_to('%PDF-1.4 terceiro currículo','UTF8'),'base64'),k,repeat('c',64))->>'error'<>'unavailable' then raise exception 'Full queue accepted a submission';end if;
 set local role postgres;
end;$$;

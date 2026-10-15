-- Run inside BEGIN/ROLLBACK. Fixtures never survive this test.
do $$
declare uid uuid; jid text:=gen_random_uuid()::text; issued jsonb; token text; result jsonb; answer jsonb; pdf text; other_pdf text; app uuid; n integer;
begin
 select owner into uid from public.workspaces limit 1;
 if uid is null then raise exception 'Test needs an existing workspace';end if;
 update public.workspaces w set jobs=w.jobs||jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia de candidatura','conditions',jsonb_build_object('schedule','6x1'))) where owner=uid;
 pdf:=encode(convert_to('%PDF-1.4 currículo fictício de teste','UTF8'),'base64');
 other_pdf:=encode(convert_to('%PDF-1.4 outro currículo fictício','UTF8'),'base64');
 answer:=jsonb_build_object('name','Pessoa Fictícia de Teste','email','teste@example.test','phone','','city','São Paulo','role','','message','','consent',true);

 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 begin perform public.issue_application_link(jid,'Recrutadora de teste',3,10);raise exception 'Invalid validity accepted';exception when raise_exception then if sqlerrm='Invalid validity accepted' then raise;end if;end;
 issued:=public.issue_application_link(jid,'Recrutadora de teste',7,10); token:=issued->>'token';
 if length(token)<>64 then raise exception 'Invalid token';end if;
 begin perform token_hash from public.application_links;raise exception 'Token hash exposed';exception when insufficient_privilege then null;end;
 begin perform content from private.application_files;raise exception 'Private files exposed to owner';exception when insufficient_privilege then null;end;

 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if exists(select 1 from public.application_links) then raise exception 'Other owner can read links';end if;
 begin perform public.issue_application_link(jid,'Teste',7,10);raise exception 'Other owner can issue link';exception when raise_exception then if sqlerrm='Other owner can issue link' then raise;end if;end;

 set local role anon;perform set_config('request.jwt.claim.sub','',true);
 begin perform id from public.application_links;raise exception 'Anonymous link table access';exception when insufficient_privilege then null;end;
 begin perform id from public.candidate_applications;raise exception 'Anonymous application table access';exception when insufficient_privilege then null;end;
 begin perform public.application_file(gen_random_uuid());raise exception 'Anonymous file access';exception when insufficient_privilege then null;end;
 begin perform public.review_application(gen_random_uuid(),false,null);raise exception 'Anonymous review';exception when insufficient_privilege then null;end;
 if public.access_application_link(repeat('0',64)) is not null then raise exception 'Invalid token accepted';end if;
 result:=public.access_application_link(token);
 if result->'context'->>'title'<>'Vaga fictícia de candidatura' or result::text like '%token%' then raise exception 'Unexpected public context';end if;
 begin perform public.submit_application(token,answer-'consent'||jsonb_build_object('consent',false),'cv.pdf',pdf);raise exception 'Missing consent accepted';exception when raise_exception then if sqlerrm='Missing consent accepted' then raise;end if;end;
 begin perform public.submit_application(token,answer||jsonb_build_object('cpf','000'),'cv.pdf',pdf);raise exception 'Extra field accepted';exception when raise_exception then if sqlerrm='Extra field accepted' then raise;end if;end;
 begin perform public.submit_application(token,answer,'cv.pdf',encode(convert_to('não é pdf','UTF8'),'base64'));raise exception 'Non-PDF accepted';exception when raise_exception then if sqlerrm='Non-PDF accepted' then raise;end if;end;
 if (public.submit_application(token,answer,'cv.pdf',pdf)->>'received')::boolean is distinct from true then raise exception 'Submission failed';end if;
 if (public.submit_application(token,answer,'cv.pdf',pdf)->>'received')::boolean is distinct from true then raise exception 'Resubmission failed';end if;

 set local role postgres;
 select count(*) into n from public.candidate_applications where link_id=(issued->>'id')::uuid;
 if n<>1 then raise exception 'Same PDF created % applications',n;end if;
 if (select submission_count from public.application_links where id=(issued->>'id')::uuid)<>1 then raise exception 'Resubmission consumed quota';end if;
 select id into app from public.candidate_applications where link_id=(issued->>'id')::uuid;

 set local role authenticated;perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
 if public.application_file(app) is not null then raise exception 'Other owner read the PDF';end if;
 if public.review_application(app,false,null) then raise exception 'Other owner reviewed';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if convert_from(decode(public.application_file(app),'base64'),'UTF8')<>'%PDF-1.4 currículo fictício de teste' then raise exception 'Owner cannot read the PDF';end if;
 begin perform public.review_application(app,true,null);raise exception 'Accept without import';exception when raise_exception then if sqlerrm='Accept without import' then raise;end if;end;
 if not public.review_application(app,false,null) then raise exception 'Discard failed';end if;
 if public.review_application(app,false,null) then raise exception 'Review replay accepted';end if;
 if public.application_file(app) is not null then raise exception 'Reviewed PDF still readable';end if;
 set local role postgres;
 if exists(select 1 from private.application_files where application_id=app) then raise exception 'Discarded PDF kept';end if;

 -- Quota, revocation and expiry close the link.
 update public.application_links set max_submissions=2 where id=(issued->>'id')::uuid;
 set local role anon;perform set_config('request.jwt.claim.sub','',true);
 if public.submit_application(token,answer,'outro.pdf',other_pdf) is null then raise exception 'Second submission rejected';end if;
 if public.access_application_link(token) is not null then raise exception 'Full link still open';end if;
 set local role authenticated;perform set_config('request.jwt.claim.sub',uid::text,true);
 issued:=public.issue_application_link(jid,'Recrutadora de teste',7,10); token:=issued->>'token';
 if not public.revoke_application_link((issued->>'id')::uuid) then raise exception 'Revoke failed';end if;
 set local role anon;perform set_config('request.jwt.claim.sub','',true);
 if public.submit_application(token,answer,'cv.pdf',pdf) is not null then raise exception 'Revoked link accepted';end if;
 set local role authenticated;perform set_config('request.jwt.claim.sub',uid::text,true);
 issued:=public.issue_application_link(jid,'Recrutadora de teste',7,10);
 set local role postgres;
 update public.application_links set expires_at=now()-interval '1 second' where id=(issued->>'id')::uuid;
 set local role anon;perform set_config('request.jwt.claim.sub','',true);
 if public.access_application_link(issued->>'token') is not null then raise exception 'Expired link accepted';end if;
 set local role postgres;
end;$$;

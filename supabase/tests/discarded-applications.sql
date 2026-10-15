-- Independent fictitious accounts only; this file rolls back all fixture writes.
begin;
do $$
declare
 uid uuid:=gen_random_uuid(); other_uid uuid:=gen_random_uuid();
 jid text:=gen_random_uuid()::text; issued jsonb; token text; app uuid; accepted_app uuid;
 answer jsonb:=jsonb_build_object('name','Pessoa Fictícia','email','fixture@example.invalid','phone','','city','São Paulo','role','','message','Mensagem fictícia','consent',true);
 pdf text:=encode(convert_to('%PDF-1.4 ficticio descarte','UTF8'),'base64');
 kept_pdf text:=encode(convert_to('%PDF-1.4 ficticio aceite','UTF8'),'base64');
 import_uuid uuid:=gen_random_uuid(); result boolean;
begin
 insert into auth.users(id,aud,role,email) values
  (uid,'authenticated','authenticated',uid||'@example.invalid'),
  (other_uid,'authenticated','authenticated',other_uid||'@example.invalid');
 insert into public.workspaces(owner,jobs) values(uid,jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia')));
 perform set_config('request.jwt.claim.sub',uid::text,true);
 set local role authenticated;
 issued:=public.issue_application_link(jid,'Recrutadora fictícia',7,10); token:=issued->>'token';
 set local role anon; perform set_config('request.jwt.claim.sub','',true);
 perform public.submit_application(token,answer,'nome-pessoal.pdf',pdf);
 perform public.submit_application(token,answer,'nome-aceito.pdf',kept_pdf);
 set local role postgres;
 select id into strict app from public.candidate_applications where link_id=(issued->>'id')::uuid and file_name='nome-pessoal.pdf';
 select id into strict accepted_app from public.candidate_applications where link_id=(issued->>'id')::uuid and file_name='nome-aceito.pdf';

 set local role authenticated;
 perform set_config('request.jwt.claim.sub',other_uid::text,true);
 if public.review_application(app,false,null) then raise exception 'Other owner discarded application'; end if;
 if public.application_file(app) is not null then raise exception 'Other owner read PDF'; end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if public.application_file(app) is null then raise exception 'Pending PDF lost'; end if;
 if (select response from public.candidate_applications where id=app) is distinct from answer then raise exception 'Pending answer lost'; end if;
 if not public.review_application(app,false,null) then raise exception 'Discard failed'; end if;
 if public.review_application(app,false,null) then raise exception 'Duplicate review accepted'; end if;
 if public.application_file(app) is not null then raise exception 'Discarded PDF readable'; end if;
 if exists(select 1 from public.candidate_applications where id=app and
  (response is not null or file_name is not null or file_sha256 is not null or file_size is not null or import_id is not null)) then
  raise exception 'Discarded personal data retained';
 end if;
 if not exists(select 1 from public.candidate_applications where id=app and decision='discarded' and reviewed_at is not null) then
  raise exception 'Minimal decision missing';
 end if;

 begin
  perform public.review_application(accepted_app,null,null);
  raise exception 'NULL decision accepted';
 exception when raise_exception then
  if sqlerrm='NULL decision accepted' then raise; end if;
 end;
 -- Accepted responses must survive for syncImports/declaredCandidate.
 if not public.review_application(accepted_app,true,import_uuid) then raise exception 'Accept failed'; end if;
 if not exists(select 1 from public.candidate_applications where id=accepted_app and decision='accepted'
  and response=answer and file_name='nome-aceito.pdf' and file_sha256 is not null and file_size is not null and import_id=import_uuid) then
  raise exception 'Accepted data required for import lost';
 end if;
 set local role postgres;
 if exists(select 1 from private.application_files where application_id in(app,accepted_app)) then
  raise exception 'Reviewed private PDF retained';
 end if;
 -- Even privileged accidental updates must not reintroduce PII into a discarded row.
 begin
  update public.candidate_applications set response=answer where id=app;
  raise exception 'Discard constraint missing';
 exception when check_violation then null;
 end;
 -- Removing the fingerprint permits a fresh submission of a previously discarded PDF.
 set local role anon; perform set_config('request.jwt.claim.sub','',true);
 if public.submit_application(token,answer,'reenvio.pdf',pdf) is null then raise exception 'Fresh submission failed'; end if;
 set local role postgres;
 if (select count(*) from public.candidate_applications where link_id=(issued->>'id')::uuid)<>3 then
  raise exception 'Discarded fingerprint still deduplicates';
 end if;
 if (select submission_count from public.application_links where id=(issued->>'id')::uuid)<>3 then
  raise exception 'Fresh submission did not consume quota';
 end if;
end;
$$;
rollback;

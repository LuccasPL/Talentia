-- Independent fictitious account only; run as written (it rolls back every fixture write).
-- Creates one item just past and one just inside each deadline, runs the retention job and checks both.
begin;
do $$
declare
 uid uuid:=gen_random_uuid(); jid text:='vaga-'||gen_random_uuid(); cand uuid:=gen_random_uuid();
 old_link uuid; new_link uuid; closed_link uuid; run_counts jsonb; resp jsonb:=jsonb_build_object('name','Pessoa Fictícia');
 imp_done uuid:=gen_random_uuid(); imp_failed_old uuid:=gen_random_uuid(); imp_failed_new uuid:=gen_random_uuid();
begin
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated',uid||'@example.invalid');
 insert into public.workspaces(owner,jobs) values(uid,jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia')));
 insert into public.candidates(owner,id,name,file_key,payload) values(uid,cand,'Pessoa Fictícia',uid||'/perfil.pdf',jsonb_build_object('id',cand,'name','Pessoa Fictícia','fileKey',uid||'/perfil.pdf'));
 insert into public.application_links(owner,job_id,token_hash,context,expires_at,max_submissions) values(uid,jid,repeat('1',64),'{}',now()+interval '7 days',200) returning id into old_link;
 insert into public.application_links(owner,job_id,token_hash,context,expires_at,max_submissions) values(uid,jid,repeat('2',64),'{}',now()-interval '89 days',10) returning id into new_link;
 insert into public.application_links(owner,job_id,token_hash,context,expires_at,max_submissions) values(uid,jid,repeat('3',64),'{}',now()-interval '91 days',10) returning id into closed_link;
 insert into public.pdf_imports(id,owner,source,file_key,status,candidate_id,created_at) values
  (imp_done,uid,'Candidatura · a.pdf',uid||'/perfil.pdf','completed',cand,now()-interval '40 days'),
  (imp_failed_old,uid,'falhou-antigo.pdf',uid||'/falhou-antigo.pdf','failed',gen_random_uuid(),now()-interval '31 days'),
  (imp_failed_new,uid,'falhou-recente.pdf',uid||'/falhou-recente.pdf','failed',gen_random_uuid(),now()-interval '29 days');
 insert into public.candidate_applications(owner,link_id,job_id,job_title,response,file_name,file_sha256,file_size,created_at,reviewed_at,decision,import_id) values
  (uid,old_link,jid,'Vaga','{"name":"pendente antiga"}','a.pdf',repeat('a',64),10,now()-interval '61 days',null,null,null),
  (uid,old_link,jid,'Vaga','{"name":"pendente recente"}','b.pdf',repeat('b',64),10,now()-interval '59 days',null,null,null),
  (uid,old_link,jid,'Vaga',resp,'c.pdf',repeat('c',64),10,now()-interval '40 days',now()-interval '31 days','accepted',imp_done),
  (uid,old_link,jid,'Vaga',resp,'d.pdf',repeat('d',64),10,now()-interval '40 days',now()-interval '29 days','accepted',imp_done),
  (uid,old_link,jid,'Vaga',resp,'e.pdf',repeat('e',64),10,now()-interval '40 days',now()-interval '31 days','accepted',imp_failed_new),
  (uid,old_link,jid,'Vaga',null,null,null,null,now()-interval '400 days',now()-interval '13 months','discarded',null),
  (uid,old_link,jid,'Vaga',null,null,null,null,now()-interval '400 days',now()-interval '11 months','discarded',null);
 insert into public.candidate_refresh_links(owner,candidate_id,job_id,token_hash,context,response,expires_at,submitted_at,reviewed_at,decision) values
  (uid,cand,jid,repeat('4',64),'{}',resp,now()-interval '40 days',now()-interval '40 days',now()-interval '31 days','applied'),
  (uid,cand,jid,repeat('5',64),'{}',resp,now()-interval '40 days',now()-interval '40 days',now()-interval '29 days','applied'),
  (uid,cand,jid,repeat('6',64),'{}',null,now()-interval '91 days',null,null,null),
  (uid,cand,jid,repeat('7',64),'{}',null,now()-interval '89 days',null,null,null),
  (uid,cand,jid,repeat('8',64),'{}',null,now()-interval '400 days',now()-interval '400 days',now()-interval '13 months','discarded');

 run_counts:=private.apply_retention();

 if exists(select 1 from public.candidate_applications where owner=uid and response->>'name'='pendente antiga') then raise exception 'Pending application past 60 days kept';end if;
 if not exists(select 1 from public.candidate_applications where owner=uid and response->>'name'='pendente recente') then raise exception 'Recent pending application removed';end if;
 if exists(select 1 from public.candidate_applications where owner=uid and file_name='c.pdf') then raise exception 'Accepted application past 30 days kept';end if;
 if not exists(select 1 from public.candidate_applications where owner=uid and file_name='d.pdf') then raise exception 'Recent accepted application removed';end if;
 if not exists(select 1 from public.candidate_applications where owner=uid and file_name='e.pdf') then raise exception 'Accepted application with retryable import removed';end if;
 if (select count(*) from public.candidate_applications where owner=uid and decision='discarded')<>1 then raise exception 'Discarded retention wrong';end if;
 if (select response from public.candidate_refresh_links where token_hash=repeat('4',64)) is not null then raise exception 'Old refresh answer kept';end if;
 if (select response from public.candidate_refresh_links where token_hash=repeat('5',64)) is null then raise exception 'Recent refresh answer cleared';end if;
 if exists(select 1 from public.candidate_refresh_links where token_hash in(repeat('6',64),repeat('8',64))) then raise exception 'Old refresh link kept';end if;
 if not exists(select 1 from public.candidate_refresh_links where token_hash=repeat('7',64)) then raise exception 'Recent refresh link removed';end if;
 if exists(select 1 from public.application_links where id=closed_link) then raise exception 'Closed application link kept';end if;
 if not exists(select 1 from public.application_links where id=new_link) or not exists(select 1 from public.application_links where id=old_link) then raise exception 'Open or recent link removed';end if;
 if exists(select 1 from public.pdf_imports where id=imp_failed_old) or not exists(select 1 from public.pdf_imports where id=imp_failed_new) or not exists(select 1 from public.pdf_imports where id=imp_done) then raise exception 'Import retention wrong';end if;
 if (select array_agg(file_key) from public.pending_file_deletions where owner=uid)<>array[uid||'/falhou-antigo.pdf'] then raise exception 'File queue wrong';end if;
 if not exists(select 1 from public.candidates where id=cand) then raise exception 'Profile removed automatically';end if;
 if not exists(select 1 from private.retention_runs r where r.counts=run_counts) then raise exception 'Run not logged';end if;
 if (run_counts->>'pendingApplications')::int<1 or (run_counts->>'failedImports')::int<1 then raise exception 'Counts not reported: %',run_counts;end if;

 set local role authenticated;perform set_config('request.jwt.claim.sub',uid::text,true);
 begin perform private.apply_retention();raise exception 'Authenticated ran retention';exception when insufficient_privilege then null;end;
 begin perform 1 from private.retention_runs;raise exception 'Retention log readable';exception when insufficient_privilege then null;end;
 set local role postgres;
end;$$;
rollback;

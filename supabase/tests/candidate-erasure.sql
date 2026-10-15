-- Independent fictitious accounts only; run as written (it rolls back every fixture write).
begin;
do $$
declare
 uid uuid:=gen_random_uuid(); other uuid:=gen_random_uuid(); jid text:='vaga-'||gen_random_uuid();
 a uuid:=gen_random_uuid(); acv uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
 imp uuid:=gen_random_uuid(); lnk uuid; app uuid:=gen_random_uuid();
 person jsonb; jobs_ok jsonb; records_ok jsonb; rewrite_ok jsonb; result jsonb; v integer;
begin
 insert into auth.users(id,aud,role,email) values(uid,'authenticated','authenticated',uid||'@example.invalid'),(other,'authenticated','authenticated',other||'@example.invalid');
 person:=jsonb_build_object('role','','city','','source','PDF','text','Experiência fictícia.','phone','','email','','updated','2026-10-15','demo',false);
 insert into public.candidates(owner,id,name,file_key,payload) values
  (uid,a,'Pessoa A',uid||'/a.pdf',person||jsonb_build_object('id',a,'name','Pessoa A','fileKey',uid||'/a.pdf','cvSourceId',acv)),
  (uid,acv,'Pessoa A (CV)',uid||'/acv.pdf',person||jsonb_build_object('id',acv,'name','Pessoa A (CV)','fileKey',uid||'/acv.pdf','mergedInto',a)),
  (uid,b,'Pessoa B',null,person||jsonb_build_object('id',b,'name','Pessoa B','mergeHistory',jsonb_build_array(jsonb_build_object('at','2026-10-10','candidate',person||jsonb_build_object('id',a,'name','Pessoa A'),'records','[]'::jsonb,'analyses','[]'::jsonb)))),
  (uid,c,'Pessoa C',null,person||jsonb_build_object('id',c,'name','Pessoa C'));
 insert into public.workspaces(owner,jobs,records,version) values(uid,
  jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia','analyses',jsonb_build_array(jsonb_build_object('candidateId',a,'evidence','[]'::jsonb),jsonb_build_object('candidateId',c,'evidence','[]'::jsonb)))),
  jsonb_build_array(jsonb_build_object('candidateId',a,'jobId',jid,'notes','nota fictícia'),jsonb_build_object('candidateId',c,'jobId',jid,'notes','outra nota')),5);
 insert into public.pdf_imports(id,owner,source,file_key,status,batch_id,candidate_id) values(imp,uid,'Candidatura · a.pdf',uid||'/a.pdf','completed','msgbatch_ficticio',a);
 insert into public.application_links(owner,job_id,token_hash,context,expires_at,max_submissions) values(uid,jid,repeat('9',64),'{}',now()+interval '7 days',10) returning id into lnk;
 insert into public.candidate_applications(id,owner,link_id,job_id,job_title,response,file_name,file_sha256,file_size,reviewed_at,decision,import_id)
  values(app,uid,lnk,jid,'Vaga fictícia',jsonb_build_object('name','Pessoa A'),'a.pdf',repeat('a',64),10,now(),'accepted',imp);
 insert into public.candidate_refresh_links(owner,candidate_id,job_id,token_hash,context,expires_at) values(uid,a,jid,repeat('8',64),'{}',now()+interval '3 days');

 jobs_ok:=jsonb_build_array(jsonb_build_object('id',jid,'title','Vaga fictícia','analyses',jsonb_build_array(jsonb_build_object('candidateId',c,'evidence','[]'::jsonb))));
 records_ok:=jsonb_build_array(jsonb_build_object('candidateId',c,'jobId',jid,'notes','outra nota'));
 rewrite_ok:=jsonb_build_array(jsonb_build_object('id',b,'payload',(select payload from public.candidates where id=b)||jsonb_build_object('mergeHistory','[]'::jsonb)));

 set local role authenticated;
 -- Another account cannot erase (or even see) these profiles.
 perform set_config('request.jwt.claim.sub',other::text,true);
 begin perform public.erase_candidate(5,array[a,acv],jobs_ok,records_ok,'[]');exception when others then null;end;
 if exists(select 1 from public.pending_file_deletions) then raise exception 'Other account sees deletions';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 if public.erase_candidate(4,array[a,acv],jobs_ok,records_ok,rewrite_ok) is not null then raise exception 'Stale version accepted';end if;
 begin perform public.erase_candidate(5,array[a],jobs_ok,records_ok,rewrite_ok);raise exception 'Incomplete group accepted';exception when raise_exception then if sqlerrm<>'incomplete group' then raise;end if;end;
 begin perform public.erase_candidate(5,array[a,acv],jobs_ok,(select jsonb_agg(r) from jsonb_array_elements(records_ok||jsonb_build_array(jsonb_build_object('candidateId',a,'jobId',jid))) r),rewrite_ok);raise exception 'Leftover record accepted';exception when raise_exception then if sqlerrm<>'person still in workspace' then raise;end if;end;
 begin perform public.erase_candidate(5,array[a,acv],jobs_ok,records_ok,'[]');raise exception 'Leftover snapshot accepted';exception when raise_exception then if sqlerrm<>'snapshots remain' then raise;end if;end;
 begin perform public.erase_candidate(5,array[a,acv],jobs_ok,records_ok,jsonb_build_array(jsonb_build_object('id',b,'payload',(select payload from public.candidates where id=b)||jsonb_build_object('name','Outro nome','mergeHistory','[]'::jsonb))));raise exception 'Unrelated change accepted';exception when raise_exception then if sqlerrm<>'invalid rewrite' then raise;end if;end;
 set local role postgres;
 if (select count(*) from public.candidates where owner=uid)<>4 then raise exception 'Rejected calls changed data';end if;

 set local role authenticated;perform set_config('request.jwt.claim.sub',uid::text,true);
 result:=public.erase_candidate(5,array[a,acv],jobs_ok,records_ok,rewrite_ok);
 if result is null or (select array_agg(k order by k) from jsonb_array_elements_text(result->'fileKeys') k)<>array[uid||'/a.pdf',uid||'/acv.pdf'] or result->'batchIds'<>'["msgbatch_ficticio"]' then raise exception 'Unexpected result: %',result;end if;
 if (select array_agg(file_key order by file_key) from public.pending_file_deletions)<>array[uid||'/a.pdf',uid||'/acv.pdf'] then raise exception 'Files not queued';end if;
 set local role postgres;
 if exists(select 1 from public.candidates where id in(a,acv)) then raise exception 'Profile kept';end if;
 if not exists(select 1 from public.candidates where id=c) or not exists(select 1 from public.candidates where id=b and payload->'mergeHistory'='[]') then raise exception 'Other people affected or snapshot kept';end if;
 if exists(select 1 from public.pdf_imports where id=imp) or exists(select 1 from public.candidate_applications where id=app) or exists(select 1 from public.candidate_refresh_links where candidate_id=a) then raise exception 'Related rows kept';end if;
 select version into v from public.workspaces where owner=uid;
 if v<>6 or (select records from public.workspaces where owner=uid)<>records_ok then raise exception 'Workspace not updated';end if;
 if (select count(*) from public.workspaces w,jsonb_array_elements(w.jobs) j,jsonb_array_elements(j->'analyses') x where w.owner=uid and x->>'candidateId'=a::text)>0 then raise exception 'Analysis kept';end if;
 set local role anon;
 begin perform 1 from public.pending_file_deletions;raise exception 'Anonymous read of deletions';exception when insufficient_privilege then null;end;
 begin perform public.erase_candidate(6,array[c],jobs_ok,'[]','[]');raise exception 'Anonymous erase';exception when insufficient_privilege then null;end;
 set local role postgres;
end;$$;
rollback;

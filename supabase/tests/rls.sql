begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid();
begin
 perform set_config('talentia.test_a',a::text,true);
 perform set_config('talentia.test_b',b::text,true);
 perform set_config('talentia.test_ca',ca::text,true);
 perform set_config('talentia.test_cb',cb::text,true);
 insert into auth.users(id,aud,role,email) values(a,'authenticated','authenticated','rls-'||a||'@example.invalid'),(b,'authenticated','authenticated','rls-'||b||'@example.invalid');
 insert into public.workspaces(owner,jobs) values(a,'[{"id":"fixture"}]'),(b,'[{"id":"fixture"}]');
 insert into public.candidates(owner,id,name,payload) values(a,ca,'RLS fixture',jsonb_build_object('id',ca)),(b,cb,'RLS fixture',jsonb_build_object('id',cb));
 insert into storage.objects(bucket_id,name) values('curriculos',a||'/rls-fixture.pdf'),('curriculos',b||'/rls-fixture.pdf');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end;$$;
set local role authenticated;
do $$
declare a uuid:=current_setting('talentia.test_a')::uuid; b uuid:=current_setting('talentia.test_b')::uuid; ca uuid:=current_setting('talentia.test_ca')::uuid; cb uuid:=current_setting('talentia.test_cb')::uuid; changed integer;
begin
 if auth.uid()<>a then raise exception 'fixture authentication failed';end if;
 if (select count(*) from public.candidates where id in(ca,cb))<>1 then raise exception 'candidate read isolation failed';end if;
 if (select count(*) from public.workspaces where owner in(a,b))<>1 then raise exception 'workspace read isolation failed';end if;
 if (select count(*) from storage.objects where bucket_id='curriculos' and name in(a||'/rls-fixture.pdf',b||'/rls-fixture.pdf'))<>1 then raise exception 'storage read isolation failed';end if;
 update public.candidates set name='Unauthorized' where owner=b and id=cb;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'cross-account update allowed';end if;
 begin
  update public.candidates set owner=b where owner=a and id=ca;
  raise exception 'owner reassignment allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.candidates(owner,id,name,payload) values(b,gen_random_uuid(),'Unauthorized','{}');
  raise exception 'cross-account insert allowed';
 exception when insufficient_privilege then null;end;
 if not public.save_workspace(1,'[{"id":"fixture"}]','[]') then raise exception 'valid workspace save failed';end if;
 if public.save_workspace(1,'[{"id":"fixture"}]','[]') then raise exception 'stale workspace save allowed';end if;
 if has_table_privilege('authenticated','public.candidates','TRUNCATE') or has_table_privilege('authenticated','public.workspaces','TRUNCATE') then raise exception 'truncate still allowed';end if;
end;$$;
set local role anon;
do $$ begin
 begin
  perform 1 from public.candidates limit 1;
  raise exception 'anonymous read allowed';
 exception when insufficient_privilege then null;end;
 if has_function_privilege('anon','public.save_workspace(integer,jsonb,jsonb)','EXECUTE') then raise exception 'anonymous RPC allowed';end if;
end;$$;
reset role;
rollback;
select 'passed' as result, 'read isolation, write isolation, owner reassignment, private storage policies, stale-save rejection, anonymous access, restricted privileges' as checks, 'rolled back; no fixture data retained' as cleanup;

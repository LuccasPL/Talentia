begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid();
begin
 perform set_config('talentia.test_a',a::text,true);perform set_config('talentia.test_b',b::text,true);
 insert into auth.users(id,aud,role,email) values(a,'authenticated','authenticated','limit-'||a||'@example.invalid'),(b,'authenticated','authenticated','limit-'||b||'@example.invalid');
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$
declare result jsonb;
begin
 for i in 1..60 loop
  result:=public.consume_api_limit('read');if not (result->>'allowed')::boolean then raise exception 'valid read denied';end if;
 end loop;
 result:=public.consume_api_limit('read');
 if (result->>'allowed')::boolean or (result->>'retry_after')::integer<1 then raise exception 'exhausted read allowed';end if;
 begin perform 1 from talentia_private.api_limits;raise exception 'client can inspect counters';exception when insufficient_privilege then null;end;
 begin delete from talentia_private.api_limits;raise exception 'client can reset counters';exception when insufficient_privilege then null;end;
 begin perform public.consume_api_limit('invented');raise exception 'arbitrary limit accepted';exception when invalid_parameter_value then null;end;
 perform set_config('request.jwt.claim.sub',current_setting('talentia.test_b'),true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('talentia.test_b'),'role','authenticated')::text,true);
 if not (public.consume_api_limit('read')->>'allowed')::boolean then raise exception 'unrelated user blocked';end if;
end $$;
reset role;
-- Seed the daily limit while leaving the hourly limit available.
insert into talentia_private.api_limits(owner,bucket,window_seconds,window_start,hits)
values(current_setting('talentia.test_b')::uuid,'ai-call',86400,(floor(extract(epoch from clock_timestamp()))::bigint/86400)*86400,200);
insert into talentia_private.api_limits(owner,bucket,window_seconds,window_start,hits) values
 (current_setting('talentia.test_a')::uuid,'ai-call',3600,(floor(extract(epoch from clock_timestamp()))::bigint/3600)*3600,60),
 (current_setting('talentia.test_a')::uuid,'ai-call',86400,(floor(extract(epoch from clock_timestamp()))::bigint/86400)*86400,1);
set local role authenticated;
do $$ begin
 if (public.consume_api_limit('ai-call')->>'allowed')::boolean then raise exception 'daily AI cap bypassed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('talentia.test_a'),true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('talentia.test_a'),'role','authenticated')::text,true);
 if (public.consume_api_limit('ai-call')->>'allowed')::boolean then raise exception 'hourly AI cap bypassed';end if;
end $$;
reset role;
do $$ begin
 if (select hits from talentia_private.api_limits where owner=current_setting('talentia.test_a')::uuid and bucket='ai-call' and window_seconds=86400)<>1 then raise exception 'denied call consumed the second quota';end if;
end $$;
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.consume_api_limit(text)','EXECUTE') then raise exception 'anonymous quota RPC allowed';end if;
 begin perform talentia_private.consume_api_limit('read');raise exception 'anonymous private RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
select 'passed' as result,'read exhaustion, retry interval, protected counters, fixed buckets, per-user isolation, hourly and daily AI caps, atomic denial, anonymous denial' as checks,'rolled back; no fixture data retained' as cleanup;

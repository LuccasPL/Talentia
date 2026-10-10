begin;
do $$ declare a uuid:=gen_random_uuid();b uuid:=gen_random_uuid();begin
 perform set_config('talentia.test_a',a::text,true);perform set_config('talentia.test_b',b::text,true);
 insert into auth.users(id,aud,role,email) values(a,'authenticated','authenticated','usage-'||a||'@example.invalid'),(b,'authenticated','authenticated','usage-'||b||'@example.invalid');
 perform set_config('request.jwt.claim.sub',a::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end $$;
set local role authenticated;
do $$ declare snapshot jsonb;item jsonb;begin
 perform public.consume_api_limit('read');snapshot:=public.api_usage_snapshot();
 if jsonb_array_length(snapshot->'limits')<>9 then raise exception 'missing policies';end if;
 select value into item from jsonb_array_elements(snapshot->'limits') where value->>'bucket'='read';
 if (item->>'used')::int<>1 or (item->>'remaining')::int<>59 then raise exception 'incorrect usage';end if;
 if (item->>'resetsAt')::timestamptz<=(snapshot->>'generatedAt')::timestamptz then raise exception 'expired renewal';end if;
 perform public.api_usage_snapshot();
 select value into item from jsonb_array_elements(public.api_usage_snapshot()->'limits') where value->>'bucket'='read';
 if (item->>'used')::int<>1 then raise exception 'snapshot changed counters';end if;
 if not (public.consume_api_limit('export')->>'allowed')::boolean or not (public.consume_api_limit('export')->>'allowed')::boolean then raise exception 'export denied early';end if;
 if (public.consume_api_limit('export')->>'allowed')::boolean then raise exception 'export cap bypassed';end if;
 perform set_config('request.jwt.claim.sub',current_setting('talentia.test_b'),true);perform set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('talentia.test_b'),'role','authenticated')::text,true);
 select value into item from jsonb_array_elements(public.api_usage_snapshot()->'limits') where value->>'bucket'='read';
 if (item->>'used')::int<>0 then raise exception 'other user counter disclosed';end if;
end $$;
set local role anon;
do $$ begin if has_function_privilege('anon','public.api_usage_snapshot()','EXECUTE') then raise exception 'anonymous snapshot access';end if;end $$;
reset role;
rollback;
select 'passed' as result,'own usage, all windows, renewal, read-only snapshot, export limit, account isolation, anonymous denial' as checks,'rolled back; no fixtures retained' as cleanup;

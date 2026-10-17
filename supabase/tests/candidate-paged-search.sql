begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); ca uuid:=gen_random_uuid(); cb uuid:=gen_random_uuid();
begin
  perform set_config('talentia.search_a',a::text,true);
  perform set_config('talentia.search_b',b::text,true);
  perform set_config('talentia.search_ca',ca::text,true);
  perform set_config('talentia.search_cb',cb::text,true);
  insert into auth.users(id,aud,role,email) values
    (a,'authenticated','authenticated','search-'||a||'@example.invalid'),
    (b,'authenticated','authenticated','search-'||b||'@example.invalid');
  insert into public.candidates(owner,id,name,city,role,payload) values
    (a,ca,'Ána Teste','São Paulo','Vendedora',jsonb_build_object('id',ca,'name','Ána Teste','city','São Paulo','role','Vendedora','text','Experiência em hospitalidade e varejo','updated','2026-01-01T00:00:00Z')),
    (b,cb,'Pessoa de outra conta','São Paulo','Vendedora',jsonb_build_object('id',cb,'name','Pessoa de outra conta','city','São Paulo','role','Vendedora','text','Experiência em hospitalidade e varejo','updated','2026-01-01T00:00:00Z'));
  perform set_config('request.jwt.claim.sub',a::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
end;$$;
set local role authenticated;
do $$
declare ca uuid:=current_setting('talentia.search_ca')::uuid; cb uuid:=current_setting('talentia.search_cb')::uuid; result jsonb;
begin
  result:=public.search_candidate_page('ana hospitalidade','sao paulo','varejo',1,'name');
  if (result->>'total')::int<>1 or result->'candidates'->0->>'id'<>ca::text then raise exception 'accent or combined term search failed';end if;
  if result->'candidates'->0 ? 'text' or result->'candidates'->0 ? 'phone' then raise exception 'full profile leaked into search result';end if;
  if result::text like '%'||cb::text||'%' then raise exception 'cross-account profile leaked';end if;
  result:=public.search_candidate_page('ana','', '',2,'name');
  if (result->>'total')::int<>1 or jsonb_array_length(result->'candidates')<>0 then raise exception 'pagination failed';end if;
  update public.candidates set payload=jsonb_set(payload,'{text}','"Hotelaria e recepção"'::jsonb) where id=ca;
  result:=public.search_candidate_page('hospitalidade','','',1,'name');
  if (result->>'total')::int<>0 then raise exception 'search index not refreshed after update';end if;
  result:=public.search_candidate_page('hotelaria','','',1,'name');
  if (result->>'total')::int<>1 then raise exception 'updated text not found';end if;
  if has_function_privilege('anon','public.search_candidate_page(text,text,text,integer,text)','EXECUTE') then raise exception 'anonymous access allowed';end if;
end;$$;
reset role;
rollback;
select 'passed' as result, 'accent normalization, combined terms, pagination, update trigger, account isolation, anonymous rejection' as checks;

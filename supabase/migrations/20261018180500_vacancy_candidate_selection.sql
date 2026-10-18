begin;

create function public.search_vacancy_candidate_selection(
 p_job_id text,
 p_query text default '',p_city text default '',p_experience text default '',
 p_pending text default 'all',p_criterion_id text default 'all',
 p_only_evidence boolean default false,p_sort text default 'name'
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare result jsonb;profiles jsonb;total integer;
begin
 if auth.uid() is null then raise exception 'authentication required' using errcode='42501';end if;
 result:=public.search_vacancy_candidate_page(p_job_id,p_query,p_city,p_experience,p_pending,p_criterion_id,p_only_evidence,1,p_sort);
 total:=(result->>'total')::integer;
 if total>100 then
  return jsonb_build_object('total',total,'candidateIds','[]'::jsonb,'candidates','[]'::jsonb);
 end if;
 select coalesce(jsonb_agg(c.payload order by selected.ordinality),'[]'::jsonb) into profiles
 from jsonb_array_elements_text(result->'candidateIds') with ordinality as selected(id,ordinality)
 join public.candidates c on c.id=selected.id::uuid and c.owner=(select auth.uid())
 where not (c.payload ? 'mergedInto');
 return result||jsonb_build_object('candidates',profiles);
end;$$;

revoke all on function public.search_vacancy_candidate_selection(text,text,text,text,text,text,boolean,text) from public,anon;
grant execute on function public.search_vacancy_candidate_selection(text,text,text,text,text,text,boolean,text) to authenticated;

commit;

begin;

create function public.search_vacancy_candidate_assisted_page(
  p_job_id text,
  p_plan jsonb,
  p_mode text default 'any',
  p_query text default '', p_city text default '', p_experience text default '',
  p_pending text default 'all', p_criterion_id text default 'all',
  p_only_evidence boolean default false, p_page integer default 1,
  p_sort text default 'name', p_selection boolean default false
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  conditions text := '';
  term text;
  term_count integer := 0;
  statement text;
  concept_count integer;
  invalid_concepts integer;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if jsonb_typeof(p_plan) is distinct from 'object' then raise exception 'invalid assisted search plan'; end if;
  if jsonb_typeof(p_plan->'concepts') is distinct from 'array' then raise exception 'invalid assisted search concepts'; end if;
  concept_count:=jsonb_array_length(p_plan->'concepts');
  if concept_count not between 1 and 8 or p_mode not in ('any','all')
     or char_length(coalesce(p_job_id,'')) not between 1 and 100
     or char_length(coalesce(p_query,'')) > 120
     or char_length(coalesce(p_city,'')) > 80
     or char_length(coalesce(p_experience,'')) > 120
     or char_length(coalesce(p_criterion_id,'')) > 100
     or p_pending not in ('all','contact','unverified-contact','unverified-location','location','interest','availability','not-contacted','not-analyzed','criteria')
     or p_page not between 1 and 10000
     or p_sort not in ('name','imported')
  then raise exception 'invalid assisted search parameters'; end if;

  select count(*)::integer into invalid_concepts
  from jsonb_array_elements(p_plan->'concepts') as concept(value)
  where jsonb_typeof(concept.value) is distinct from 'object'
     or jsonb_typeof(concept.value->'label') is distinct from 'string'
     or coalesce(char_length(btrim(concept.value->>'label')),0) not between 2 and 120
     or jsonb_typeof(concept.value->'terms') is distinct from 'array'
     or case when jsonb_typeof(concept.value->'terms')='array' then jsonb_array_length(concept.value->'terms') not between 1 and 8 else true end;
  if invalid_concepts <> 0 then raise exception 'invalid assisted search concepts'; end if;
  if exists(select 1 from jsonb_array_elements(p_plan->'concepts') as concept(value) cross join lateral jsonb_array_elements(concept.value->'terms') as term(value) where jsonb_typeof(term.value) is distinct from 'string' or char_length(btrim(term.value #>> '{}')) not between 2 and 80) then
    raise exception 'invalid assisted search terms';
  end if;
  if exists(
    select 1
    from jsonb_array_elements(p_plan->'concepts') as concept(value)
    cross join lateral (
      select trim(regexp_replace(lower(extensions.unaccent(concept.value->>'label')), '[^[:alnum:]]+', ' ', 'g')) as value
      union all
      select trim(regexp_replace(lower(extensions.unaccent(term.value #>> '{}')), '[^[:alnum:]]+', ' ', 'g'))
      from jsonb_array_elements(concept.value->'terms') as term(value)
    ) keyword
    where keyword.value ~ '(^| )(idade|sexo|genero|raca|etnia|religiao|estado civil|aparencia|deficiencia|orientacao sexual|sem filhos|com filhos|cpf|rg|data de nascimento|nacionalidade)( |$)'
  ) then raise exception 'protected attributes cannot be searched'; end if;

  for term in select regexp_split_to_table(
    trim(regexp_replace(lower(extensions.unaccent(coalesce(p_query,''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
  ) loop
    if term <> '' then
      term_count := term_count + 1;
      if term_count > 12 then raise exception 'too many search terms'; end if;
      conditions := conditions || format(' and c.search_document like %L', '%' || term || '%');
    end if;
  end loop;
  term_count := 0;
  for term in select regexp_split_to_table(
    trim(regexp_replace(lower(extensions.unaccent(coalesce(p_city,''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
  ) loop
    if term <> '' then
      term_count := term_count + 1;
      if term_count > 12 then raise exception 'too many city terms'; end if;
      conditions := conditions || format(' and c.search_city like %L', '%' || term || '%');
    end if;
  end loop;
  term_count := 0;
  for term in select regexp_split_to_table(
    trim(regexp_replace(lower(extensions.unaccent(coalesce(p_experience,''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
  ) loop
    if term <> '' then
      term_count := term_count + 1;
      if term_count > 12 then raise exception 'too many experience terms'; end if;
      conditions := conditions || format(' and c.search_experience like %L', '%' || term || '%');
    end if;
  end loop;

  statement := $query$
    with workspace as materialized (
      select jobs,records from public.workspaces where owner = (select auth.uid())
    ), job as materialized (
      select item as payload from workspace w
      cross join lateral jsonb_array_elements(w.jobs) item
      where item->>'id' = $1 limit 1
    ), analyses as materialized (
      select distinct on (item->>'candidateId') item->>'candidateId' as candidate_id, item as payload
      from job cross join lateral jsonb_array_elements(coalesce(job.payload->'analyses','[]'::jsonb)) item
      order by item->>'candidateId'
    ), record_links as materialized (
      select distinct on (item->>'candidateId') item->>'candidateId' as candidate_id, item as payload
      from workspace w cross join lateral jsonb_array_elements(w.records) item
      where item->>'jobId' = $1 order by item->>'candidateId'
    ), matching as materialized (
      select c.id,c.payload,c.payload->>'name' as name,c.payload->>'updated' as updated
      from public.candidates c cross join job
      left join analyses a on a.candidate_id = c.id::text
      left join record_links r on r.candidate_id = c.id::text
      where c.owner = (select auth.uid()) and not (c.payload ? 'mergedInto')
  $query$ || conditions || $query$
        and (not $4 or exists (
          select 1 from jsonb_array_elements(coalesce(a.payload->'evidence','[]'::jsonb)) e
          where e->>'status' = 'encontrada'))
        and ($3 = 'all' or exists (
          select 1 from jsonb_array_elements(coalesce(a.payload->'evidence','[]'::jsonb)) e
          where e->>'criterionId' = $3 and e->>'status' = 'encontrada'))
        and (
          $2 = 'all'
          or ($2 = 'contact' and (nullif(btrim(c.payload->>'phone'),'') is null or nullif(btrim(c.payload->>'email'),'') is null))
          or ($2 = 'unverified-contact' and (nullif(btrim(c.payload->>'phone'),'') is null or nullif(btrim(c.payload->>'email'),'') is null or c.payload->'verification'->'phone' is null or c.payload->'verification'->'email' is null))
          or ($2 = 'location' and nullif(btrim(c.payload->>'city'),'') is null)
          or ($2 = 'unverified-location' and (nullif(btrim(c.payload->>'city'),'') is null or c.payload->'verification'->'city' is null))
          or ($2 = 'interest' and (r.payload is null or r.payload->>'interest' = 'Não confirmado'))
          or ($2 = 'availability' and (r.payload is null or nullif(btrim(r.payload->>'availability'),'') is null or btrim(r.payload->>'availability') = 'Não confirmada'))
          or ($2 = 'not-contacted' and (r.payload is null or r.payload->>'status' = 'Não contatado'))
          or ($2 = 'not-analyzed' and a.payload is null)
          or ($2 = 'criteria' and exists (
            select 1 from jsonb_array_elements(coalesce(a.payload->'evidence','[]'::jsonb)) e
            where e->>'status' = 'confirmar'))
        )
    ), concepts as materialized (
      select concept.ordinality as concept_order, concept.value->>'label' as label,
             concept.value->'terms' as terms
      from jsonb_array_elements($5->'concepts') with ordinality concept(value,ordinality)
    ), hits as materialized (
      select m.id,concept.concept_order,concept.label,hit.source_term,hit.segment,hit.negated
      from matching m cross join concepts concept
      cross join lateral (
        select search_term.value as source_term,segment.value as segment,
          (left(normalized.value,greatest(position(' '||normalized_term.value||' ' in ' '||normalized.value||' ')-2,0))
            ~ '(^| )(nao|sem|nenhuma|nenhum)( [[:alnum:]]+){0,7}$') as negated
        from jsonb_array_elements_text(concept.terms) with ordinality search_term(value,ordinality)
        cross join lateral (select trim(regexp_replace(lower(extensions.unaccent(search_term.value)), '[^[:alnum:]]+', ' ', 'g')) as value) normalized_term
        cross join lateral regexp_split_to_table(concat_ws(E'\n',m.payload->>'role',m.payload->>'text'), E'\n|(?<=[.!?;])\s+') with ordinality segment(value,ordinality)
        cross join lateral (select trim(regexp_replace(lower(extensions.unaccent(segment.value)), '[^[:alnum:]]+', ' ', 'g')) as value) normalized
        where (' '||normalized.value||' ')
          like '%'||(' '||normalized_term.value||' ')||'%'
          and normalized.value !~ '^(idade|sexo|genero|raca|religiao|estado civil|cpf|rg|nascimento|data de nascimento|telefone|email|endereco|cep)( |$)'
        order by (left(normalized.value,greatest(position(' '||normalized_term.value||' ' in ' '||normalized.value||' ')-2,0))
          ~ '(^| )(nao|sem|nenhuma|nenhum)( [[:alnum:]]+){0,7}$'),segment.ordinality,search_term.ordinality
        limit 1
      ) hit
    ), grouped as materialized (
      select id,count(distinct concept_order)::integer as group_count,
        count(distinct concept_order) filter(where not negated)::integer as strong_count,
        jsonb_agg(jsonb_build_object('label',label,'term',source_term,'snippet',left(segment,500),'negated',negated) order by concept_order) as groups
      from hits group by id
    ), matched as materialized (
      select m.id,m.payload,m.name,m.updated,g.group_count,g.strong_count,g.groups
      from matching m join grouped g on g.id=m.id
      where ($6='any' and g.group_count>0) or ($6='all' and g.group_count=$7)
    ), ordered as materialized (
      select *,row_number() over(order by strong_count desc,group_count desc,
        case when $8='imported' then nullif(updated,'')::timestamptz end desc nulls last,
        lower(extensions.unaccent(name)),id) as position
      from matched
    ), totals as (select count(*)::integer as total from ordered), page as (
      select * from ordered where ($9 and position<=100) or (not $9 and position>($10-1)*24 and position<=$10*24)
    )
    select jsonb_build_object(
      'total',(select total from totals),
      'candidateIds',case when (select total from totals)<=100 then coalesce((select jsonb_agg(id::text order by position) from ordered),'[]'::jsonb) else '[]'::jsonb end,
      'candidates',coalesce((select jsonb_agg(payload order by position) from page),'[]'::jsonb),
      'matches',coalesce((select jsonb_agg(jsonb_build_object('candidateId',id::text,'groups',groups) order by position) from page),'[]'::jsonb)
    )
  $query$;
  execute statement into result using p_job_id,p_pending,p_criterion_id,p_only_evidence,p_plan,p_mode,concept_count,p_sort,p_selection,p_page;
  return result;
end;
$$;

revoke all on function public.search_vacancy_candidate_assisted_page(text,jsonb,text,text,text,text,text,text,boolean,integer,text,boolean) from public,anon;
grant execute on function public.search_vacancy_candidate_assisted_page(text,jsonb,text,text,text,text,text,text,boolean,integer,text,boolean) to authenticated;

commit;

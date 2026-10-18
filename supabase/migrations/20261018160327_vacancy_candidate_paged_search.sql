begin;

create function public.search_vacancy_candidate_page(
  p_job_id text,
  p_query text default '', p_city text default '', p_experience text default '',
  p_pending text default 'all', p_criterion_id text default 'all',
  p_only_evidence boolean default false, p_page integer default 1,
  p_sort text default 'name'
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  conditions text := '';
  term text;
  term_count integer := 0;
  statement text;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(coalesce(p_job_id,'')) not between 1 and 100
     or char_length(coalesce(p_query,'')) > 120
     or char_length(coalesce(p_city,'')) > 80
     or char_length(coalesce(p_experience,'')) > 120
     or char_length(coalesce(p_criterion_id,'')) > 100
     or p_pending not in ('all','contact','unverified-contact','unverified-location','location','interest','availability','not-contacted','not-analyzed','criteria')
     or p_page not between 1 and 10000
     or p_sort not in ('name','imported')
  then raise exception 'invalid search parameters'; end if;

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
      select c.id, c.payload->>'name' as name, c.payload->>'updated' as updated
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
    ), ordered as materialized (
      select id, row_number() over (order by
        case when $6 = 'imported' then nullif(updated,'')::timestamptz end desc nulls last,
        lower(extensions.unaccent(name)), id) as position
      from matching
    ), totals as (select count(*)::integer as total from matching), page as (
      select c.payload, o.position from ordered o
      join public.candidates c on c.owner = (select auth.uid()) and c.id = o.id
      where o.position > ($5 - 1) * 24 and o.position <= $5 * 24
    )
    select jsonb_build_object(
      'total', (select total from totals),
      'candidateIds', case when (select total from totals) <= 100
        then coalesce((select jsonb_agg(id::text order by position) from ordered),'[]'::jsonb)
        else '[]'::jsonb end,
      'candidates', coalesce((select jsonb_agg(payload order by position) from page),'[]'::jsonb)
    )
  $query$;
  execute statement into result using p_job_id,p_pending,p_criterion_id,p_only_evidence,p_page,p_sort;
  return result;
end;
$$;

revoke all on function public.search_vacancy_candidate_page(text,text,text,text,text,text,boolean,integer,text) from public, anon;
grant execute on function public.search_vacancy_candidate_page(text,text,text,text,text,text,boolean,integer,text) to authenticated;

commit;

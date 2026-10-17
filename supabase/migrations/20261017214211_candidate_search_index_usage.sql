begin;

create or replace function public.search_candidate_page(
  p_query text default '', p_city text default '', p_experience text default '',
  p_page integer default 1, p_sort text default 'name'
) returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  conditions text := '';
  term text;
  term_count integer := 0;
  result jsonb;
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode = '42501'; end if;
  if char_length(coalesce(p_query,'')) > 120 or char_length(coalesce(p_city,'')) > 80
     or char_length(coalesce(p_experience,'')) > 120 or p_page < 1 or p_page > 10000
     or p_sort not in ('name','imported') then raise exception 'invalid search parameters'; end if;

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

  execute 'with matching as materialized (
      select c.payload from public.candidates c
      where c.owner = (select auth.uid()) and not (c.payload ? ''mergedInto'')' || conditions || '
    ), page as (
      select payload from matching
      order by case when $1 = ''imported'' then nullif(payload->>''updated'', '''')::timestamptz end desc nulls last,
        lower(extensions.unaccent(payload->>''name'')), payload->>''id''
      limit 24 offset (greatest(1, least(coalesce($2, 1), 10000)) - 1) * 24
    ) select jsonb_build_object(
      ''total'', (select count(*) from matching),
      ''candidates'', coalesce((select jsonb_agg(jsonb_build_object(
        ''id'', payload->>''id'', ''name'', payload->>''name'', ''role'', payload->>''role'',
        ''city'', payload->>''city'', ''updated'', payload->>''updated'',
        ''textPreview'', left(coalesce(payload->>''text'',''''), 210)
      )) from page), ''[]''::jsonb)
    )'
  into result using p_sort, p_page;
  return result;
end;
$$;

commit;

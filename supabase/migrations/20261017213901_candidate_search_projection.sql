begin;

create or replace function public.search_candidate_page(
  p_query text default '', p_city text default '', p_experience text default '',
  p_page integer default 1, p_sort text default 'name'
) returns jsonb language sql stable security invoker set search_path = '' as $$
with terms as (
  select
    array(select '%' || term || '%' from regexp_split_to_table(
      trim(regexp_replace(lower(extensions.unaccent(coalesce(p_query, ''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
    ) term where term <> '') as query_terms,
    array(select '%' || term || '%' from regexp_split_to_table(
      trim(regexp_replace(lower(extensions.unaccent(coalesce(p_city, ''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
    ) term where term <> '') as city_terms,
    array(select '%' || term || '%' from regexp_split_to_table(
      trim(regexp_replace(lower(extensions.unaccent(coalesce(p_experience, ''))), '[^[:alnum:]]+', ' ', 'g')), '\s+'
    ) term where term <> '') as experience_terms
), matching as materialized (
  select c.payload
  from public.candidates c cross join terms t
  where c.owner = (select auth.uid())
    and not (c.payload ? 'mergedInto')
    and c.search_document like all(t.query_terms)
    and c.search_city like all(t.city_terms)
    and c.search_experience like all(t.experience_terms)
), page as (
  select payload from matching
  order by
    case when p_sort = 'imported' then nullif(payload->>'updated', '')::timestamptz end desc nulls last,
    lower(extensions.unaccent(payload->>'name')), payload->>'id'
  limit 24 offset (greatest(1, least(coalesce(p_page, 1), 10000)) - 1) * 24
)
select jsonb_build_object(
  'total', (select count(*) from matching),
  'candidates', coalesce((select jsonb_agg(jsonb_build_object(
    'id', payload->>'id', 'name', payload->>'name', 'role', payload->>'role',
    'city', payload->>'city', 'updated', payload->>'updated',
    'textPreview', left(coalesce(payload->>'text',''), 210)
  )) from page), '[]'::jsonb)
);
$$;


commit;

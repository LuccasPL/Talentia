begin;

create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.candidates
  add column search_document text not null default '',
  add column search_experience text not null default '',
  add column search_city text not null default '';

create function private.refresh_candidate_search() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.search_document := lower(extensions.unaccent(concat_ws(' ', new.name, new.role, new.city, new.payload->>'text')));
  new.search_experience := lower(extensions.unaccent(concat_ws(' ', new.role, new.payload->>'text')));
  new.search_city := lower(extensions.unaccent(new.city));
  return new;
end;
$$;

create trigger refresh_candidate_search_before_write
before insert or update of name, role, city, payload on public.candidates
for each row execute function private.refresh_candidate_search();

update public.candidates set name = name;

create index candidates_search_document_trgm on public.candidates using gin (search_document extensions.gin_trgm_ops);
create index candidates_search_experience_trgm on public.candidates using gin (search_experience extensions.gin_trgm_ops);
create index candidates_search_city_trgm on public.candidates using gin (search_city extensions.gin_trgm_ops);

create function public.search_candidate_page(
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
  'candidates', coalesce((select jsonb_agg(payload) from page), '[]'::jsonb)
);
$$;

revoke all on function public.search_candidate_page(text,text,text,integer,text) from public, anon;
grant execute on function public.search_candidate_page(text,text,text,integer,text) to authenticated;

commit;

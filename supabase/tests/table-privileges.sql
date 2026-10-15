-- Catalog-only regression: never execute TRUNCATE or read candidate data.
do $$
declare item record; role_name text; privilege_name text;
begin
 for item in
  select c.oid, n.nspname, c.relname
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind in ('r','p')
 loop
  foreach role_name in array array['anon','authenticated'] loop
   foreach privilege_name in array array['TRUNCATE','REFERENCES','TRIGGER'] loop
    if has_table_privilege(role_name,item.oid,privilege_name) then
     raise exception 'Unexpected privilege % for % on %.%',privilege_name,role_name,item.nspname,item.relname;
    end if;
   end loop;
  end loop;
 end loop;
 foreach privilege_name in array array['SELECT','INSERT','UPDATE','DELETE'] loop
  if not has_table_privilege('authenticated','public.pdf_imports',privilege_name) then
   raise exception 'Missing required pdf_imports privilege %',privilege_name;
  end if;
  if has_table_privilege('anon','public.pdf_imports',privilege_name) then
   raise exception 'Anonymous pdf_imports access: %',privilege_name;
  end if;
 end loop;
 if not (select relrowsecurity from pg_class where oid='public.pdf_imports'::regclass) then
  raise exception 'pdf_imports RLS must remain enabled';
 end if;
 if not has_function_privilege('authenticated','public.complete_pdf_import(uuid,jsonb)','EXECUTE')
 or has_function_privilege('anon','public.complete_pdf_import(uuid,jsonb)','EXECUTE') then
  raise exception 'Unexpected complete_pdf_import access';
 end if;
end;
$$;

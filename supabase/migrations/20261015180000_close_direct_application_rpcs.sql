-- Phase B of the public application gateway. Apply ONLY after the site that calls
-- application_view/application_submit (with the server key) is deployed and verified.
-- Removes anonymous access to the old entry points, which accepted calls straight from the public anon key.
revoke execute on function public.access_application_link(text),public.submit_application(text,jsonb,text,text) from anon;
revoke execute on function private.access_application_link(text),private.submit_application(text,jsonb,text,text) from anon;
drop function public.access_application_link(text);
drop function public.submit_application(text,jsonb,text,text);
drop function private.access_application_link(text);
drop function private.submit_application(text,jsonb,text,text);

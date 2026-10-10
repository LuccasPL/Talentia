create or replace function talentia_private.consume_api_limit(bucket_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare user_id uuid:=auth.uid(); seconds integer[]; caps integer[];
 epoch bigint:=floor(extract(epoch from clock_timestamp())); starts bigint[];
 counts integer[]; count_now integer; retry integer:=0; idx integer;
begin
 if user_id is null then raise exception 'Authentication required' using errcode='42501'; end if;
 case bucket_name
  when 'read' then seconds:=array[60];caps:=array[60];
  when 'write' then seconds:=array[60];caps:=array[30];
  when 'imports-read' then seconds:=array[60];caps:=array[30];
  when 'imports-sync' then seconds:=array[60];caps:=array[6];
  when 'upload' then seconds:=array[60];caps:=array[30];
  when 'export' then seconds:=array[60];caps:=array[2];
  when 'ai-request' then seconds:=array[600];caps:=array[6];
  when 'ai-call' then seconds:=array[3600,86400];caps:=array[60,200];
  else raise exception 'Unknown rate bucket' using errcode='22023';
 end case;
 perform pg_advisory_xact_lock(hashtextextended(user_id::text||':'||bucket_name,0));
 delete from talentia_private.api_limits where owner=user_id and window_start < epoch-172800;
 for idx in 1..array_length(seconds,1) loop
  starts[idx]:=(epoch/seconds[idx])*seconds[idx];
  select hits into count_now from talentia_private.api_limits where owner=user_id and bucket=bucket_name and window_seconds=seconds[idx] and window_start=starts[idx];
  counts[idx]:=coalesce(count_now,0);
  if counts[idx]>=caps[idx] then retry:=greatest(retry,(starts[idx]+seconds[idx]-epoch)::integer);end if;
 end loop;
 if retry>0 then return jsonb_build_object('allowed',false,'retry_after',retry);end if;
 for idx in 1..array_length(seconds,1) loop
  insert into talentia_private.api_limits(owner,bucket,window_seconds,window_start,hits) values(user_id,bucket_name,seconds[idx],starts[idx],1)
  on conflict(owner,bucket,window_seconds,window_start) do update set hits=talentia_private.api_limits.hits+1;
 end loop;
 return jsonb_build_object('allowed',true,'retry_after',0);
end $$;

-- Read-only projection: no owner or limits are supplied by the caller.
create function talentia_private.api_usage_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_id uuid:=auth.uid(); epoch bigint:=floor(extract(epoch from clock_timestamp())); result jsonb;
begin
 if user_id is null then raise exception 'Authentication required' using errcode='42501';end if;
 with policies(bucket,seconds,cap) as (values
 ('read',60,60),('write',60,30),('imports-read',60,30),('imports-sync',60,6),('upload',60,30),('export',60,2),('ai-request',600,6),('ai-call',3600,60),('ai-call',86400,200)
 ) select jsonb_build_object('generatedAt',to_timestamp(epoch),'limits',jsonb_agg(jsonb_build_object(
 'bucket',p.bucket,'windowSeconds',p.seconds,'limit',p.cap,'used',coalesce(a.hits,0),'remaining',greatest(0,p.cap-coalesce(a.hits,0)),
 'resetsAt',to_timestamp((epoch/p.seconds)*p.seconds+p.seconds)
 ) order by p.bucket,p.seconds)) into result
 from policies p left join talentia_private.api_limits a on a.owner=user_id and a.bucket=p.bucket and a.window_seconds=p.seconds and a.window_start=(epoch/p.seconds)*p.seconds;
 return result;
end $$;
revoke all on function talentia_private.api_usage_snapshot() from public,anon;
grant execute on function talentia_private.api_usage_snapshot() to authenticated;
create function public.api_usage_snapshot() returns jsonb
language sql security invoker set search_path='' as $$ select talentia_private.api_usage_snapshot(); $$;
revoke all on function public.api_usage_snapshot() from public,anon;
grant execute on function public.api_usage_snapshot() to authenticated;

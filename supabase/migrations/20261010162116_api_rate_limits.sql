create schema if not exists talentia_private;
revoke all on schema talentia_private from public, anon;
grant usage on schema talentia_private to authenticated;

create table talentia_private.api_limits (
 owner uuid not null references auth.users(id) on delete cascade,
 bucket text not null,
 window_seconds integer not null,
 window_start bigint not null,
 hits integer not null check (hits > 0),
 primary key (owner,bucket,window_seconds,window_start)
);
alter table talentia_private.api_limits enable row level security;
revoke all on talentia_private.api_limits from public,anon,authenticated;

-- A narrowly scoped definer is required: clients must never reset the counters.
-- It lives outside the Data API and derives the owner exclusively from auth.uid().
create function talentia_private.consume_api_limit(bucket_name text) returns jsonb
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
revoke all on function talentia_private.consume_api_limit(text) from public,anon;
grant execute on function talentia_private.consume_api_limit(text) to authenticated;

create function public.consume_api_limit(bucket_name text) returns jsonb
language sql security invoker set search_path='' as $$ select talentia_private.consume_api_limit(bucket_name); $$;
revoke all on function public.consume_api_limit(text) from public,anon;
grant execute on function public.consume_api_limit(text) to authenticated;

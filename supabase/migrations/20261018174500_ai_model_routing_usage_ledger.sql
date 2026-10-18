begin;

create table talentia_private.ai_usage (
 owner uuid not null references auth.users(id) on delete cascade,
 event_key text not null check(length(event_key) between 1 and 200),
 task text not null check(task in ('pdf-extraction','criteria','assisted-search','candidate-analysis')),
 model text not null check(length(model) between 1 and 100),
 is_batch boolean not null default false,
 input_tokens integer not null default 0 check(input_tokens between 0 and 2000000),
 output_tokens integer not null default 0 check(output_tokens between 0 and 200000),
 cache_read_tokens integer not null default 0 check(cache_read_tokens between 0 and 2000000),
 cache_write_tokens integer not null default 0 check(cache_write_tokens between 0 and 2000000),
 created_at timestamptz not null default now(),
 primary key(owner,event_key)
);
create index ai_usage_owner_created_at_idx on talentia_private.ai_usage(owner,created_at desc);
alter table talentia_private.ai_usage enable row level security;
revoke all on talentia_private.ai_usage from public,anon,authenticated;

create function talentia_private.record_ai_usage(
 p_event_key text,p_task text,p_model text,p_is_batch boolean,
 p_input_tokens integer,p_output_tokens integer,p_cache_read_tokens integer,p_cache_write_tokens integer
) returns boolean language plpgsql security definer set search_path='' as $$
declare user_id uuid:=auth.uid();
begin
 if user_id is null then raise exception 'authentication required' using errcode='42501';end if;
 if length(coalesce(p_event_key,'')) not between 1 and 200
   or p_task not in ('pdf-extraction','criteria','assisted-search','candidate-analysis')
   or length(coalesce(p_model,'')) not between 1 and 100
   or p_input_tokens not between 0 and 2000000
   or p_output_tokens not between 0 and 200000
   or p_cache_read_tokens not between 0 and 2000000
   or p_cache_write_tokens not between 0 and 2000000
 then raise exception 'invalid AI usage';end if;
 insert into talentia_private.ai_usage(owner,event_key,task,model,is_batch,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens)
 values(user_id,p_event_key,p_task,p_model,coalesce(p_is_batch,false),p_input_tokens,p_output_tokens,p_cache_read_tokens,p_cache_write_tokens)
 on conflict(owner,event_key) do nothing;
 return found;
end;$$;
revoke all on function talentia_private.record_ai_usage(text,text,text,boolean,integer,integer,integer,integer) from public,anon;
grant execute on function talentia_private.record_ai_usage(text,text,text,boolean,integer,integer,integer,integer) to authenticated;

create function talentia_private.ai_usage_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare user_id uuid:=auth.uid();result jsonb;
begin
 if user_id is null then raise exception 'authentication required' using errcode='42501';end if;
 select jsonb_build_object(
  'generatedAt',clock_timestamp(),'windowDays',30,
  'entries',coalesce(jsonb_agg(jsonb_build_object(
   'task',u.task,'model',u.model,'batch',u.is_batch,'calls',u.calls,
   'inputTokens',u.input_tokens,'outputTokens',u.output_tokens,
   'cacheReadTokens',u.cache_read_tokens,'cacheWriteTokens',u.cache_write_tokens
  ) order by u.task,u.model,u.is_batch),'[]'::jsonb)
 ) into result
 from (
  select task,model,is_batch,count(*)::integer calls,
   sum(input_tokens)::integer input_tokens,sum(output_tokens)::integer output_tokens,
   sum(cache_read_tokens)::integer cache_read_tokens,sum(cache_write_tokens)::integer cache_write_tokens
  from talentia_private.ai_usage
  where owner=user_id and created_at>=clock_timestamp()-interval '30 days'
  group by task,model,is_batch
 ) u;
 return result;
end;$$;
revoke all on function talentia_private.ai_usage_snapshot() from public,anon;
grant execute on function talentia_private.ai_usage_snapshot() to authenticated;

create function public.record_ai_usage(
 p_event_key text,p_task text,p_model text,p_is_batch boolean,
 p_input_tokens integer,p_output_tokens integer,p_cache_read_tokens integer,p_cache_write_tokens integer
) returns boolean language sql security invoker set search_path='' as $$
 select talentia_private.record_ai_usage(p_event_key,p_task,p_model,p_is_batch,p_input_tokens,p_output_tokens,p_cache_read_tokens,p_cache_write_tokens);
$$;
revoke all on function public.record_ai_usage(text,text,text,boolean,integer,integer,integer,integer) from public,anon;
grant execute on function public.record_ai_usage(text,text,text,boolean,integer,integer,integer,integer) to authenticated;

create function public.ai_usage_snapshot() returns jsonb language sql security invoker set search_path='' as $$
 select talentia_private.ai_usage_snapshot();
$$;
revoke all on function public.ai_usage_snapshot() from public,anon;
grant execute on function public.ai_usage_snapshot() to authenticated;

commit;

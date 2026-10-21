-- Per-person daily AI usage, so one user can't drain the shared Anthropic credit.
-- Applied to project "proofwork" on 2026-10-21.
create table public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  calls int not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
create policy "read own usage" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Atomically counts one AI call for the signed-in user (UTC day). Returns calls left today, or raises PW_AI_LIMIT.
create or replace function public.consume_ai_quota(daily_limit int) returns int
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); used int;
begin
  if uid is null then raise exception 'Not signed in'; end if;
  insert into public.ai_usage (user_id, day, calls) values (uid, (now() at time zone 'utc')::date, 1)
  on conflict (user_id, day) do update set calls = public.ai_usage.calls + 1
  returning calls into used;
  if used > daily_limit then
    update public.ai_usage set calls = calls - 1 where user_id = uid and day = (now() at time zone 'utc')::date;
    raise exception 'PW_AI_LIMIT';
  end if;
  return daily_limit - used;
end $$;
revoke execute on function public.consume_ai_quota(int) from public, anon;
grant execute on function public.consume_ai_quota(int) to authenticated;

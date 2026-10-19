-- Follow-up to 0001 after running Supabase's security and performance advisors.
-- Applied to project "proofwork" on 2026-10-19.

-- Internal helpers live in a schema the API does not expose.
create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.pw_assert_log_date(uid uuid, d date) returns void
language plpgsql security definer set search_path = public as $$
declare
  tz text; wd int[]; today date; prev date; i int;
begin
  select timezone, work_days into tz, wd from public.profiles where id = uid;
  today := (now() at time zone coalesce(tz, 'UTC'))::date;
  if d > today then raise exception 'PW_FUTURE_DATE'; end if;
  prev := today - 1;
  for i in 1..7 loop
    exit when extract(dow from prev)::int = any(coalesce(wd, '{1,2,3,4,5}'));
    prev := prev - 1;
  end loop;
  if d < prev then raise exception 'PW_LOCKED_DATE'; end if;
end $$;
revoke execute on function private.pw_assert_log_date(uuid, date) from public, anon;
grant execute on function private.pw_assert_log_date(uuid, date) to authenticated;

create or replace function public.pw_entries_window() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform private.pw_assert_log_date(old.user_id, old.entry_date);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.entry_date <> old.entry_date then raise exception 'PW_LOCKED_DATE'; end if;
  perform private.pw_assert_log_date(new.user_id, new.entry_date);
  return new;
end $$;

create or replace function public.pw_daily_logs_window() returns trigger
language plpgsql set search_path = public as $$
begin
  perform private.pw_assert_log_date(new.user_id, new.log_date);
  return new;
end $$;

drop function public.pw_assert_log_date(uuid, date);

-- Usernames are chosen after signing in, so anonymous visitors don't need this.
revoke execute on function public.username_available(text) from public, anon;
grant execute on function public.username_available(text) to authenticated;

create index on public.entries (category_id);
create index on public.entries (metric_id);
create index on public.kpi_metrics (category_id);
create index on public.report_shares (report_id);
create index on public.report_shares (user_id);
create index on public.tasks (category_id);

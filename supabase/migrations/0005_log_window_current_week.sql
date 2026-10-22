-- Logging window: any day from Monday of the current week (or the previous work day, if earlier) up to today.
-- Applied to project "proofwork" on 2026-10-22.
create or replace function private.pw_assert_log_date(uid uuid, d date) returns void
language plpgsql security definer set search_path = public as $$
declare
  tz text; wd int[]; today date; prev date; monday date; i int;
begin
  select timezone, work_days into tz, wd from public.profiles where id = uid;
  today := (now() at time zone coalesce(tz, 'UTC'))::date;
  if d > today then raise exception 'PW_FUTURE_DATE'; end if;
  prev := today - 1;
  for i in 1..7 loop
    exit when extract(dow from prev)::int = any(coalesce(wd, '{1,2,3,4,5}'));
    prev := prev - 1;
  end loop;
  monday := date_trunc('week', today)::date; -- ISO weeks start on Monday
  if d < least(monday, prev) then raise exception 'PW_LOCKED_DATE'; end if;
end $$;

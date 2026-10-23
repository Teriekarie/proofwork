-- Entries on locked days may still be re-filed (KPI / metric / quantity change only).
-- Their wording, date and everything else stay locked.
-- Applied to project "proofwork" on 2026-10-23.
create or replace function public.pw_entries_window() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform private.pw_assert_log_date(old.user_id, old.entry_date);
    return old;
  end if;
  if tg_op = 'UPDATE' then
    if new.entry_date <> old.entry_date then raise exception 'PW_LOCKED_DATE'; end if;
    if (to_jsonb(new) - 'category_id' - 'metric_id' - 'quantity') = (to_jsonb(old) - 'category_id' - 'metric_id' - 'quantity') then
      return new; -- re-filing only
    end if;
  end if;
  perform private.pw_assert_log_date(new.user_id, new.entry_date);
  return new;
end $$;

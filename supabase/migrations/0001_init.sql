-- Proofwork schema. Every table is protected by Row Level Security so a user
-- can only read and write their own rows. Run this once in the Supabase SQL editor
-- (or with `supabase db push`).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tables

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  username text not null default '',
  avatar_url text,
  job_title text not null default '',
  department text not null default '',
  manager_name text not null default '',
  company text not null default '',
  location text not null default '',
  timezone text not null default 'UTC',
  work_arrangement text check (work_arrangement in ('remote', 'hybrid', 'on_site')),
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract')),
  work_days int[] not null default '{1,2,3,4,5}',
  standup_time text not null default '09:30',
  reminder_time text not null default '17:00',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);
-- Usernames are unique regardless of case; empty means "not chosen yet".
create unique index profiles_username_key on public.profiles (lower(username)) where username <> '';

create table public.job_descriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  source text not null check (source in ('upload', 'paste')),
  file_name text,
  jd_text text not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index job_descriptions_one_current on public.job_descriptions (user_id) where is_current;

create table public.kpi_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name text not null,
  description text not null default '',
  color text not null default '#1D9E75',
  is_extra boolean not null default false,
  sort_order int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.kpi_categories (user_id);

create table public.kpi_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  category_id uuid not null references public.kpi_categories (id) on delete cascade,
  name text not null,
  target_value numeric,
  unit text not null default '',
  period text not null default 'month' check (period in ('week', 'month', 'quarter'))
);
create index on public.kpi_metrics (user_id);

create table public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  log_date date not null,
  raw_input text not null default '',
  day_type text not null default 'work' check (day_type in ('work', 'leave', 'holiday', 'sick')),
  mood smallint check (mood between 1 and 5),
  unique (user_id, log_date)
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  entry_date date not null,
  category_id uuid not null references public.kpi_categories (id),
  metric_id uuid references public.kpi_metrics (id) on delete set null,
  raw_text text not null default '',
  refined_text text not null,
  entry_type text not null default 'normal' check (entry_type in ('normal', 'above_beyond', 'blocker')),
  status text not null default 'done' check (status in ('done', 'in_progress')),
  quantity numeric,
  impact_note text not null default '',
  blocker_detail text not null default '',
  evidence_url text not null default '',
  stakeholders text[] not null default '{}',
  is_late boolean not null default false,
  ai_confidence real,
  created_at timestamptz not null default now()
);
create index on public.entries (user_id, entry_date);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  task_date date not null,
  title text not null,
  category_id uuid references public.kpi_categories (id) on delete set null,
  done_at timestamptz,
  carried_from date,
  created_at timestamptz not null default now()
);
create index on public.tasks (user_id, task_date);

create table public.standups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  standup_date date not null,
  yesterday text[] not null default '{}',
  today text[] not null default '{}',
  blockers text[] not null default '{}',
  generated_at timestamptz not null default now(),
  edited boolean not null default false,
  unique (user_id, standup_date)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  period_type text not null check (period_type in ('week', 'month', 'quarter', 'year')),
  period_start date not null,
  period_end date not null,
  title text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.reports (user_id);

create table public.report_shares (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  token text not null unique default encode(gen_random_bytes(18), 'hex'),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- row level security

alter table public.profiles enable row level security;
create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array['job_descriptions', 'kpi_categories', 'kpi_metrics', 'daily_logs', 'entries', 'tasks', 'standups', 'reports', 'report_shares'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- A share can only point at one of your own reports.
create policy "share own reports only" on public.report_shares as restrictive for insert
  with check (exists (select 1 from public.reports r where r.id = report_id and r.user_id = auth.uid()));

-- ---------------------------------------------------------------- new users

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  insert into public.kpi_categories (user_id, name, description, color, is_extra, sort_order)
  values (new.id, 'Beyond Scope', 'Work that falls outside your defined KPIs — still tracked, still counts.', '#94A3B8', true, 999);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- logging window
-- Today is open; the previous work day is open (late entries); older days are locked; no future dates.

create or replace function public.pw_assert_log_date(uid uuid, d date) returns void
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

create or replace function public.pw_entries_window() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    perform public.pw_assert_log_date(old.user_id, old.entry_date);
    return old;
  end if;
  if tg_op = 'UPDATE' and new.entry_date <> old.entry_date then raise exception 'PW_LOCKED_DATE'; end if;
  perform public.pw_assert_log_date(new.user_id, new.entry_date);
  return new;
end $$;
create trigger entries_window before insert or update or delete on public.entries
  for each row execute function public.pw_entries_window();

create or replace function public.pw_daily_logs_window() returns trigger
language plpgsql as $$
begin
  perform public.pw_assert_log_date(new.user_id, new.log_date);
  return new;
end $$;
create trigger daily_logs_window before insert or update on public.daily_logs
  for each row execute function public.pw_daily_logs_window();

-- ---------------------------------------------------------------- RPCs

create or replace function public.username_available(name text) returns boolean
language sql security definer set search_path = public stable as $$
  select not exists (
    select 1 from public.profiles
    where lower(username) = lower(trim(name)) and id is distinct from auth.uid()
  );
$$;
grant execute on function public.username_available(text) to anon, authenticated;

create or replace function public.apply_kpi_drafts(drafts jsonb) returns void
language plpgsql security invoker set search_path = public as $$
declare
  k jsonb; m jsonb; cid uuid; i int := 0;
  palette text[] := array['#1D9E75', '#3B73D9', '#C97A16', '#8B5CF6', '#E1546A', '#0B8BCB', '#5E9A0C', '#C944DE'];
begin
  update public.kpi_categories set archived_at = now()
    where user_id = auth.uid() and not is_extra and archived_at is null;
  if not exists (select 1 from public.kpi_categories where user_id = auth.uid() and is_extra) then
    insert into public.kpi_categories (name, description, color, is_extra, sort_order)
    values ('Beyond Scope', 'Work that falls outside your defined KPIs — still tracked, still counts.', '#94A3B8', true, 999);
  end if;
  for k in select * from jsonb_array_elements(drafts) loop
    insert into public.kpi_categories (name, description, color, sort_order)
    values (k ->> 'name', coalesce(k ->> 'description', ''), palette[(i % 8) + 1], i)
    returning id into cid;
    for m in select * from jsonb_array_elements(coalesce(k -> 'metrics', '[]')) loop
      insert into public.kpi_metrics (category_id, name, target_value, unit, period)
      values (cid, m ->> 'name', nullif(m ->> 'target_value', '')::numeric, coalesce(m ->> 'unit', ''), coalesce(m ->> 'period', 'month'));
    end loop;
    i := i + 1;
  end loop;
end $$;
grant execute on function public.apply_kpi_drafts(jsonb) to authenticated;

-- Public read of a single shared report by token (only the report + owner's name/title).
create or replace function public.get_shared_report(share_token text) returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'report', to_jsonb(r),
    'owner', jsonb_build_object('full_name', p.full_name, 'job_title', p.job_title, 'company', p.company)
  )
  from public.report_shares s
  join public.reports r on r.id = s.report_id
  join public.profiles p on p.id = r.user_id
  where s.token = share_token
    and s.revoked_at is null
    and (s.expires_at is null or s.expires_at > now())
  limit 1;
$$;
grant execute on function public.get_shared_report(text) to anon, authenticated;

create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  -- Entries have a delete trigger for the logging window; bypass it for full account deletion.
  alter table public.entries disable trigger entries_window;
  delete from public.entries where user_id = auth.uid();
  alter table public.entries enable trigger entries_window;
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------- storage (avatars)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 3145728, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "avatar upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar update own folder" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatar delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

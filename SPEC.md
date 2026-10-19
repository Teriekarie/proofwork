# Proofwork — Product Spec (v1)

**Tagline:** Every day, on the record.

Proofwork lets an employee upload their job description, get AI-generated KPI
categories and metrics, log daily work in plain language, and have AI file each
item under the right KPI. From that log it produces standup updates and
weekly / monthly / quarterly / yearly reports.

Audience: individuals (me, colleagues, friends). Company/team workspaces are a
later version.

---

## Agreed decisions

| Topic | Decision |
|---|---|
| Name | Proofwork |
| Logging window | Add/edit entries for **today** and the **previous working day** (late entries get a `late` tag). Older days are read-only. No future dates. |
| Sign-in | Email + password, Google, Microsoft |
| Planner | In v1 |
| Manager access | v1: export (PDF / Word / copy) **and** a read-only share link per report (revocable, optional expiry). v2: company workspaces where managers see their team. |
| Backend | Supabase (Auth, Postgres, Storage, Edge Functions) — new project |
| AI | Claude API, called only from Supabase Edge Functions (key never in the browser) |
| Extras category | "Beyond Scope" — auto-created for every user, tracked like any KPI |

---

## Core loop

1. Onboarding: profile → work setup → JD (upload PDF/DOCX or paste) → AI generates KPIs → user edits and confirms.
2. End of day: user writes what they did in free text.
3. "Organise with AI": splits into items, rewrites each professionally, assigns KPI
   (or Beyond Scope), detects type (normal / above & beyond / blocker), status,
   stakeholders, quantities. User reviews cards, adjusts, confirms.
4. Standup (Yesterday / Today / Blockers) generated from the last working day's log + today's planner.
5. Reports aggregate entries for any period.

---

## Pages

| Route | Page |
|---|---|
| `/` | Landing (public) |
| `/signup`, `/login`, `/forgot-password`, `/reset-password`, `/verify-email` | Auth |
| `/onboarding` | 4-step wizard (first login only) |
| `/home` | Welcome: today's status, section overview, quick actions |
| `/dashboard` | Stat tiles, KPI cards, activity heatmap, time-by-category chart, recent feed |
| `/log` | Daily log: free-text + AI organise + entry cards; date switcher (today / prev working day editable, older read-only) |
| `/standup` | Generated standup, copy, read-aloud view, history |
| `/planner` | Today's to-dos, carry-over, "done → add to log" |
| `/history` | Day / Week / Month / Quarter / Year views, search, filters, export |
| `/reports` | Generate + edit + export + share weekly / monthly / quarterly / yearly reports |
| `/kpis` | Manage categories & metrics, per-KPI drill-down |
| `/insights` | Above & beyond list, neglected KPIs, low-activity weeks vs own baseline, focus balance |
| `/profile`, `/settings` | Profile, JD, password, reminders, data export, delete account |
| `/share/:token` | Public read-only shared report |

---

## Profile fields

Full name · username (unique, case-insensitive) · avatar · job title · department ·
manager name (optional) · company · location · timezone · work arrangement
(remote / hybrid / on-site) · employment type (full-time / part-time / contract) ·
work days · standup time · end-of-day reminder time.

---

## Data model (Postgres, all tables RLS: `user_id = auth.uid()`)

- **profiles** — `id (= auth.users.id)`, fields above, `onboarded_at`
- **job_descriptions** — `id, user_id, source (upload|paste), file_name, jd_text, is_current, created_at` (uploaded files are read in the browser; only the text is stored)
- **kpi_categories** — `id, user_id, name, description, color, icon, is_extra (Beyond Scope), sort_order, archived_at`
- **kpi_metrics** — `id, user_id, category_id, name, target_value, unit, period (week|month|quarter)`
- **daily_logs** — `id, user_id, log_date, raw_input, day_type (work|leave|holiday|sick), mood (1–5, optional)` · unique `(user_id, log_date)`
- **entries** — `id, user_id, entry_date, category_id, metric_id, raw_text, refined_text, entry_type (normal|above_beyond|blocker), status (done|in_progress), quantity, impact_note, blocker_detail, evidence_url, stakeholders text[] (e.g. HR, Finance, client), is_late, ai_confidence, created_at`
- **projects** (v2) — `id, user_id, name, category_id, status, started_on, completed_on`
- **tasks** (planner) — `id, user_id, task_date, title, category_id, done_at, carried_from`
- **standups** — `id, user_id, standup_date, yesterday, today, blockers, generated_at, edited`
- **reports** — `id, user_id, period_type, period_start, period_end, content (json), edited, created_at`
- **report_shares** — `id, report_id, token, expires_at, revoked_at`
- KPI suggestions (recurring Beyond Scope themes) are computed on the fly, not stored.

Logging window enforced in the database (trigger), not just the UI.

---

## Security

- Supabase Auth: bcrypt-hashed passwords, email verification, reset links, rate limiting, OAuth (Google, Microsoft)
- Password strength meter + rules on signup; leaked-password check when available
- Unique email (Auth) and unique username (DB constraint on `lower(username)`)
- RLS on every table; private Storage buckets for avatars and JD files
- AI calls via Edge Functions only; Anthropic key stored as a Supabase secret
- Data export (JSON/CSV) and account deletion

---

## Stack

Vite · React · TypeScript · Tailwind CSS · React Router · TanStack Query ·
Supabase JS · Recharts · Framer Motion · pdf.js (JD parsing) · mammoth (DOCX) ·
docx (Word export). Installable PWA. Hosting: Vercel or Netlify.

## Design

Navy `#1A3C5E` primary, teal `#1D9E75` accent, light surfaces `#F5F7FA`, Inter.
Light and dark mode. Mobile-first: bottom tab bar on phones, sidebar on desktop.
Type badges: above & beyond = green, blocker = red, normal = grey.

---

## Later versions

- v2: weekly/quarterly/yearly polish, Word export themes, email reminders, projects view, voice logging
- v3: company workspaces & team dashboards, calendar / Teams / Jira integrations

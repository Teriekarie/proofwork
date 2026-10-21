# Proofwork

*Every day, on the record.* Log your daily work in plain words; Proofwork maps it to your KPIs, writes your standup, and builds weekly / monthly / quarterly / yearly reports. Full product spec: [SPEC.md](SPEC.md).

**Live:** https://proofwork-xi.vercel.app · Hosting: Vercel (auto-deploys every push to `main`) · Backend: Supabase project `proofwork`.

> Vercel's Hobby plan only deploys commits authored by the account owner, so commits must use the GitHub/Vercel account email (`git config user.email`).

## Run it locally

Node.js and Git are installed portably in `%USERPROFILE%\tools` (on your user PATH, so open a new terminal after setup).

```bash
npm install
npm run dev
```

Open http://localhost:5173.

> **Network note:** the office network blocks `registry.npmjs.org`. Run `npm install` on another network (hotspot / home Wi-Fi).

### Demo mode

With no Supabase keys, the app runs in **demo mode**: accounts and data live only in that browser's storage, and the AI features use built-in offline rules instead of Claude. Everything else works the same.

## Connect Supabase (real accounts, sync, Claude AI)

1. **Create a project** at https://supabase.com (free tier is fine). Pick a region close to you and save the database password somewhere safe.
2. **Create the database**: Supabase dashboard → *SQL Editor* → paste all of [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → *Run*.
3. **Add the keys to the app**: copy `.env.example` to `.env.local` and fill in *Project Settings → API → Project URL* and the *anon public* key. Restart `npm run dev`. The demo banner disappears.
4. **Auth settings** (*Authentication → Providers / URL Configuration*):
   - Email: keep *Confirm email* **on** (stops fake and duplicate sign-ups).
   - Site URL: `http://localhost:5173` for now (your real domain later); add `http://localhost:5173/**` to Redirect URLs.
   - Password strength: set minimum length 10 and turn on *leaked password protection* if your plan has it.
5. **Turn on Claude AI** (requires the Supabase CLI via `npx`, and an API key from https://console.anthropic.com):
   ```bash
   npx supabase login
   ```
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
   ```bash
   npx supabase secrets set ANTHROPIC_API_KEY=your-key-here
   ```
   ```bash
   npx supabase functions deploy ai
   ```
   Type the key yourself: it is stored as a server secret and never shipped to browsers.
6. **Google & Microsoft sign-in** (optional, any time later):
   - Google: create an OAuth client in Google Cloud Console → paste Client ID/secret into *Authentication → Providers → Google*.
   - Microsoft: register an app in Azure Portal (Entra ID) → paste into *Providers → Azure*. Use the callback URL Supabase shows on that page.

## How data is protected

- Passwords are hashed by Supabase Auth; email verification and reset links are built in.
- Row Level Security on every table: users can only read and write their own rows.
- The "today + previous work day" logging rule is enforced by database triggers, not just the UI.
- Share links expose one report, read-only, and can be revoked or set to expire.
- Users can export all their data or delete their account from *Profile*.

## Project layout

| Path | What it is |
|---|---|
| `src/pages/` | One file per screen (Landing, Auth, Onboarding, Home, Dashboard, DailyLog, Standup, Planner, History, Reports, Kpis, Insights, Profile, SharedReport) |
| `src/lib/repo/` | Data layer: `demo.ts` (browser storage) and `supabase.ts`, both behind one interface |
| `src/lib/ai/` | AI calls (`index.ts`) and offline fallbacks (`heuristics.ts`) |
| `src/lib/compose.ts` | Builds standups, reports and insights from entries |
| `supabase/migrations/` | Database schema, security policies, triggers |
| `supabase/functions/ai/` | Server-side Claude function (KPI generation, log organising, report and standup polish) |

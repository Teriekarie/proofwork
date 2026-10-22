/**
 * Supabase backend. Row Level Security (see supabase/migrations) guarantees each
 * user only ever reads and writes their own rows; the logging-window rule is
 * also enforced by database triggers, not just the UI.
 */
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { Entry, KpiCategory, Profile } from '../types'
import { RepoError, type AuthRepo, type DataRepo, type Session } from './types'

let client: SupabaseClient | null = null
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  }
  return client
}
const sb = () => getSupabase()

function toSession(u: User | null | undefined): Session | null {
  return u ? { userId: u.id, email: u.email ?? '', emailVerified: !!u.email_confirmed_at } : null
}

/** Turn Postgres / Supabase errors into friendly messages. */
function fail(e: { message: string; code?: string } | null): never {
  const msg = e?.message ?? 'Something went wrong.'
  if (msg.includes('PW_FUTURE_DATE')) throw new RepoError("You can't log work for a future date.", 'future_date')
  if (msg.includes('PW_LOCKED_DATE')) throw new RepoError('This day is locked. You can log any day this week up to today (and your previous work day).', 'locked_date')
  if (e?.code === '23505' && msg.includes('username')) throw new RepoError('That username is taken.', 'duplicate_username')
  throw new RepoError(msg, e?.code)
}

async function uidOrThrow(): Promise<string> {
  const { data } = await sb().auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new RepoError('Not signed in.', 'no_session')
  return id
}

const origin = () => window.location.origin

export const supabaseAuth: AuthRepo = {
  async getSession() {
    const { data } = await sb().auth.getSession()
    return toSession(data.session?.user)
  },
  onAuthChange(cb) {
    const { data } = sb().auth.onAuthStateChange((_evt, s) => cb(toSession(s?.user)))
    return () => data.subscription.unsubscribe()
  },
  async signUp(email, password) {
    const { data, error } = await sb().auth.signUp({
      email: email.trim().toLowerCase(), password,
      options: { emailRedirectTo: `${origin()}/onboarding` },
    })
    if (error) {
      if (/already registered|already exists/i.test(error.message))
        throw new RepoError('An account with this email already exists. Try logging in instead.', 'duplicate_email')
      if (/pwned|weak|leaked/i.test(error.message))
        throw new RepoError('This password has appeared in a data breach. Please choose a different one.', 'weak_password')
      fail(error)
    }
    // With email confirmation on, Supabase hides duplicates by returning a user with no identities.
    if (data.user && (data.user.identities?.length ?? 0) === 0)
      throw new RepoError('An account with this email already exists. Try logging in instead.', 'duplicate_email')
    return { needsVerification: !data.session }
  },
  async signIn(email, password) {
    const { error } = await sb().auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    if (error) {
      if (/not confirmed/i.test(error.message)) throw new RepoError('Please verify your email first — check your inbox for the link.', 'unverified')
      throw new RepoError('Incorrect email or password.', 'invalid_credentials')
    }
  },
  async signInWithOAuth(provider) {
    // Supabase shows a raw error page for providers that aren't enabled, so check first.
    const enabled = String(import.meta.env.VITE_OAUTH_PROVIDERS ?? '').split(',').map((s) => s.trim())
    if (!enabled.includes(provider))
      throw new RepoError(`${provider === 'azure' ? 'Microsoft' : 'Google'} sign-in is coming soon. Please use email for now.`, 'provider_disabled')
    const { error } = await sb().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${origin()}/home`, scopes: provider === 'azure' ? 'email openid profile' : undefined },
    })
    if (error) fail(error)
  },
  async signOut() { await sb().auth.signOut() },
  async sendPasswordReset(email) {
    const { error } = await sb().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${origin()}/reset-password` })
    if (error) fail(error)
  },
  async updatePassword(password) {
    const { error } = await sb().auth.updateUser({ password })
    if (error) fail(error)
  },
  async isUsernameAvailable(username) {
    const { data, error } = await sb().rpc('username_available', { name: username.trim() })
    if (error) fail(error)
    return !!data
  },
}

const one = async <T>(q: PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>): Promise<T> => {
  const { data, error } = await q
  if (error) fail(error)
  return data as T
}

export const supabaseData: DataRepo = {
  async getProfile() {
    const id = await uidOrThrow().catch(() => null)
    if (!id) return null
    const { data: u } = await sb().auth.getUser()
    const row = await one<Omit<Profile, 'email'> | null>(sb().from('profiles').select('*').eq('id', id).maybeSingle())
    return row ? { ...row, email: u.user?.email ?? '' } : null
  },
  async saveProfile(patch) {
    const id = await uidOrThrow()
    const { email: _e, id: _i, ...rest } = patch
    const row = await one<Omit<Profile, 'email'>>(sb().from('profiles').update(rest).eq('id', id).select().single())
    const { data: u } = await sb().auth.getUser()
    return { ...row, email: u.user?.email ?? '' }
  },
  async uploadAvatar(file) {
    const id = await uidOrThrow()
    const ext = (file.name.split('.').pop() || 'png').toLowerCase()
    const path = `${id}/${crypto.randomUUID()}.${ext}`
    const { error } = await sb().storage.from('avatars').upload(path, file, { upsert: false, contentType: file.type })
    if (error) fail(error)
    return sb().storage.from('avatars').getPublicUrl(path).data.publicUrl
  },

  async getCurrentJd() {
    return one(sb().from('job_descriptions').select('*').eq('is_current', true).maybeSingle())
  },
  async saveJd(jd) {
    const id = await uidOrThrow()
    await one(sb().from('job_descriptions').update({ is_current: false }).eq('user_id', id).eq('is_current', true).select())
    return one(sb().from('job_descriptions').insert({ ...jd, user_id: id, is_current: true }).select().single())
  },

  async listCategories(includeArchived = false) {
    let q = sb().from('kpi_categories').select('*').order('sort_order')
    if (!includeArchived) q = q.is('archived_at', null)
    return one(q)
  },
  async saveCategory(c) {
    const id = await uidOrThrow()
    if (c.id) return one(sb().from('kpi_categories').update(c).eq('id', c.id).select().single())
    const count = await one<Pick<KpiCategory, 'id'>[]>(sb().from('kpi_categories').select('id').eq('is_extra', false).is('archived_at', null))
    return one(sb().from('kpi_categories').insert({ sort_order: count.length, ...c, user_id: id }).select().single())
  },
  async archiveCategory(cid) {
    await one(sb().from('kpi_categories').update({ archived_at: new Date().toISOString() }).eq('id', cid).eq('is_extra', false).select())
  },
  async listMetrics() { return one(sb().from('kpi_metrics').select('*')) },
  async saveMetric(m) {
    const id = await uidOrThrow()
    if (m.id) return one(sb().from('kpi_metrics').update(m).eq('id', m.id).select().single())
    return one(sb().from('kpi_metrics').insert({ ...m, user_id: id }).select().single())
  },
  async deleteMetric(mid) { await one(sb().from('kpi_metrics').delete().eq('id', mid).select()) },
  async applyKpiDrafts(drafts) {
    const { error } = await sb().rpc('apply_kpi_drafts', { drafts })
    if (error) fail(error)
  },

  async getDailyLog(date) { return one(sb().from('daily_logs').select('*').eq('log_date', date).maybeSingle()) },
  async saveDailyLog(date, patch) {
    const id = await uidOrThrow()
    return one(sb().from('daily_logs').upsert({ user_id: id, log_date: date, ...patch }, { onConflict: 'user_id,log_date' }).select().single())
  },
  async listDailyLogs(r) { return one(sb().from('daily_logs').select('*').gte('log_date', r.from).lte('log_date', r.to)) },

  async listEntries(r) {
    let q = sb().from('entries').select('*').order('created_at')
    if (r) q = q.gte('entry_date', r.from).lte('entry_date', r.to)
    return one(q)
  },
  async addEntries(rows) {
    const id = await uidOrThrow()
    if (!rows.length) return []
    return one<Entry[]>(sb().from('entries').insert(rows.map((r) => ({ ...r, user_id: id }))).select())
  },
  async updateEntry(eid, patch) {
    const { id: _i, user_id: _u, entry_date: _d, created_at: _c, ...rest } = patch
    return one(sb().from('entries').update(rest).eq('id', eid).select().single())
  },
  async deleteEntry(eid) { await one(sb().from('entries').delete().eq('id', eid).select()) },

  async listTasks(r) { return one(sb().from('tasks').select('*').gte('task_date', r.from).lte('task_date', r.to).order('created_at')) },
  async saveTask(t) {
    const id = await uidOrThrow()
    if (t.id) return one(sb().from('tasks').update(t).eq('id', t.id).select().single())
    return one(sb().from('tasks').insert({ ...t, user_id: id }).select().single())
  },
  async deleteTask(tid) { await one(sb().from('tasks').delete().eq('id', tid).select()) },

  async getStandup(date) { return one(sb().from('standups').select('*').eq('standup_date', date).maybeSingle()) },
  async listStandups(limit = 30) {
    return one(sb().from('standups').select('*').order('standup_date', { ascending: false }).limit(limit))
  },
  async saveStandup(s) {
    const id = await uidOrThrow()
    return one(sb().from('standups').upsert({ ...s, user_id: id }, { onConflict: 'user_id,standup_date' }).select().single())
  },

  async listReports() { return one(sb().from('reports').select('*').order('created_at', { ascending: false })) },
  async getReport(rid) { return one(sb().from('reports').select('*').eq('id', rid).maybeSingle()) },
  async saveReport(r) {
    const id = await uidOrThrow()
    if (r.id) return one(sb().from('reports').update({ ...r, updated_at: new Date().toISOString() }).eq('id', r.id).select().single())
    return one(sb().from('reports').insert({ ...r, user_id: id }).select().single())
  },
  async deleteReport(rid) { await one(sb().from('reports').delete().eq('id', rid).select()) },

  async listShares(reportId) { return one(sb().from('report_shares').select('*').eq('report_id', reportId)) },
  async createShare(reportId, days) {
    const id = await uidOrThrow()
    const expires_at = days ? new Date(Date.now() + days * 86_400_000).toISOString() : null
    return one(sb().from('report_shares').insert({ report_id: reportId, user_id: id, expires_at }).select().single())
  },
  async revokeShare(sid) {
    await one(sb().from('report_shares').update({ revoked_at: new Date().toISOString() }).eq('id', sid).select())
  },
  async getSharedReport(token) {
    const { data, error } = await sb().rpc('get_shared_report', { share_token: token })
    if (error) fail(error)
    return (data as Awaited<ReturnType<DataRepo['getSharedReport']>>) ?? null
  },

  async exportAll() {
    const tables = ['profiles', 'job_descriptions', 'kpi_categories', 'kpi_metrics', 'daily_logs', 'entries', 'tasks', 'standups', 'reports']
    const out: Record<string, unknown> = {}
    for (const t of tables) out[t] = await one(sb().from(t).select('*'))
    return out
  },
  async deleteAccount() {
    const { error } = await sb().rpc('delete_my_account')
    if (error) fail(error)
    await sb().auth.signOut()
  },
}

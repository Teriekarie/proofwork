/**
 * Demo backend: everything lives in this browser's localStorage.
 * Used until Supabase keys are configured, so the full app can be tried offline.
 */
import type {
  DailyLog, Entry, JobDescription, KpiCategory, KpiMetric, LogDate, Profile, Report,
  ReportShare, Standup, Task,
} from '../types'
import { DEFAULT_WORK_DAYS, editWindow, guessTimezone, todayIn } from '../dates'
import { CATEGORY_COLORS, EXTRA_COLOR, nowIso, uid } from '../utils'
import { RepoError, type AuthRepo, type DataRepo, type Session } from './types'

const KEY = 'proofwork:demo:v1'

interface DemoUser { id: string; email: string; salt: string; hash: string; created_at: string }
interface UserData {
  profile: Profile
  jds: JobDescription[]
  categories: KpiCategory[]
  metrics: KpiMetric[]
  logs: DailyLog[]
  entries: Entry[]
  tasks: Task[]
  standups: Standup[]
  reports: Report[]
}
interface DemoDb {
  users: DemoUser[]
  session: string | null
  data: Record<string, UserData>
  shares: (ReportShare & { user_id: string })[]
}

function load(): DemoDb {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoDb
  } catch { /* corrupted or unavailable storage */ }
  return { users: [], session: null, data: {}, shares: [] }
}

let db = load()
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* storage full or blocked */ }
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: enc.encode(salt), iterations: 120_000, hash: 'SHA-256' }, key, 256)
  return Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

const listeners = new Set<(s: Session | null) => void>()
function currentSession(): Session | null {
  const u = db.users.find((x) => x.id === db.session)
  return u ? { userId: u.id, email: u.email, emailVerified: true } : null
}
function emitAuth() { const s = currentSession(); listeners.forEach((l) => l(s)) }

function blankProfile(id: string, email: string): Profile {
  return {
    id, email, full_name: '', username: '', avatar_url: null, job_title: '', department: '', manager_name: '',
    company: '', location: '', timezone: guessTimezone(), work_arrangement: null, employment_type: null,
    work_days: DEFAULT_WORK_DAYS, standup_time: '09:30', reminder_time: '17:00', onboarded_at: null,
  }
}

function beyondScope(userId: string): KpiCategory {
  return {
    id: uid(), user_id: userId, name: 'Beyond Scope', description: 'Work that falls outside your defined KPIs — still tracked, still counts.',
    color: EXTRA_COLOR, is_extra: true, sort_order: 999, archived_at: null, created_at: nowIso(),
  }
}

export const demoAuth: AuthRepo = {
  async getSession() { return currentSession() },
  onAuthChange(cb) { listeners.add(cb); return () => { listeners.delete(cb) } },

  async signUp(email, password) {
    const norm = email.trim().toLowerCase()
    if (db.users.some((u) => u.email === norm)) throw new RepoError('An account with this email already exists. Try logging in instead.', 'duplicate_email')
    const salt = uid()
    const user: DemoUser = { id: uid(), email: norm, salt, hash: await hashPassword(password, salt), created_at: nowIso() }
    db.users.push(user)
    db.data[user.id] = {
      profile: blankProfile(user.id, norm), jds: [], categories: [beyondScope(user.id)], metrics: [],
      logs: [], entries: [], tasks: [], standups: [], reports: [],
    }
    db.session = user.id
    persist(); emitAuth()
    return { needsVerification: false }
  },

  async signIn(email, password) {
    const u = db.users.find((x) => x.email === email.trim().toLowerCase())
    if (!u || (await hashPassword(password, u.salt)) !== u.hash) throw new RepoError('Incorrect email or password.', 'invalid_credentials')
    db.session = u.id
    persist(); emitAuth()
  },

  async signInWithOAuth() {
    throw new RepoError('Google and Microsoft sign-in switch on once Proofwork is connected to Supabase.', 'demo_mode')
  },

  async signOut() { db.session = null; persist(); emitAuth() },

  async sendPasswordReset() {
    throw new RepoError('Password reset emails are sent once Proofwork is connected to Supabase.', 'demo_mode')
  },

  async updatePassword(password) {
    const u = db.users.find((x) => x.id === db.session)
    if (!u) throw new RepoError('Not signed in.')
    u.salt = uid(); u.hash = await hashPassword(password, u.salt)
    persist()
  },

  async isUsernameAvailable(username) {
    const n = username.trim().toLowerCase()
    return !Object.values(db.data).some((d) => d.profile.username.toLowerCase() === n && d.profile.id !== db.session)
  },
}

function me(): UserData {
  if (!db.session || !db.data[db.session]) throw new RepoError('Not signed in.', 'no_session')
  return db.data[db.session]
}
const userId = () => me().profile.id
const inRange = (d: LogDate, r?: { from: LogDate; to: LogDate }) => !r || (d >= r.from && d <= r.to)
const byDate = <T extends { created_at: string }>(a: T, b: T) => a.created_at.localeCompare(b.created_at)

function assertWritable(date: LogDate) {
  const p = me().profile
  const w = editWindow(date, todayIn(p.timezone), p.work_days)
  if (w === 'future') throw new RepoError("You can't log work for a future date.", 'future_date')
  if (w === 'locked') throw new RepoError('This day is locked. You can log any day this week up to today (and your previous work day).', 'locked_date')
}

function commit<T>(v: T): T { persist(); return v }

export const demoData: DataRepo = {
  async getProfile() { return db.session ? me().profile : null },
  async saveProfile(patch) {
    if (patch.username !== undefined && !(await demoAuth.isUsernameAvailable(patch.username)))
      throw new RepoError('That username is taken.', 'duplicate_username')
    const d = me(); d.profile = { ...d.profile, ...patch, id: d.profile.id, email: d.profile.email }
    return commit(d.profile)
  },
  async uploadAvatar(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new RepoError('Could not read image.'))
      r.readAsDataURL(file)
    })
  },

  async getCurrentJd() { return me().jds.find((j) => j.is_current) ?? null },
  async saveJd(jd) {
    const d = me(); d.jds.forEach((j) => (j.is_current = false))
    const row: JobDescription = { ...jd, id: uid(), user_id: userId(), is_current: true, created_at: nowIso() }
    d.jds.push(row)
    return commit(row)
  },

  async listCategories(includeArchived = false) {
    return me().categories.filter((c) => includeArchived || !c.archived_at).sort((a, b) => a.sort_order - b.sort_order)
  },
  async saveCategory(c) {
    const d = me()
    const existing = c.id ? d.categories.find((x) => x.id === c.id) : undefined
    if (existing) { Object.assign(existing, c); return commit(existing) }
    const active = d.categories.filter((x) => !x.is_extra && !x.archived_at)
    const row: KpiCategory = {
      id: uid(), user_id: userId(), description: '', is_extra: false, archived_at: null, created_at: nowIso(),
      color: CATEGORY_COLORS[active.length % CATEGORY_COLORS.length], sort_order: active.length, ...c,
    }
    d.categories.push(row)
    return commit(row)
  },
  async archiveCategory(id) {
    const c = me().categories.find((x) => x.id === id)
    if (c && !c.is_extra) { c.archived_at = nowIso(); persist() }
  },
  async listMetrics() { return [...me().metrics] },
  async saveMetric(m) {
    const d = me()
    const existing = m.id ? d.metrics.find((x) => x.id === m.id) : undefined
    if (existing) { Object.assign(existing, m); return commit(existing) }
    const row: KpiMetric = { id: uid(), user_id: userId(), target_value: null, unit: '', period: 'month', ...m }
    d.metrics.push(row)
    return commit(row)
  },
  async deleteMetric(id) { const d = me(); d.metrics = d.metrics.filter((m) => m.id !== id); persist() },
  async applyKpiDrafts(drafts) {
    const d = me()
    d.categories.filter((c) => !c.is_extra && !c.archived_at).forEach((c) => (c.archived_at = nowIso()))
    if (!d.categories.some((c) => c.is_extra)) d.categories.push(beyondScope(userId()))
    drafts.forEach((k, i) => {
      const cat: KpiCategory = {
        id: uid(), user_id: userId(), name: k.name, description: k.description, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
        is_extra: false, sort_order: i, archived_at: null, created_at: nowIso(),
      }
      d.categories.push(cat)
      k.metrics.forEach((m) => d.metrics.push({ id: uid(), user_id: userId(), category_id: cat.id, ...m }))
    })
    persist()
  },

  async getDailyLog(date) { return me().logs.find((l) => l.log_date === date) ?? null },
  async saveDailyLog(date, patch) {
    assertWritable(date)
    const d = me()
    let log = d.logs.find((l) => l.log_date === date)
    if (!log) { log = { id: uid(), user_id: userId(), log_date: date, raw_input: '', day_type: 'work', mood: null }; d.logs.push(log) }
    Object.assign(log, patch)
    return commit(log)
  },
  async listDailyLogs(r) { return me().logs.filter((l) => inRange(l.log_date, r)) },

  async listEntries(r) { return me().entries.filter((e) => inRange(e.entry_date, r)).sort(byDate) },
  async addEntries(rows) {
    rows.forEach((r) => assertWritable(r.entry_date))
    const d = me()
    const out = rows.map((r) => ({ ...r, id: uid(), user_id: userId(), created_at: nowIso() }))
    d.entries.push(...out)
    return commit(out)
  },
  async updateEntry(id, patch) {
    const e = me().entries.find((x) => x.id === id)
    if (!e) throw new RepoError('Entry not found.')
    assertWritable(e.entry_date)
    Object.assign(e, patch, { id: e.id, user_id: e.user_id, entry_date: e.entry_date })
    return commit(e)
  },
  async deleteEntry(id) {
    const d = me(); const e = d.entries.find((x) => x.id === id)
    if (!e) return
    assertWritable(e.entry_date)
    d.entries = d.entries.filter((x) => x.id !== id); persist()
  },

  async listTasks(r) { return me().tasks.filter((t) => inRange(t.task_date, r)).sort(byDate) },
  async saveTask(t) {
    const d = me()
    const existing = t.id ? d.tasks.find((x) => x.id === t.id) : undefined
    if (existing) { Object.assign(existing, t); return commit(existing) }
    const row: Task = { id: uid(), user_id: userId(), category_id: null, done_at: null, carried_from: null, created_at: nowIso(), ...t }
    d.tasks.push(row)
    return commit(row)
  },
  async deleteTask(id) { const d = me(); d.tasks = d.tasks.filter((t) => t.id !== id); persist() },

  async getStandup(date) { return me().standups.find((s) => s.standup_date === date) ?? null },
  async listStandups(limit = 30) {
    return [...me().standups].sort((a, b) => b.standup_date.localeCompare(a.standup_date)).slice(0, limit)
  },
  async saveStandup(s) {
    const d = me()
    const existing = d.standups.find((x) => x.standup_date === s.standup_date)
    if (existing) { Object.assign(existing, s); return commit(existing) }
    const row: Standup = { ...s, id: uid(), user_id: userId() }
    d.standups.push(row)
    return commit(row)
  },

  async listReports() { return [...me().reports].sort((a, b) => b.created_at.localeCompare(a.created_at)) },
  async getReport(id) { return me().reports.find((r) => r.id === id) ?? null },
  async saveReport(r) {
    const d = me()
    const existing = r.id ? d.reports.find((x) => x.id === r.id) : undefined
    if (existing) { Object.assign(existing, r, { updated_at: nowIso() }); return commit(existing) }
    const row: Report = { ...r, id: uid(), user_id: userId(), created_at: nowIso(), updated_at: nowIso() }
    d.reports.push(row)
    return commit(row)
  },
  async deleteReport(id) {
    const d = me(); d.reports = d.reports.filter((r) => r.id !== id)
    db.shares = db.shares.filter((s) => s.report_id !== id); persist()
  },

  async listShares(reportId) { return db.shares.filter((s) => s.report_id === reportId && s.user_id === userId()) },
  async createShare(reportId, days) {
    const row = {
      id: uid(), report_id: reportId, user_id: userId(), token: uid().replace(/-/g, ''),
      expires_at: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null, revoked_at: null, created_at: nowIso(),
    }
    db.shares.push(row)
    return commit(row)
  },
  async revokeShare(id) {
    const s = db.shares.find((x) => x.id === id && x.user_id === userId())
    if (s) { s.revoked_at = nowIso(); persist() }
  },
  async getSharedReport(token) {
    const s = db.shares.find((x) => x.token === token)
    if (!s || s.revoked_at || (s.expires_at && s.expires_at < nowIso())) return null
    const owner = db.data[s.user_id]
    const report = owner?.reports.find((r) => r.id === s.report_id)
    if (!owner || !report) return null
    return { report, owner: { full_name: owner.profile.full_name, job_title: owner.profile.job_title, company: owner.profile.company } }
  },

  async exportAll() { return JSON.parse(JSON.stringify(me())) },
  async deleteAccount() {
    const id = db.session
    if (!id) return
    delete db.data[id]
    db.users = db.users.filter((u) => u.id !== id)
    db.shares = db.shares.filter((s) => s.user_id !== id)
    db.session = null
    persist(); emitAuth()
  },
}

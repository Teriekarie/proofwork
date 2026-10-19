import type {
  DailyLog, Entry, JobDescription, KpiCategory, KpiDraft, KpiMetric, LogDate, Profile,
  Report, ReportShare, Standup, Task,
} from '../types'

export interface Session { userId: string; email: string; emailVerified: boolean }
export type OAuthProvider = 'google' | 'azure'

export interface SignUpResult { needsVerification: boolean }

export interface AuthRepo {
  getSession(): Promise<Session | null>
  onAuthChange(cb: (s: Session | null) => void): () => void
  signUp(email: string, password: string): Promise<SignUpResult>
  signIn(email: string, password: string): Promise<void>
  signInWithOAuth(provider: OAuthProvider): Promise<void>
  signOut(): Promise<void>
  sendPasswordReset(email: string): Promise<void>
  updatePassword(password: string): Promise<void>
  isUsernameAvailable(username: string): Promise<boolean>
}

export interface Range { from: LogDate; to: LogDate }

export type NewEntry = Omit<Entry, 'id' | 'user_id' | 'created_at'>
export type NewTask = Omit<Task, 'id' | 'user_id' | 'created_at'>

export interface DataRepo {
  getProfile(): Promise<Profile | null>
  saveProfile(patch: Partial<Profile>): Promise<Profile>
  uploadAvatar(file: File): Promise<string>

  getCurrentJd(): Promise<JobDescription | null>
  saveJd(jd: Pick<JobDescription, 'source' | 'file_name' | 'jd_text'>): Promise<JobDescription>

  listCategories(includeArchived?: boolean): Promise<KpiCategory[]>
  saveCategory(c: Partial<KpiCategory> & { name: string }): Promise<KpiCategory>
  archiveCategory(id: string): Promise<void>
  listMetrics(): Promise<KpiMetric[]>
  saveMetric(m: Partial<KpiMetric> & { category_id: string; name: string }): Promise<KpiMetric>
  deleteMetric(id: string): Promise<void>
  /** Archive current non-extra KPIs and create the drafted ones. Beyond Scope is kept. */
  applyKpiDrafts(drafts: KpiDraft[]): Promise<void>

  getDailyLog(date: LogDate): Promise<DailyLog | null>
  saveDailyLog(date: LogDate, patch: Partial<Pick<DailyLog, 'raw_input' | 'day_type' | 'mood'>>): Promise<DailyLog>
  listDailyLogs(range: Range): Promise<DailyLog[]>

  listEntries(range?: Range): Promise<Entry[]>
  addEntries(entries: NewEntry[]): Promise<Entry[]>
  updateEntry(id: string, patch: Partial<Entry>): Promise<Entry>
  deleteEntry(id: string): Promise<void>

  listTasks(range: Range): Promise<Task[]>
  saveTask(t: Partial<Task> & { title: string; task_date: LogDate }): Promise<Task>
  deleteTask(id: string): Promise<void>

  getStandup(date: LogDate): Promise<Standup | null>
  listStandups(limit?: number): Promise<Standup[]>
  saveStandup(s: Omit<Standup, 'id' | 'user_id'>): Promise<Standup>

  listReports(): Promise<Report[]>
  getReport(id: string): Promise<Report | null>
  saveReport(r: Partial<Report> & Pick<Report, 'period_type' | 'period_start' | 'period_end' | 'title' | 'content'>): Promise<Report>
  deleteReport(id: string): Promise<void>

  listShares(reportId: string): Promise<ReportShare[]>
  createShare(reportId: string, expiresInDays: number | null): Promise<ReportShare>
  revokeShare(id: string): Promise<void>
  getSharedReport(token: string): Promise<{ report: Report; owner: { full_name: string; job_title: string; company: string } } | null>

  exportAll(): Promise<Record<string, unknown>>
  deleteAccount(): Promise<void>
}

export class RepoError extends Error {
  constructor(message: string, public code?: string) { super(message) }
}

export type WorkArrangement = 'remote' | 'hybrid' | 'on_site'
export type EmploymentType = 'full_time' | 'part_time' | 'contract'
export type EntryType = 'normal' | 'above_beyond' | 'blocker'
export type EntryStatus = 'done' | 'in_progress'
export type DayType = 'work' | 'leave' | 'holiday' | 'sick'
export type PeriodType = 'week' | 'month' | 'quarter' | 'year'
export type MetricPeriod = 'week' | 'month' | 'quarter'

/** ISO date string in the user's own timezone, e.g. "2026-10-19". */
export type LogDate = string

export interface Profile {
  id: string
  email: string
  full_name: string
  username: string
  avatar_url: string | null
  job_title: string
  department: string
  manager_name: string
  company: string
  location: string
  timezone: string
  work_arrangement: WorkArrangement | null
  employment_type: EmploymentType | null
  /** 0 = Sunday … 6 = Saturday */
  work_days: number[]
  standup_time: string
  reminder_time: string
  onboarded_at: string | null
}

export interface JobDescription {
  id: string
  user_id: string
  source: 'upload' | 'paste'
  file_name: string | null
  jd_text: string
  is_current: boolean
  created_at: string
}

export interface KpiCategory {
  id: string
  user_id: string
  name: string
  description: string
  color: string
  is_extra: boolean
  sort_order: number
  archived_at: string | null
  created_at: string
}

export interface KpiMetric {
  id: string
  user_id: string
  category_id: string
  name: string
  target_value: number | null
  unit: string
  period: MetricPeriod
}

export interface DailyLog {
  id: string
  user_id: string
  log_date: LogDate
  raw_input: string
  day_type: DayType
  mood: number | null
}

export interface Entry {
  id: string
  user_id: string
  entry_date: LogDate
  category_id: string
  metric_id: string | null
  raw_text: string
  refined_text: string
  entry_type: EntryType
  status: EntryStatus
  quantity: number | null
  impact_note: string
  blocker_detail: string
  evidence_url: string
  stakeholders: string[]
  is_late: boolean
  ai_confidence: number | null
  created_at: string
}

export interface Task {
  id: string
  user_id: string
  task_date: LogDate
  title: string
  category_id: string | null
  done_at: string | null
  carried_from: LogDate | null
  created_at: string
}

export interface Standup {
  id: string
  user_id: string
  standup_date: LogDate
  yesterday: string[]
  today: string[]
  blockers: string[]
  generated_at: string
  /** True once the user has edited it by hand; edited standups are not auto-regenerated. */
  edited: boolean
}

export interface ReportSection {
  category_id: string
  category: string
  items: string[]
  metrics: { name: string; actual: number; target: number | null; unit: string }[]
}

export interface ReportContent {
  summary: string
  highlights: string[]
  sections: ReportSection[]
  above_beyond: string[]
  blockers: string[]
  next_focus: string[]
  stats: { entries: number; days_logged: number; above_beyond: number; blockers: number; categories_active: number }
}

export interface Report {
  id: string
  user_id: string
  period_type: PeriodType
  period_start: LogDate
  period_end: LogDate
  title: string
  content: ReportContent
  created_at: string
  updated_at: string
}

export interface ReportShare {
  id: string
  report_id: string
  token: string
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

/** Draft produced by the AI before the user confirms it. */
export interface KpiDraft {
  name: string
  description: string
  metrics: { name: string; target_value: number | null; unit: string; period: MetricPeriod }[]
}

export interface EntryDraft {
  raw_text: string
  refined_text: string
  category_id: string
  metric_id: string | null
  entry_type: EntryType
  status: EntryStatus
  quantity: number | null
  stakeholders: string[]
  impact_note: string
  blocker_detail: string
  ai_confidence: number
}

/** Deterministic builders for standups, reports and insights from logged entries. */
import type {
  DailyLog, Entry, KpiCategory, KpiMetric, LogDate, PeriodType, ReportContent, ReportSection, Task,
} from './types'
import { countWorkDays, daysBetween, isWorkDay, periodLabel, prettyDate, shiftDays } from './dates'

export function buildStandup(opts: {
  yesterdayEntries: Entry[]
  /** Planner tasks ticked off on the previous work day; included when they weren't also logged. */
  yesterdayDoneTasks?: Task[]
  todayTasks: Task[]
  inProgress: Entry[]
  recentBlockers: Entry[]
}) {
  const logged = new Set(opts.yesterdayEntries.map((e) => e.raw_text.trim().toLowerCase()))
  const yesterday = [
    ...opts.yesterdayEntries
      .filter((e) => e.entry_type !== 'blocker')
      .map((e) => (e.status === 'in_progress' ? `${e.refined_text} (in progress)` : e.refined_text)),
    ...(opts.yesterdayDoneTasks ?? []).filter((t) => t.done_at && !logged.has(t.title.trim().toLowerCase())).map((t) => t.title),
  ]
  const today = [
    ...opts.todayTasks.filter((t) => !t.done_at).map((t) => t.title),
    ...opts.inProgress.filter((e) => !opts.todayTasks.some((t) => t.title === e.refined_text)).map((e) => `Continue: ${e.refined_text}`),
  ]
  const blockers = opts.recentBlockers.map((e) => e.blocker_detail || e.refined_text)
  return { yesterday, today: [...new Set(today)], blockers: [...new Set(blockers)] }
}

export function standupToText(name: string, date: LogDate, s: { yesterday: string[]; today: string[]; blockers: string[] }) {
  const list = (xs: string[], empty: string) => (xs.length ? xs.map((x) => `• ${x}`).join('\n') : `• ${empty}`)
  return [
    `Standup — ${name} — ${prettyDate(date, 'EEE d MMM yyyy')}`, '',
    'Yesterday:', list(s.yesterday, 'Nothing logged'), '',
    'Today:', list(s.today, 'Planning in progress'), '',
    'Blockers:', list(s.blockers, 'None'),
  ].join('\n')
}

export function buildReportContent(opts: {
  periodType: PeriodType
  start: LogDate
  end: LogDate
  entries: Entry[]
  logs: DailyLog[]
  categories: KpiCategory[]
  metrics: KpiMetric[]
  workDays: number[]
}): ReportContent {
  const { entries, categories, metrics } = opts
  const sections: ReportSection[] = categories
    .map((c) => {
      const es = entries.filter((e) => e.category_id === c.id)
      const ms = metrics.filter((m) => m.category_id === c.id).map((m) => ({
        name: m.name,
        actual: es.filter((e) => e.metric_id === m.id).reduce((n, e) => n + (e.quantity ?? 1), 0),
        target: scaleTarget(m.target_value, m.period, opts.periodType),
        unit: m.unit,
      }))
      return { category_id: c.id, category: c.name, items: dedupe(es.map((e) => e.refined_text)), metrics: ms }
    })
    .filter((s) => s.items.length > 0)

  const above = entries.filter((e) => e.entry_type === 'above_beyond')
  const blockers = entries.filter((e) => e.entry_type === 'blocker')
  const daysLogged = new Set(entries.map((e) => e.entry_date)).size
  const workDaysInPeriod = countWorkDays(opts.start, opts.end, opts.workDays)
  const top = [...sections].sort((a, b) => b.items.length - a.items.length)
  const label = periodLabel(opts.periodType, opts.start, opts.end)

  // Achievements: above-and-beyond first, then the first completed item from each busiest KPI. Never blockers.
  const done = entries.filter((e) => e.entry_type !== 'blocker' && e.status === 'done')
  const highlights = [
    ...above.map((e) => e.refined_text),
    ...top.slice(0, 3).flatMap((s) => done.filter((e) => e.category_id === s.category_id).slice(0, 1).map((e) => e.refined_text)),
  ]

  const summary = entries.length === 0
    ? `No work was logged for ${label}.`
    : `During ${label}, ${entries.length} pieces of work were logged across ${sections.length} KPI area${sections.length === 1 ? '' : 's'} ` +
      `on ${daysLogged} of ${workDaysInPeriod} working days. ` +
      (top[0] ? `The main focus was ${top[0].category}${top[1] ? `, followed by ${top[1].category}` : ''}. ` : '') +
      (above.length ? `${above.length} contribution${above.length === 1 ? ' went' : 's went'} above and beyond expectations. ` : '') +
      (blockers.length ? `${blockers.length} blocker${blockers.length === 1 ? ' was' : 's were'} raised.` : 'No blockers were raised.')

  const quiet = categories.filter((c) => !c.is_extra && !sections.some((s) => s.category_id === c.id)).map((c) => c.name)
  const next_focus = [
    ...entries.filter((e) => e.status === 'in_progress').map((e) => `Complete: ${e.refined_text}`).slice(0, 4),
    ...quiet.slice(0, 2).map((q) => `Increase activity in ${q}`),
  ]

  return {
    summary,
    highlights: dedupe(highlights).slice(0, 6),
    sections,
    above_beyond: dedupe(above.map((e) => e.impact_note ? `${e.refined_text} — ${e.impact_note}` : e.refined_text)),
    blockers: dedupe(blockers.map((e) => e.blocker_detail || e.refined_text)),
    next_focus: dedupe(next_focus),
    stats: {
      entries: entries.length, days_logged: daysLogged, above_beyond: above.length,
      blockers: blockers.length, categories_active: sections.length,
    },
  }
}

function scaleTarget(target: number | null, metricPeriod: string, reportPeriod: PeriodType): number | null {
  if (target == null) return null
  const perMonth = metricPeriod === 'week' ? target * 4.33 : metricPeriod === 'quarter' ? target / 3 : target
  const factor = reportPeriod === 'week' ? 1 / 4.33 : reportPeriod === 'month' ? 1 : reportPeriod === 'quarter' ? 3 : 12
  return Math.max(1, Math.round(perMonth * factor))
}

const dedupe = (xs: string[]) => [...new Set(xs.filter(Boolean))]

export function reportToText(title: string, owner: string, c: ReportContent): string {
  const lines = [title, owner, '', 'SUMMARY', c.summary, '']
  if (c.highlights.length) lines.push('KEY ACHIEVEMENTS', ...c.highlights.map((h) => `• ${h}`), '')
  for (const s of c.sections) {
    lines.push(s.category.toUpperCase())
    s.metrics.forEach((m) => lines.push(`  ${m.name}: ${m.actual}${m.target != null ? ` / ${m.target}` : ''} ${m.unit}`))
    s.items.forEach((i) => lines.push(`• ${i}`))
    lines.push('')
  }
  if (c.above_beyond.length) lines.push('ABOVE & BEYOND', ...c.above_beyond.map((h) => `• ${h}`), '')
  if (c.blockers.length) lines.push('BLOCKERS', ...c.blockers.map((h) => `• ${h}`), '')
  if (c.next_focus.length) lines.push('NEXT FOCUS', ...c.next_focus.map((h) => `• ${h}`))
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Insights

export interface Insight { kind: 'neglected' | 'low_week' | 'strong_week' | 'streak' | 'balance'; title: string; detail: string; tone: 'warn' | 'good' | 'info' }

export function streak(entries: Entry[], logs: DailyLog[], today: LogDate, workDays: number[]): number {
  const logged = new Set(entries.map((e) => e.entry_date))
  const off = new Set(logs.filter((l) => l.day_type !== 'work').map((l) => l.log_date))
  let n = 0
  let d = logged.has(today) ? today : shiftDays(today, -1)
  for (let i = 0; i < 400; i++) {
    if (!isWorkDay(d, workDays) || off.has(d)) { d = shiftDays(d, -1); continue }
    if (!logged.has(d)) break
    n++; d = shiftDays(d, -1)
  }
  return n
}

export function weeklyCounts(entries: Entry[], today: LogDate, weeks = 8): { week: LogDate; count: number }[] {
  const out: { week: LogDate; count: number }[] = []
  const t = new Date(today)
  const monday = shiftDays(today, -((t.getDay() + 6) % 7))
  for (let i = weeks - 1; i >= 0; i--) {
    const start = shiftDays(monday, -7 * i)
    const end = shiftDays(start, 6)
    out.push({ week: start, count: entries.filter((e) => e.entry_date >= start && e.entry_date <= end).length })
  }
  return out
}

export function computeInsights(opts: { entries: Entry[]; logs: DailyLog[]; categories: KpiCategory[]; today: LogDate; workDays: number[] }): Insight[] {
  const { entries, categories, today } = opts
  const out: Insight[] = []
  // Only judge "quiet" KPIs once there's at least two weeks of history to judge against.
  const first = entries.map((e) => e.entry_date).sort()[0]
  const historyDays = first ? daysBetween(first, today).length : 0
  for (const c of categories.filter((c) => !c.is_extra)) {
    if (historyDays < 14) break
    const last = entries.filter((e) => e.category_id === c.id).map((e) => e.entry_date).sort().pop()
    const since = last ? daysBetween(last, today).length - 1 : null
    if (since === null) out.push({ kind: 'neglected', tone: 'warn', title: `No activity yet in ${c.name}`, detail: 'Nothing has been logged against this KPI so far.' })
    else if (since !== null && since >= 14) out.push({ kind: 'neglected', tone: 'warn', title: `${c.name} has been quiet for ${since} days`, detail: `Last entry ${prettyDate(last!)}. Worth planning something here.` })
  }
  const weeks = weeklyCounts(entries, today, 9)
  const past = weeks.slice(0, -1).filter((w) => w.count > 0)
  const avg = past.length ? past.reduce((n, w) => n + w.count, 0) / past.length : 0
  const prev = weeks[weeks.length - 2]
  if (avg >= 3 && prev) {
    if (prev.count < avg * 0.6) out.push({ kind: 'low_week', tone: 'warn', title: 'Last week was lighter than usual', detail: `${prev.count} entries vs your average of ${avg.toFixed(1)}. Leave or deep-focus work? Mark days off so they don't count.` })
    else if (prev.count > avg * 1.3) out.push({ kind: 'strong_week', tone: 'good', title: 'Last week was one of your strongest', detail: `${prev.count} entries vs your average of ${avg.toFixed(1)}.` })
  }
  const s = streak(entries, opts.logs, today, opts.workDays)
  if (s >= 5) out.push({ kind: 'streak', tone: 'good', title: `${s}-day logging streak`, detail: 'Consistent logging makes appraisal time painless.' })
  const extra = categories.find((c) => c.is_extra)
  const extraShare = entries.length ? entries.filter((e) => e.category_id === extra?.id).length / entries.length : 0
  if (entries.length >= 10 && extraShare > 0.3) out.push({ kind: 'balance', tone: 'info', title: `${Math.round(extraShare * 100)}% of your work is Beyond Scope`, detail: 'Your role may have grown. Consider adding a KPI for recurring extra work, or raising it with your manager.' })
  return out
}

/** Find recurring Beyond Scope themes worth promoting into a KPI. */
export function suggestKpisFromExtras(entries: Entry[], extraId: string | undefined): { theme: string; count: number }[] {
  if (!extraId) return []
  const counts = new Map<string, number>()
  const STOP = new Set(['with', 'from', 'that', 'this', 'have', 'their', 'about', 'completed', 'worked', 'held', 'created', 'review', 'call', 'meeting', 'team', 'today'])
  for (const e of entries.filter((x) => x.category_id === extraId)) {
    const words = new Set((e.refined_text.toLowerCase().match(/[a-z]{5,}/g) ?? []).filter((w) => !STOP.has(w)))
    words.forEach((w) => counts.set(w, (counts.get(w) ?? 0) + 1))
  }
  return [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([theme, count]) => ({ theme: theme.charAt(0).toUpperCase() + theme.slice(1), count }))
}

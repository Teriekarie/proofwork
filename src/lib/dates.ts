import {
  addDays, endOfMonth, endOfQuarter, endOfWeek, endOfYear, format, parseISO,
  startOfMonth, startOfQuarter, startOfWeek, startOfYear, eachDayOfInterval, isWeekend,
} from 'date-fns'
import type { LogDate, PeriodType } from './types'

export const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5]

export function guessTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

/** Today's date in the given IANA timezone, as yyyy-MM-dd. */
export function todayIn(timezone: string): LogDate {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
      .format(new Date())
  } catch {
    return format(new Date(), 'yyyy-MM-dd')
  }
}

export function hourIn(timezone: string): number {
  try {
    return Number(new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hour12: false }).format(new Date()))
  } catch {
    return new Date().getHours()
  }
}

export const toDate = (d: LogDate) => parseISO(d)
export const toLogDate = (d: Date): LogDate => format(d, 'yyyy-MM-dd')
export const shiftDays = (d: LogDate, n: number): LogDate => toLogDate(addDays(toDate(d), n))

export function isWorkDay(d: LogDate, workDays: number[]): boolean {
  const days = workDays.length ? workDays : DEFAULT_WORK_DAYS
  return days.includes(toDate(d).getDay())
}

/** The most recent work day strictly before `d`. */
export function previousWorkDay(d: LogDate, workDays: number[]): LogDate {
  let cur = shiftDays(d, -1)
  for (let i = 0; i < 7; i++) {
    if (isWorkDay(cur, workDays)) return cur
    cur = shiftDays(cur, -1)
  }
  return shiftDays(d, -1)
}

export type EditWindow = 'today' | 'late' | 'locked' | 'future'

/**
 * Earliest day that can still be logged: Monday of the current week, or the
 * previous work day if that is earlier (so on a Monday you can still fill in Friday).
 */
export function earliestEditable(today: LogDate, workDays: number[]): LogDate {
  const monday = toLogDate(startOfWeek(toDate(today), { weekStartsOn: 1 }))
  const prev = previousWorkDay(today, workDays)
  return prev < monday ? prev : monday
}

/**
 * Logging rule: today is open; earlier days this week (and the previous work day)
 * are open as late entries; anything older is read-only; future dates are never allowed.
 */
export function editWindow(d: LogDate, today: LogDate, workDays: number[]): EditWindow {
  if (d > today) return 'future'
  if (d === today) return 'today'
  if (d >= earliestEditable(today, workDays)) return 'late'
  return 'locked'
}

/** Every day that can currently be logged, most recent first (today first). */
export function editableDays(today: LogDate, workDays: number[]): LogDate[] {
  return daysBetween(earliestEditable(today, workDays), today).reverse()
}

export function periodRange(type: PeriodType, anchor: LogDate): { start: LogDate; end: LogDate } {
  const d = toDate(anchor)
  switch (type) {
    case 'week': return { start: toLogDate(startOfWeek(d, { weekStartsOn: 1 })), end: toLogDate(endOfWeek(d, { weekStartsOn: 1 })) }
    case 'month': return { start: toLogDate(startOfMonth(d)), end: toLogDate(endOfMonth(d)) }
    case 'quarter': return { start: toLogDate(startOfQuarter(d)), end: toLogDate(endOfQuarter(d)) }
    case 'year': return { start: toLogDate(startOfYear(d)), end: toLogDate(endOfYear(d)) }
  }
}

export function shiftPeriod(type: PeriodType, anchor: LogDate, dir: 1 | -1): LogDate {
  const d = toDate(anchor)
  const next = type === 'week' ? addDays(d, 7 * dir)
    : type === 'month' ? new Date(d.getFullYear(), d.getMonth() + dir, 1)
    : type === 'quarter' ? new Date(d.getFullYear(), d.getMonth() + 3 * dir, 1)
    : new Date(d.getFullYear() + dir, 0, 1)
  return toLogDate(next)
}

export function periodLabel(type: PeriodType, start: LogDate, end: LogDate): string {
  const s = toDate(start)
  switch (type) {
    case 'week': return `Week of ${format(s, 'd MMM yyyy')} – ${format(toDate(end), 'd MMM')}`
    case 'month': return format(s, 'MMMM yyyy')
    case 'quarter': return `Q${Math.floor(s.getMonth() / 3) + 1} ${s.getFullYear()}`
    case 'year': return String(s.getFullYear())
  }
}

export function daysBetween(start: LogDate, end: LogDate): LogDate[] {
  if (end < start) return []
  return eachDayOfInterval({ start: toDate(start), end: toDate(end) }).map(toLogDate)
}

export function countWorkDays(start: LogDate, end: LogDate, workDays: number[]): number {
  return daysBetween(start, end).filter((d) => isWorkDay(d, workDays)).length
}

export const prettyDate = (d: LogDate, pattern = 'EEE d MMM') => format(toDate(d), pattern)
export const longDate = (d: LogDate) => format(toDate(d), 'EEEE, d MMMM yyyy')
export { isWeekend }

export function greeting(timezone: string): string {
  const h = hourIn(timezone)
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

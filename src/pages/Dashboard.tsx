import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CalendarDays, Flame, PenLine, Rocket, Star, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, PageLoader, Segmented, Stat } from '@/components/ui'
import { EntryCard } from '@/components/EntryParts'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { daysBetween, periodRange, prettyDate, shiftDays, toDate } from '@/lib/dates'
import { streak, weeklyCounts } from '@/lib/compose'
import type { Entry, KpiCategory, KpiMetric } from '@/lib/types'
import { cn, pluralize } from '@/lib/utils'

type P = 'week' | 'month' | 'quarter'

export default function Dashboard() {
  const { today, workDays, profile } = useSession()
  const [period, setPeriod] = useState<P>('month')
  const { data: categories } = useQuery(() => data.listCategories(), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: entries } = useQuery(() => data.listEntries({ from: shiftDays(today, -400), to: today }), [today])
  const { data: logs } = useQuery(() => data.listDailyLogs({ from: shiftDays(today, -400), to: today }), [today])

  const range = periodRange(period, today)
  const inPeriod = useMemo(() => (entries ?? []).filter((e) => e.entry_date >= range.start && e.entry_date <= range.end), [entries, range.start, range.end])

  if (!categories || !metrics || !entries || !logs) return <PageLoader />

  const week = periodRange('week', today)
  const month = periodRange('month', today)
  const thisWeek = entries.filter((e) => e.entry_date >= week.start)
  const aboveMonth = entries.filter((e) => e.entry_date >= month.start && e.entry_type === 'above_beyond')
  const blockers = entries.filter((e) => e.entry_type === 'blocker' && e.entry_date >= shiftDays(today, -14))
  const s = streak(entries, logs, today, workDays)

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`${profile?.job_title ? `${profile.job_title} · ` : ''}Your performance at a glance`}
        actions={<Link to="/log"><Button variant="accent" icon={<PenLine className="h-4 w-4" />}>Log today</Button></Link>} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Logging streak" value={<>{s} <span className="text-base font-semibold text-muted">{s === 1 ? 'day' : 'days'}</span></>} icon={<Flame className="h-5 w-5" />} tone="amber" hint="Work days in a row" />
        <Stat label="This week" value={thisWeek.length} icon={<TrendingUp className="h-5 w-5" />} tone="navy" hint={`${pluralize(new Set(thisWeek.map((e) => e.entry_date)).size, 'day')} logged`} />
        <Stat label="Above & beyond" value={aboveMonth.length} icon={<Star className="h-5 w-5" />} tone="teal" hint="This month" />
        <Stat label="Blockers" value={blockers.length} icon={<AlertTriangle className="h-5 w-5" />} tone="red" hint="Last 14 days" />
      </div>

      {entries.length === 0 ? (
        <Card className="mt-6"><EmptyState icon={<Rocket className="h-6 w-6" />} title="Your dashboard fills up as you log"
          body="You haven't logged anything yet. Start with today. Your KPI cards, heatmap and trends appear here."
          action={<Link to="/log"><Button variant="accent">Log today</Button></Link>} /></Card>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-bold">KPI performance</h2>
            <Segmented<P> value={period} onChange={setPeriod} options={[{ value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }]} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.map((c, i) => (
              <KpiCard key={c.id} cat={c} metrics={metrics.filter((m) => m.category_id === c.id)} entries={inPeriod.filter((e) => e.category_id === c.id)}
                total={inPeriod.length} allEntries={entries} today={today} period={period} index={i} />
            ))}
          </div>

          <div className="mt-8 grid gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-3">
              <h3 className="section-title">Activity</h3>
              <p className="text-sm text-muted">Entries per day, last 20 weeks</p>
              <Heatmap entries={entries} logs={logs} today={today} />
            </Card>
            <Card className="p-5 lg:col-span-2">
              <h3 className="section-title">Where your effort went</h3>
              <p className="text-sm text-muted">Entries by KPI, this {period}</p>
              <EffortBars categories={categories} entries={inPeriod} />
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="p-5 lg:col-span-2">
              <h3 className="section-title">Weekly trend</h3>
              <p className="text-sm text-muted">Entries logged per week</p>
              <WeeklyTrend entries={entries} today={today} />
            </Card>
            <Card className="p-5 lg:col-span-3">
              <div className="flex items-center justify-between">
                <h3 className="section-title">Recent entries</h3>
                <Link to="/history" className="text-sm font-medium text-teal-600">See all</Link>
              </div>
              <div className="mt-3 space-y-2">
                {[...entries].reverse().slice(0, 5).map((e) => (
                  <EntryCard key={e.id} entry={e} showDate category={categories.find((c) => c.id === e.category_id)} metric={metrics.find((m) => m.id === e.metric_id)} />
                ))}
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}

function scale(target: number, metricPeriod: string, p: P) {
  const perMonth = metricPeriod === 'week' ? target * 4.33 : metricPeriod === 'quarter' ? target / 3 : target
  return Math.max(1, Math.round(perMonth * (p === 'week' ? 1 / 4.33 : p === 'month' ? 1 : 3)))
}

function KpiCard({ cat, metrics, entries, total, allEntries, today, period, index }: {
  cat: KpiCategory; metrics: KpiMetric[]; entries: Entry[]; total: number; allEntries: Entry[]; today: string; period: P; index: number
}) {
  const last = allEntries.filter((e) => e.category_id === cat.id).map((e) => e.entry_date).sort().pop()
  const since = last ? daysBetween(last, today).length - 1 : null
  const quiet = !cat.is_extra && (since === null || since >= 14)
  const share = total ? Math.round((entries.length / total) * 100) : 0
  const above = entries.filter((e) => e.entry_type === 'above_beyond').length

  return (
    <motion.div initial={{ y: 10 }} animate={{ y: 0 }} transition={{ delay: index * 0.04 }}>
      <Link to={`/history?category=${cat.id}`} className="card block h-full overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
        <div className="h-1" style={{ background: cat.color }} />
        <div className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h4 className="truncate font-semibold">{cat.is_extra ? '✦ ' : ''}{cat.name}</h4>
              <p className="mt-0.5 text-xs text-muted">{last ? `Last entry ${since === 0 ? 'today' : since === 1 ? 'yesterday' : `${since} days ago`}` : 'No entries yet'}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold tabular-nums">{entries.length}</p>
              <p className="text-xs text-muted">{share}% of effort</p>
            </div>
          </div>
          {metrics.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {metrics.slice(0, 2).map((m) => {
                const actual = entries.filter((e) => e.metric_id === m.id).reduce((n, e) => n + (e.quantity ?? 1), 0)
                const target = m.target_value != null ? scale(m.target_value, m.period, period) : null
                const pct = target ? Math.min(100, (actual / target) * 100) : 0
                return (
                  <div key={m.id}>
                    <div className="flex justify-between gap-2 text-xs">
                      <span className="truncate text-muted">{m.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{actual}{target != null && <span className="font-normal text-muted"> / {target}</span>}</span>
                    </div>
                    {target != null && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={actual} aria-valuemax={target} aria-label={m.name}>
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cat.color }} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {above > 0 && <span className="chip bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"><Star className="h-3 w-3" />{above} above & beyond</span>}
            {quiet && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"><AlertTriangle className="h-3 w-3" />{since === null ? 'Not started' : `Quiet ${since} days`}</span>}
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

// Sequential teal ramp: empty, then light → dark by entry count.
const HEAT = ['bg-line/70', 'bg-teal-100 dark:bg-teal-900', 'bg-teal-300 dark:bg-teal-700', 'bg-teal-500', 'bg-teal-700 dark:bg-teal-300']

function Heatmap({ entries, logs, today }: { entries: Entry[]; logs: { log_date: string; day_type: string }[]; today: string }) {
  const [hover, setHover] = useState<{ d: string; n: number; off?: string } | null>(null)
  const counts = useMemo(() => {
    const m = new Map<string, number>()
    entries.forEach((e) => m.set(e.entry_date, (m.get(e.entry_date) ?? 0) + 1))
    return m
  }, [entries])
  const off = new Map(logs.filter((l) => l.day_type !== 'work').map((l) => [l.log_date, l.day_type]))
  const end = today
  const startMonday = (() => { const t = shiftDays(today, -7 * 19); const dow = (toDate(t).getDay() + 6) % 7; return shiftDays(t, -dow) })()
  const days = daysBetween(startMonday, end)
  const weeks: string[][] = []
  days.forEach((d, i) => { (weeks[Math.floor(i / 7)] ||= []).push(d) })
  const level = (n: number) => (n === 0 ? 0 : n <= 1 ? 1 : n <= 3 ? 2 : n <= 5 ? 3 : 4)

  return (
    <div className="mt-4">
      <div className="flex gap-[3px] overflow-x-auto pb-1 scrollbar-none">
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[10px] text-muted">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((l, i) => <span key={i} className="flex h-3.5 items-center sm:h-4">{l}</span>)}
        </div>
        {weeks.map((w, wi) => (
          <div key={wi} className="grid grid-rows-7 gap-[3px]">
            {w.map((d) => {
              const n = counts.get(d) ?? 0
              const o = off.get(d)
              return (
                <button key={d} type="button" aria-label={`${prettyDate(d)}: ${o ?? pluralize(n, 'entry', 'entries')}`}
                  onMouseEnter={() => setHover({ d, n, off: o })} onMouseLeave={() => setHover(null)} onFocus={() => setHover({ d, n, off: o })}
                  className={cn('h-3.5 w-3.5 rounded-[3px] sm:h-4 sm:w-4', o ? 'bg-[repeating-linear-gradient(45deg,rgb(var(--line)),rgb(var(--line))_2px,transparent_2px,transparent_4px)] ring-1 ring-inset ring-line' : HEAT[level(n)])} />
              )
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
        <span className="min-h-[1rem] font-medium text-ink">{hover ? `${prettyDate(hover.d, 'EEE d MMM yyyy')} · ${hover.off ? `Day off (${hover.off})` : pluralize(hover.n, 'entry', 'entries')}` : <span className="inline-flex items-center gap-1 text-muted"><CalendarDays className="h-3.5 w-3.5" />Hover a day for details</span>}</span>
        <span className="flex items-center gap-1">Less {HEAT.map((h, i) => <span key={i} className={cn('h-3 w-3 rounded-[3px]', h)} />)} More</span>
      </div>
    </div>
  )
}

function EffortBars({ categories, entries }: { categories: KpiCategory[]; entries: Entry[] }) {
  const rows = categories.map((c) => ({ c, n: entries.filter((e) => e.category_id === c.id).length })).sort((a, b) => b.n - a.n)
  const max = Math.max(1, ...rows.map((r) => r.n))
  if (!entries.length) return <p className="mt-6 text-sm text-muted">Nothing logged in this period yet.</p>
  return (
    <ul className="mt-4 space-y-3">
      {rows.map(({ c, n }) => (
        <li key={c.id} className="group" title={`${c.name}: ${n}`}>
          <div className="flex justify-between gap-2 text-sm">
            <span className="truncate">{c.name}</span>
            <span className="font-semibold tabular-nums">{n}</span>
          </div>
          <div className="mt-1 h-2.5 rounded-full bg-transparent">
            <motion.div className="h-full rounded-r-[4px] rounded-l-sm" style={{ background: c.color }} initial={{ width: 0 }} animate={{ width: `${(n / max) * 100}%` }} transition={{ duration: 0.5 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function WeeklyTrend({ entries, today }: { entries: Entry[]; today: string }) {
  const rows = weeklyCounts(entries, today, 10).map((w) => ({ ...w, label: prettyDate(w.week, 'd MMM') }))
  return (
    <div className="mt-4 h-52">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="rgb(var(--line))" strokeDasharray="0" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} tickLine={false} axisLine={false} interval={1} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} tickLine={false} axisLine={false} />
          <Tooltip cursor={{ fill: 'rgb(var(--line) / 0.5)' }}
            contentStyle={{ background: 'rgb(var(--surface))', border: '1px solid rgb(var(--line))', borderRadius: 12, fontSize: 13, color: 'rgb(var(--ink))' }}
            labelFormatter={(l) => `Week of ${l}`} formatter={(v: number) => [v, 'Entries']} />
          <Bar dataKey="count" fill="#1D9E75" radius={[4, 4, 0, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

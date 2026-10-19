import { Link } from 'react-router-dom'
import { AlertTriangle, Info, Sparkles, Star, ThumbsUp } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, PageLoader } from '@/components/ui'
import { EntryCard } from '@/components/EntryParts'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { computeInsights, suggestKpisFromExtras } from '@/lib/compose'
import { periodRange, prettyDate, shiftDays } from '@/lib/dates'
import { cn } from '@/lib/utils'

const MOODS = ['😫', '😕', '😐', '🙂', '🤩']

export default function Insights() {
  const { today, workDays } = useSession()
  const { data: categories } = useQuery(() => data.listCategories(), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: entries } = useQuery(() => data.listEntries({ from: shiftDays(today, -365), to: today }), [today])
  const { data: logs } = useQuery(() => data.listDailyLogs({ from: shiftDays(today, -365), to: today }), [today])
  if (!categories || !metrics || !entries || !logs) return <PageLoader />

  const insights = computeInsights({ entries, logs, categories, today, workDays })
  const extra = categories.find((c) => c.is_extra)
  const suggestions = suggestKpisFromExtras(entries, extra?.id)
  const above = [...entries].filter((e) => e.entry_type === 'above_beyond').reverse()
  const quarter = periodRange('quarter', today)
  const openBlockers = entries.filter((e) => e.entry_type === 'blocker' && e.entry_date >= shiftDays(today, -14)).reverse()

  const moodLogs = logs.filter((l) => l.mood && l.log_date >= shiftDays(today, -30))
  const avgMood = moodLogs.length ? moodLogs.reduce((n, l) => n + (l.mood ?? 0), 0) / moodLogs.length : null

  // Focus balance: share of effort per KPI over the last 30 days.
  const recent = entries.filter((e) => e.entry_date >= shiftDays(today, -30))
  const balance = categories.map((c) => ({ c, n: recent.filter((e) => e.category_id === c.id).length })).filter((x) => x.n > 0)
  const totalRecent = recent.length

  if (entries.length < 3) {
    return (
      <div>
        <PageHeader title="Insights" />
        <Card><EmptyState icon={<Sparkles className="h-6 w-6" />} title="Insights appear after a few days of logging"
          body="Once you've logged a little work, you'll see above-and-beyond moments, quiet KPIs, light weeks and how your focus is split."
          action={<Link to="/log"><Button variant="accent">Log today</Button></Link>} /></Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Insights" subtitle="Patterns in your work, compared with your own baseline, never anyone else's." />

      <div className="grid gap-3 md:grid-cols-2">
        {insights.length === 0 && <Card className="p-5 md:col-span-2"><p className="text-muted">No flags right now. Your KPIs are balanced and your logging is steady.</p></Card>}
        {insights.map((i, k) => (
          <Card key={k} className={cn('flex gap-3 p-5', i.tone === 'warn' && 'border-amber-200 dark:border-amber-500/30', i.tone === 'good' && 'border-teal-200 dark:border-teal-500/30')}>
            <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
              i.tone === 'warn' ? 'bg-amber-50 text-amber-600 dark:bg-amber-500/10' : i.tone === 'good' ? 'bg-teal-50 text-teal-600 dark:bg-teal-500/10' : 'bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-navy-200')}>
              {i.tone === 'warn' ? <AlertTriangle className="h-5 w-5" /> : i.tone === 'good' ? <ThumbsUp className="h-5 w-5" /> : <Info className="h-5 w-5" />}
            </span>
            <div><p className="font-semibold">{i.title}</p><p className="mt-0.5 text-sm text-muted">{i.detail}</p></div>
          </Card>
        ))}
        {suggestions.length > 0 && (
          <Card className="flex gap-3 p-5 md:col-span-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-500 dark:bg-white/5 dark:text-navy-200"><Sparkles className="h-5 w-5" /></span>
            <div className="flex-1">
              <p className="font-semibold">Recurring Beyond Scope work: {suggestions.map((s) => s.theme).join(', ')}</p>
              <p className="mt-0.5 text-sm text-muted">Consider adding a KPI so it's measured, or raise it with your manager as scope growth.</p>
            </div>
            <Link to="/kpis"><Button size="sm" variant="secondary">Review KPIs</Button></Link>
          </Card>
        )}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="section-title flex items-center gap-2"><Star className="h-4 w-4 text-emerald-500" />Above & beyond</h2>
            <span className="text-sm text-muted">{above.filter((e) => e.entry_date >= quarter.start).length} this quarter · {above.length} this year</span>
          </div>
          <p className="text-sm text-muted">Your appraisal ammunition, all in one place.</p>
          {above.length ? (
            <div className="mt-4 space-y-2">{above.slice(0, 12).map((e) => <EntryCard key={e.id} entry={e} showDate category={categories.find((c) => c.id === e.category_id)} metric={metrics.find((m) => m.id === e.metric_id)} />)}</div>
          ) : <p className="mt-4 text-sm text-muted">Nothing flagged yet. When you go the extra mile, mark the entry "Above & beyond" in your log.</p>}
        </Card>

        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="section-title">Focus balance</h2>
            <p className="text-sm text-muted">Last 30 days</p>
            {totalRecent ? (
              <>
                <div className="mt-4 flex h-3 gap-[2px] overflow-hidden rounded-full">
                  {balance.map(({ c, n }) => <span key={c.id} title={`${c.name}: ${n}`} style={{ width: `${(n / totalRecent) * 100}%`, background: c.color }} />)}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {balance.sort((a, b) => b.n - a.n).map(({ c, n }) => (
                    <li key={c.id} className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                      <span className="tabular-nums text-muted">{Math.round((n / totalRecent) * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : <p className="mt-3 text-sm text-muted">No entries in the last 30 days.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="section-title">Mood</h2>
            <p className="text-sm text-muted">Last 30 days</p>
            {avgMood ? (
              <div className="mt-3 flex items-center gap-3">
                <span className="text-4xl">{MOODS[Math.round(avgMood) - 1]}</span>
                <div><p className="font-semibold">{avgMood.toFixed(1)} / 5 average</p><p className="text-sm text-muted">from {moodLogs.length} days</p></div>
              </div>
            ) : <p className="mt-3 text-sm text-muted">Add a mood in your Daily Log to see this.</p>}
          </Card>

          <Card className="p-5">
            <h2 className="section-title">Recent blockers</h2>
            {openBlockers.length ? (
              <ul className="mt-3 space-y-2">{openBlockers.slice(0, 5).map((e) => <li key={e.id} className="text-sm"><span className="text-muted">{prettyDate(e.entry_date)}:</span> {e.blocker_detail || e.refined_text}</li>)}</ul>
            ) : <p className="mt-3 text-sm text-muted">None in the last 2 weeks.</p>}
          </Card>
        </div>
      </div>
    </div>
  )
}

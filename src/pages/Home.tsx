import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, CalendarCheck2, CheckCircle2, Circle, FileText, History, LayoutDashboard, Mic2, PenLine, Sparkles, Target,
} from 'lucide-react'
import { Button, Card } from '@/components/ui'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { greeting, longDate, previousWorkDay } from '@/lib/dates'
import { firstName, pluralize } from '@/lib/utils'

const SECTIONS = [
  { to: '/log', icon: PenLine, title: 'Daily Log', body: 'Write what you did today. AI splits and files it under your KPIs.', color: 'from-teal-500 to-teal-600' },
  { to: '/standup', icon: Mic2, title: 'Standup', body: 'Yesterday, today and blockers, ready to read out.', color: 'from-navy-500 to-navy-600' },
  { to: '/planner', icon: CalendarCheck2, title: 'Planner', body: 'Plan today, carry over unfinished tasks.', color: 'from-amber-500 to-orange-500' },
  { to: '/dashboard', icon: LayoutDashboard, title: 'Dashboard', body: 'Your KPIs at a glance: effort, streaks, gaps.', color: 'from-sky-500 to-blue-600' },
  { to: '/history', icon: History, title: 'Work History', body: 'Everything logged by day, week, month, quarter or year.', color: 'from-violet-500 to-purple-600' },
  { to: '/reports', icon: FileText, title: 'Reports', body: 'Professional summaries to export or share with your manager.', color: 'from-rose-500 to-pink-600' },
  { to: '/kpis', icon: Target, title: 'KPIs', body: 'Your categories and metrics. Add more as your role grows.', color: 'from-emerald-500 to-green-600' },
  { to: '/insights', icon: Sparkles, title: 'Insights', body: 'Above-and-beyond moments, quiet KPIs and trends.', color: 'from-fuchsia-500 to-pink-500' },
]

export default function HomePage() {
  const { profile, today, tz, workDays } = useSession()
  const prev = previousWorkDay(today, workDays)
  const { data: todays } = useQuery(() => data.listEntries({ from: today, to: today }), [today])
  const { data: prevs } = useQuery(() => data.listEntries({ from: prev, to: prev }), [prev])
  const { data: tasks } = useQuery(() => data.listTasks({ from: today, to: today }), [today])
  const { data: all } = useQuery(() => data.listEntries(), [])

  const isNew = (all?.length ?? 0) === 0
  const loggedToday = (todays?.length ?? 0) > 0
  const openTasks = tasks?.filter((t) => !t.done_at) ?? []

  const checklist = [
    { done: true, label: 'Set up your profile and KPIs', to: '/kpis' },
    { done: (tasks?.length ?? 0) > 0, label: "Plan today's tasks", to: '/planner' },
    { done: loggedToday, label: 'Log your first day of work', to: '/log' },
    { done: false, label: 'Generate your first standup', to: '/standup' },
  ]

  return (
    <div>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-navy-600 px-6 py-7 text-white sm:px-8 sm:py-9">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(29,158,117,0.55),transparent_55%)]" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-navy-100">{longDate(today)}</p>
            <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{greeting(tz)}, {firstName(profile?.full_name ?? '')}</h1>
            <p className="mt-2 max-w-lg text-navy-100">
              {loggedToday
                ? `You've logged ${pluralize(todays!.length, 'item')} today. Add more as the day goes on.`
                : prevs && prevs.length === 0 && !isNew
                  ? "You haven't logged today yet, and your previous work day is still empty. You can still fill it in."
                  : "You haven't logged today yet. It takes about three minutes."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/log"><Button variant="accent" size="lg" icon={<PenLine className="h-4 w-4" />}>Log today</Button></Link>
            <Link to="/standup"><Button size="lg" className="bg-white/10 hover:bg-white/20" icon={<Mic2 className="h-4 w-4" />}>Standup</Button></Link>
          </div>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="section-title">Today's plan</h2>
            <Link to="/planner" className="text-sm font-medium text-teal-600">Open planner</Link>
          </div>
          {openTasks.length ? (
            <ul className="mt-3 divide-y divide-line/70">
              {openTasks.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-2.5 text-sm"><Circle className="h-4 w-4 text-muted" />{t.title}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-muted">{tasks?.length ? 'All of today\'s tasks are done. Nice work.' : 'Nothing planned yet. Add a few tasks to guide your day.'}</p>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="section-title">{isNew ? 'Getting started' : 'At a glance'}</h2>
          {isNew ? (
            <ul className="mt-3 space-y-2.5">
              {checklist.map((c) => (
                <li key={c.label}>
                  <Link to={c.to} className="flex items-center gap-2.5 text-sm hover:text-teal-600">
                    {c.done ? <CheckCircle2 className="h-5 w-5 text-teal-500" /> : <Circle className="h-5 w-5 text-muted" />}
                    <span className={c.done ? 'text-muted line-through' : ''}>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <dl className="mt-3 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-muted">Today</dt><dd className="text-xl font-bold">{todays?.length ?? 0}</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-muted">Previous day</dt><dd className="text-xl font-bold">{prevs?.length ?? 0}</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-muted">Open tasks</dt><dd className="text-xl font-bold">{openTasks.length}</dd></div>
              <div className="rounded-xl bg-canvas p-3"><dt className="text-xs text-muted">All time</dt><dd className="text-xl font-bold">{all?.length ?? 0}</dd></div>
            </dl>
          )}
        </Card>
      </div>

      <div className="mt-10">
        <h2 className="text-xl font-bold">Everything in Proofwork</h2>
        <p className="mt-1 text-muted">Log daily. The rest builds itself.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s, i) => (
            <motion.div key={s.to} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 * i }}>
              <Link to={s.to} className="card group flex h-full flex-col p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.color} text-white`}><s.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-semibold">{s.title}</h3>
                <p className="mt-1 flex-1 text-sm text-muted">{s.body}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-teal-600 opacity-0 transition group-hover:opacity-100">Open <ArrowRight className="h-3.5 w-3.5" /></span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>

      <Card className="mt-10 p-6">
        <h2 className="section-title">How Proofwork works</h2>
        <ol className="mt-4 grid gap-4 md:grid-cols-4">
          {[
            ['Plan', 'Each morning, jot today\'s tasks in the Planner.'],
            ['Log', 'At the end of the day, write what you did, however you like.'],
            ['Review', 'AI files each item under a KPI. Fix anything, then save.'],
            ['Share', 'Standup, weekly and monthly reports are built from your log.'],
          ].map(([t, b], i) => (
            <li key={t} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-500 text-sm font-bold text-white">{i + 1}</span>
              <div><p className="font-semibold">{t}</p><p className="text-sm text-muted">{b}</p></div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-xl bg-canvas p-3 text-sm text-muted">
          <b className="text-ink">Logging rule:</b> you can log today and fill in your previous work day ({prev}) if you forgot. Older days are read-only so your record stays trustworthy.
        </p>
      </Card>
    </div>
  )
}

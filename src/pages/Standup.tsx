import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Copy, Maximize2, Pencil, RefreshCw, Sunrise, X } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, PageLoader, Textarea } from '@/components/ui'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { buildStandup, standupToText } from '@/lib/compose'
import { polishStandup } from '@/lib/ai'
import { longDate, prettyDate, previousWorkDay, shiftDays } from '@/lib/dates'
import { copyText } from '@/lib/utils'
import type { Standup } from '@/lib/types'

type Parts = Pick<Standup, 'yesterday' | 'today' | 'blockers'>

export default function StandupPage() {
  const { profile, today, workDays } = useSession()
  const toast = useToast()
  const prev = previousWorkDay(today, workDays)
  const { data: saved, loading } = useQuery(() => data.getStandup(today), [today])
  const { data: history } = useQuery(() => data.listStandups(20), [])
  const [parts, setParts] = useState<Parts | null>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [present, setPresent] = useState(false)
  const [viewing, setViewing] = useState<Standup | null>(null)

  /** Rebuilds from the log and planner. The AI polish only runs when that input changed, or when forced. */
  const generate = async (force = false) => {
    setBusy(true)
    try {
      const [yEntries, tasks, recent] = await Promise.all([
        data.listEntries({ from: prev, to: prev }),
        data.listTasks({ from: today, to: today }),
        data.listEntries({ from: shiftDays(today, -7), to: today }),
      ])
      const lastByText = new Map<string, (typeof recent)[number]>()
      recent.forEach((e) => lastByText.set(e.refined_text, e))
      const built = buildStandup({
        yesterdayEntries: yEntries,
        todayTasks: tasks,
        inProgress: [...lastByText.values()].filter((e) => e.status === 'in_progress' && e.entry_date < today),
        recentBlockers: recent.filter((e) => e.entry_type === 'blocker' && e.entry_date >= shiftDays(today, -3)),
      })
      const source_hash = JSON.stringify(built)
      if (!force && saved && saved.source_hash === source_hash) {
        setParts({ yesterday: saved.yesterday, today: saved.today, blockers: saved.blockers })
        return
      }
      const polished = await polishStandup(built)
      const s = await data.saveStandup({ standup_date: today, ...polished.value, generated_at: new Date().toISOString(), edited: false, source_hash })
      setParts({ yesterday: s.yesterday, today: s.today, blockers: s.blockers })
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  useEffect(() => {
    if (loading) return
    // Hand-edited standups are kept; otherwise rebuild from the latest log and planner on each visit.
    if (saved?.edited) setParts({ yesterday: saved.yesterday, today: saved.today, blockers: saved.blockers })
    else if (!parts && !busy) void generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, saved])

  const saveEdits = async () => {
    if (!parts) return
    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
    const next = { yesterday: clean(parts.yesterday), today: clean(parts.today), blockers: clean(parts.blockers) }
    await data.saveStandup({ standup_date: today, ...next, generated_at: saved?.generated_at ?? new Date().toISOString(), edited: true, source_hash: saved?.source_hash ?? '' })
    setParts(next)
    setEditing(false); toast('Standup saved')
  }

  const copy = async (s: Parts, date: string) => {
    const ok = await copyText(standupToText(profile?.full_name ?? '', date, s))
    toast(ok ? 'Copied. Paste it into Teams, Slack or email.' : 'Copy failed. Select the text manually.', ok ? 'success' : 'error')
  }

  if (loading || !parts) return <PageLoader />
  const empty = !parts.yesterday.length && !parts.today.length && !parts.blockers.length

  return (
    <div>
      <PageHeader title="Standup" subtitle={`For ${longDate(today)} · covering ${prettyDate(prev, 'EEEE d MMM')}`}
        actions={<>
          <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={busy} onClick={() => generate(true)}>Regenerate</Button>
          <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => (editing ? saveEdits() : setEditing(true))}>{editing ? 'Save' : 'Edit'}</Button>
          <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(parts, today)}>Copy</Button>
          <Button variant="accent" size="sm" icon={<Maximize2 className="h-4 w-4" />} onClick={() => setPresent(true)}>Read-out mode</Button>
        </>} />

      {empty && !editing ? (
        <Card><EmptyState icon={<Sunrise className="h-6 w-6" />} title="Nothing to report yet"
          body={`Log what you did on ${prettyDate(prev, 'EEEE')} and plan today's tasks, then regenerate.`}
          action={<div className="flex gap-2"><Link to={`/log?date=${prev}`}><Button variant="accent">Log {prettyDate(prev, 'EEEE')}</Button></Link><Link to="/planner"><Button variant="outline">Plan today</Button></Link></div>} /></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {([
            ['yesterday', prev === shiftDays(today, -1) ? 'Yesterday' : `Last work day (${prettyDate(prev, 'EEE')})`, CheckCircle2, 'text-teal-500', 'Nothing logged'],
            ['today', 'Today', Sunrise, 'text-navy-500 dark:text-navy-300', 'Add tasks in the planner'],
            ['blockers', 'Blockers', AlertTriangle, 'text-red-500', 'No blockers'],
          ] as const).map(([key, title, Icon, cls, emptyText]) => (
            <Card key={key} className="p-5">
              <h2 className="flex items-center gap-2 font-semibold"><Icon className={`h-5 w-5 ${cls}`} />{title}</h2>
              {editing ? (
                <Textarea className="mt-3 text-sm" rows={8} value={parts[key].join('\n')} onChange={(e) => setParts({ ...parts, [key]: e.target.value.split('\n') })} aria-label={title} />
              ) : parts[key].filter(Boolean).length ? (
                <ul className="mt-3 space-y-2.5">
                  {parts[key].filter(Boolean).map((x, i) => <li key={i} className="flex gap-2 text-[15px] leading-snug"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />{x}</li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-muted">{emptyText}</p>}
            </Card>
          ))}
        </div>
      )}

      {history && history.filter((h) => h.standup_date !== today).length > 0 && (
        <div className="mt-10">
          <h2 className="section-title mb-3">Previous standups</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {history.filter((h) => h.standup_date !== today).map((h) => (
              <button key={h.id} onClick={() => setViewing(h)} className="card p-4 text-left transition hover:shadow-lift">
                <p className="font-semibold">{prettyDate(h.standup_date, 'EEEE d MMM')}</p>
                <p className="mt-1 line-clamp-2 text-sm text-muted">{h.yesterday.filter(Boolean).join(' · ') || 'No items'}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Read-out / viewing overlay */}
      <AnimatePresence>
        {(present || viewing) && (
          <motion.div className="fixed inset-0 z-50 overflow-y-auto bg-navy-700 text-white" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
              <div className="mb-10 flex items-start justify-between gap-4">
                <div>
                  <p className="text-navy-100">{profile?.full_name}</p>
                  <h2 className="text-3xl font-bold sm:text-4xl">Standup · {prettyDate(viewing?.standup_date ?? today, 'EEEE d MMM')}</h2>
                </div>
                <div className="flex gap-2">
                  {viewing && <Button size="sm" className="bg-white/10 hover:bg-white/20" onClick={() => copy(viewing, viewing.standup_date)} icon={<Copy className="h-4 w-4" />}>Copy</Button>}
                  <button onClick={() => { setPresent(false); setViewing(null) }} className="rounded-xl bg-white/10 p-2.5 hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
                </div>
              </div>
              {(['yesterday', 'today', 'blockers'] as const).map((k) => {
                const items = (viewing ?? parts)[k].filter(Boolean)
                return (
                  <section key={k} className="mb-10">
                    <h3 className="mb-4 text-sm font-bold uppercase tracking-[0.2em] text-teal-300">{k === 'yesterday' ? 'Yesterday' : k === 'today' ? 'Today' : 'Blockers'}</h3>
                    {items.length ? (
                      <ul className="space-y-4">{items.map((x, i) => <li key={i} className="text-xl leading-relaxed sm:text-2xl">• {x}</li>)}</ul>
                    ) : <p className="text-xl text-navy-200">{k === 'blockers' ? 'None' : 'Nothing to report'}</p>}
                  </section>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, CalendarCheck2, Check, Loader2, PenLine, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, CategoryChip, EmptyState, Input, PageLoader, Segmented, Select } from '@/components/ui'
import { useToast } from '@/components/toast'
import { refineItems } from '@/lib/ai'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { editWindow, isWorkDay, longDate, prettyDate, shiftDays } from '@/lib/dates'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

function nextWorkDay(d: string, workDays: number[]) {
  let cur = shiftDays(d, 1)
  for (let i = 0; i < 7 && !isWorkDay(cur, workDays); i++) cur = shiftDays(cur, 1)
  return cur
}

export default function Planner() {
  const { today, workDays } = useSession()
  const toast = useToast()
  const tomorrow = nextWorkDay(today, workDays)
  const [day, setDay] = useState<'today' | 'next'>('today')
  const date = day === 'today' ? today : tomorrow
  const [title, setTitle] = useState('')
  const [cat, setCat] = useState('')

  const { data: categories } = useQuery(() => data.listCategories(), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: tasks, loading } = useQuery(() => data.listTasks({ from: date, to: date }), [date])
  const { data: older } = useQuery(() => data.listTasks({ from: shiftDays(today, -14), to: shiftDays(today, -1) }), [today])
  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const carry = (older ?? []).filter((t) => !t.done_at)

  const [adding, setAdding] = useState(false)
  const add = async (e: FormEvent) => {
    e.preventDefault()
    const t = title.trim()
    // Guard against double submits (Enter + click, or a fast double press).
    if (!t || adding) return
    if ((tasks ?? []).some((x) => x.title.toLowerCase() === t.toLowerCase())) { toast('That task is already on the list.', 'info'); return }
    setAdding(true)
    try {
      await data.saveTask({ title: t, task_date: date, category_id: cat || null })
      setTitle('')
    } finally { setAdding(false) }
  }

  // Ticking a task logs it (AI-refined) on its own day, so it feeds the next day's standup.
  // Unticking removes the entry that was created from it.
  const toggle = (t: Task) => run(`tick:${t.id}`, async () => {
    if (!t.done_at) {
      const { logged, aiNote } = await completeOld([t])
      if (aiNote) toast(`Claude couldn't refine it (${aiNote}), so it was added as written.`, 'info')
      if (logged) toast(`Done, and added to ${t.task_date === today ? "today's" : `${prettyDate(t.task_date, 'EEEE')}'s`} log.`)
      return
    }
    await data.saveTask({ ...t, done_at: null })
    if (editWindow(t.task_date, today, workDays) === 'locked') return
    const key = t.title.trim().toLowerCase()
    const linked = (await data.listEntries({ from: t.task_date, to: t.task_date })).filter((e) => e.raw_text.trim().toLowerCase() === key)
    for (const e of linked) await data.deleteEntry(e.id)
    if (linked.length) toast('Unticked, and removed from the log.', 'info')
  })

  const [busy, setBusy] = useState<string | null>(null)
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return
    setBusy(key)
    try { await fn() } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(null) }
  }

  const carryOver = (t: Task) => data.saveTask({ ...t, task_date: today, carried_from: t.carried_from ?? t.task_date })

  /**
   * Close out old tasks on their own day. Tasks whose day can still be logged are refined by the AI
   * (wording + KPI; a task's own KPI wins) and added to that day's log. Returns how many were logged.
   */
  const completeOld = async (list: Task[]): Promise<{ logged: number; aiNote?: string }> => {
    const now = new Date().toISOString()
    for (const t of list) await data.saveTask({ ...t, done_at: now })
    const byDate = new Map<string, Task[]>()
    list.filter((t) => editWindow(t.task_date, today, workDays) !== 'locked').forEach((t) => byDate.set(t.task_date, [...(byDate.get(t.task_date) ?? []), t]))
    let logged = 0
    let aiNote: string | undefined
    for (const [day, dayTasks] of byDate) {
      const existing = new Set((await data.listEntries({ from: day, to: day })).map((e) => e.raw_text.trim().toLowerCase()))
      const fresh = dayTasks.filter((t) => !existing.has(t.title.trim().toLowerCase()))
      if (!fresh.length) continue
      const r = await refineItems(fresh.map((t) => t.title), categories ?? [], metrics ?? [])
      if (r.reason) aiNote = r.reason
      await data.addEntries(r.value.map((d, i) => {
        const t = fresh[i]
        const keepCat = t.category_id && t.category_id !== d.category_id
        return {
          entry_date: day, category_id: t.category_id ?? d.category_id, metric_id: keepCat ? null : d.metric_id,
          raw_text: t.title, refined_text: d.refined_text, entry_type: d.entry_type, status: 'done' as const, quantity: keepCat ? null : d.quantity,
          impact_note: d.impact_note, blocker_detail: d.blocker_detail, evidence_url: '', stakeholders: d.stakeholders,
          is_late: day !== today, ai_confidence: d.ai_confidence,
        }
      }))
      logged += fresh.length
    }
    return { logged, aiNote }
  }

  const markDone = (t: Task) => run(`done:${t.id}`, async () => {
    const { logged, aiNote } = await completeOld([t])
    if (aiNote) toast(`Claude couldn't refine it (${aiNote}), so it was added as written.`, 'info')
    toast(logged ? `Done, and added to ${prettyDate(t.task_date, 'EEEE')}'s log.` : `Marked done. ${prettyDate(t.task_date, 'EEE d MMM')} is locked, so it wasn't added to the log.`)
  })
  const moveToday = (t: Task) => run(`move:${t.id}`, async () => { await carryOver(t) })
  const drop = (t: Task) => run(`drop:${t.id}`, async () => { await data.deleteTask(t.id) })
  const moveAll = () => run('all-move', async () => { for (const t of carry) await carryOver(t); toast(`Moved ${carry.length} tasks to today`) })
  const doneAll = () => run('all-done', async () => {
    if (!confirm(`Mark all ${carry.length} unfinished tasks as done and add them to their days' logs?`)) return
    const { logged, aiNote } = await completeOld(carry)
    if (aiNote) toast(`Claude couldn't refine some tasks (${aiNote}), so they were added as written.`, 'info')
    toast(`Closed ${carry.length} tasks${logged ? `, ${logged} added to your log` : ''}.`)
  })

  if (!categories) return <PageLoader />
  const open = (tasks ?? []).filter((t) => !t.done_at)
  const done = (tasks ?? []).filter((t) => t.done_at)
  const pct = tasks?.length ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div>
      <PageHeader title="Planner" subtitle="Plan your day. Tick a task when it is done: it is tidied up by AI, added to that day's log, and shows in the next standup."
        actions={<Link to="/log"><Button variant="accent" size="sm" icon={<PenLine className="h-4 w-4" />}>Daily Log</Button></Link>} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Segmented value={day} onChange={setDay} options={[{ value: 'today', label: `Today · ${prettyDate(today, 'EEE')}` }, { value: 'next', label: `Next work day · ${prettyDate(tomorrow, 'EEE')}` }]} />
              {tasks && tasks.length > 0 && <span className="text-sm text-muted">{done.length}/{tasks.length} done</span>}
            </div>
            {tasks && tasks.length > 0 && (
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-line"><motion.div className="h-full rounded-full bg-teal-500" animate={{ width: `${pct}%` }} /></div>
            )}
            <form onSubmit={add} className="mt-4 grid gap-2 xl:grid-cols-[1fr_200px_auto]">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Add a task for ${day === 'today' ? 'today' : longDate(tomorrow)}…`} aria-label="New task" />
              <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="KPI (optional)">
                <option value="">No KPI</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
              <Button type="submit" icon={<Plus className="h-4 w-4" />} disabled={!title.trim()} loading={adding}>Add</Button>
            </form>
          </Card>

          <Card className="p-2 sm:p-3">
            {loading && !tasks ? <PageLoader /> : !tasks?.length ? (
              <EmptyState icon={<CalendarCheck2 className="h-6 w-6" />} title="No tasks yet" body="Add 3–5 things you want to get done. They'll feed your standup's 'Today' section." />
            ) : (
              <ul>
                <AnimatePresence initial={false}>
                  {[...open, ...done].map((t) => {
                    const c = t.category_id ? catById.get(t.category_id) : undefined
                    return (
                      <motion.li key={t.id} layout initial={false} exit={{ opacity: 0, height: 0 }}
                        className="group flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-canvas">
                        <button onClick={() => toggle(t)} aria-label={t.done_at ? 'Mark not done' : 'Mark done'} disabled={!!busy} aria-busy={busy === `tick:${t.id}`}
                          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition disabled:cursor-wait', t.done_at ? 'border-teal-500 bg-teal-500 text-white' : 'border-line hover:border-teal-400')}>
                          {busy === `tick:${t.id}` ? <Loader2 className="h-4 w-4 animate-spin text-teal-500" /> : t.done_at && <Check className="h-4 w-4" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn('text-[15px]', t.done_at && 'text-muted line-through')}>{t.title}</p>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            {c && <CategoryChip name={c.name} color={c.color} />}
                            {t.carried_from && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Carried from {prettyDate(t.carried_from, 'EEE d MMM')}</span>}
                          </div>
                        </div>
                        <button onClick={() => data.deleteTask(t.id)} className="rounded-lg p-1.5 text-muted opacity-100 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100" aria-label="Delete task"><Trash2 className="h-4 w-4" /></button>
                      </motion.li>
                    )
                  })}
                </AnimatePresence>
              </ul>
            )}
          </Card>
        </div>

        <Card className="h-fit p-5">
          <h3 className="section-title">Unfinished</h3>
          <p className="text-sm text-muted">Open tasks from the last two weeks. Close them out on their own day, or bring them into today.</p>
          {carry.length > 1 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button size="sm" variant="secondary" onClick={doneAll} loading={busy === 'all-done'} icon={<Check className="h-3.5 w-3.5" />}>Mark all done</Button>
              <Button size="sm" variant="outline" onClick={moveAll} loading={busy === 'all-move'} icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>Move all</Button>
            </div>
          )}
          {carry.length ? (
            <ul className="mt-3 space-y-2">
              {carry.map((t) => (
                <li key={t.id} className="rounded-xl bg-canvas p-3">
                  <p className="text-sm leading-snug">{t.title}</p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="mr-auto whitespace-nowrap text-xs text-muted">{prettyDate(t.task_date, 'EEE d MMM')}</span>
                    <Button size="sm" variant="secondary" className="h-7 px-2 text-teal-700 dark:text-teal-300" onClick={() => markDone(t)} loading={busy === `done:${t.id}`}
                      icon={<Check className="h-3.5 w-3.5" />} title={`Mark done on ${prettyDate(t.task_date, 'EEEE')}`}>Done</Button>
                    <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => moveToday(t)} loading={busy === `move:${t.id}`}
                      icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>Today</Button>
                    <button onClick={() => drop(t)} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label={`Drop "${t.title}"`} title="Drop task">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">All caught up. 🎉</p>}
        </Card>
      </div>
    </div>
  )
}

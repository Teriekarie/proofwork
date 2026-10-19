import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, CalendarCheck2, Check, PenLine, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, CategoryChip, EmptyState, Input, PageLoader, Segmented, Select } from '@/components/ui'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { isWorkDay, longDate, prettyDate, shiftDays } from '@/lib/dates'
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
  const { data: tasks, loading } = useQuery(() => data.listTasks({ from: date, to: date }), [date])
  const { data: older } = useQuery(() => data.listTasks({ from: shiftDays(today, -14), to: shiftDays(today, -1) }), [today])
  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const carry = (older ?? []).filter((t) => !t.done_at)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    await data.saveTask({ title: title.trim(), task_date: date, category_id: cat || null })
    setTitle('')
  }

  const toggle = async (t: Task) => {
    const done = !t.done_at
    await data.saveTask({ ...t, done_at: done ? new Date().toISOString() : null })
    if (done && t.task_date === today) toast('Done! It\'s waiting in your Daily Log to add in one tap.')
  }

  const carryOver = async (t: Task) => {
    await data.saveTask({ ...t, task_date: today, carried_from: t.carried_from ?? t.task_date })
  }
  const carryAll = async () => { for (const t of carry) await carryOver(t); toast(`Moved ${carry.length} tasks to today`) }

  if (!categories) return <PageLoader />
  const open = (tasks ?? []).filter((t) => !t.done_at)
  const done = (tasks ?? []).filter((t) => t.done_at)
  const pct = tasks?.length ? Math.round((done.length / tasks.length) * 100) : 0

  return (
    <div>
      <PageHeader title="Planner" subtitle="A light to-do list to guide your day. Ticked tasks can go straight into your log."
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
              <Button type="submit" icon={<Plus className="h-4 w-4" />} disabled={!title.trim()}>Add</Button>
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
                        <button onClick={() => toggle(t)} aria-label={t.done_at ? 'Mark not done' : 'Mark done'}
                          className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition', t.done_at ? 'border-teal-500 bg-teal-500 text-white' : 'border-line hover:border-teal-400')}>
                          {t.done_at && <Check className="h-4 w-4" />}
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
          <div className="flex items-center justify-between">
            <h3 className="section-title">Unfinished</h3>
            {carry.length > 1 && <Button size="sm" variant="ghost" onClick={carryAll}>Move all</Button>}
          </div>
          <p className="text-sm text-muted">Open tasks from the last two weeks.</p>
          {carry.length ? (
            <ul className="mt-3 space-y-2">
              {carry.map((t) => (
                <li key={t.id} className="flex items-center gap-2 rounded-xl bg-canvas p-2.5">
                  <div className="min-w-0 flex-1"><p className="truncate text-sm">{t.title}</p><p className="text-xs text-muted">{prettyDate(t.task_date)}</p></div>
                  <Button size="sm" variant="secondary" onClick={() => carryOver(t)} icon={<ArrowRightLeft className="h-3.5 w-3.5" />}>Today</Button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted">All caught up. 🎉</p>}
        </Card>
      </div>
    </div>
  )
}

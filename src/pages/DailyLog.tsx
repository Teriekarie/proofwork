import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CalendarClock, Check, ClipboardList, Lock, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, Modal, PageLoader, Select } from '@/components/ui'
import { EntryCard, EntryEditor, type EditableEntry } from '@/components/EntryParts'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { organiseLog, refineItems } from '@/lib/ai'
import { BulletTextarea } from '@/components/BulletTextarea'
import { editableDays, editWindow, isWorkDay, longDate, prettyDate, shiftDays } from '@/lib/dates'
import type { DayType, Entry, EntryDraft } from '@/lib/types'
import { cn, pluralize } from '@/lib/utils'

const MOODS = ['😫', '😕', '😐', '🙂', '🤩']
const blankDraft = (category_id: string): EntryDraft => ({
  raw_text: '', refined_text: '', category_id, metric_id: null, entry_type: 'normal', status: 'done',
  quantity: null, stakeholders: [], impact_note: '', blocker_detail: '', ai_confidence: 1,
})

export default function DailyLog() {
  const { today, workDays } = useSession()
  const toast = useToast()
  const days = editableDays(today, workDays)
  const [params, setParams] = useSearchParams()
  const requested = params.get('date')
  const date = requested && editWindow(requested, today, workDays) !== 'future' && editWindow(requested, today, workDays) !== 'locked' ? requested : today
  const win = editWindow(date, today, workDays)

  const { data: categories } = useQuery(() => data.listCategories(), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: entries, loading } = useQuery(() => data.listEntries({ from: date, to: date }), [date])
  const { data: weekEntries } = useQuery(() => data.listEntries({ from: days[days.length - 1], to: today }), [today, days.length])
  const { data: log } = useQuery(() => data.getDailyLog(date), [date])
  const { data: tasks } = useQuery(() => data.listTasks({ from: date, to: date }), [date])

  const [raw, setRaw] = useState('')
  const [drafts, setDrafts] = useState<(EntryDraft & { evidence_url?: string })[] | null>(null)
  const [aiSource, setAiSource] = useState<'claude' | 'offline' | null>(null)
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<Entry | null>(null)
  const [editValue, setEditValue] = useState<EditableEntry | null>(null)

  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const metricById = useMemo(() => new Map((metrics ?? []).map((m) => [m.id, m])), [metrics])
  const extraId = categories?.find((c) => c.is_extra)?.id ?? categories?.[0]?.id ?? ''

  const doneTasksNotLogged = (tasks ?? []).filter((t) => t.done_at && !(entries ?? []).some((e) => e.raw_text === t.title))

  const [blockers, setBlockers] = useState('')
  const blockerLines = blockers.split('\n').map((l) => l.replace(/^\s*([-*•]|\d+[.)])\s*/, '').trim()).filter(Boolean)
  const hasText = !!raw.replace(/[•\s]/g, '') || blockerLines.length > 0

  const organise = async () => {
    if (!hasText || !categories || !metrics) return
    setBusy(true)
    try {
      // Each blocker is sent as its own tagged line (no heading, so a heading can't become an "item").
      const combined = [raw.trim(), ...blockerLines.map((l) => `• Blocked: ${l}`)].filter(Boolean).join('\n')
      const r = await organiseLog(combined, categories, metrics)
      // Anything typed in the blockers box is always a blocker, whatever the AI decided.
      const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
      const blockerKeys = blockerLines.map(norm)
      const value = r.value.map((d) => {
        const k = norm(d.raw_text)
        const fromBox = blockerKeys.some((b) => b && k && (b.includes(k) || k.includes(b)))
        if (!fromBox) return d
        const untag = (s: string) => s.replace(/^\s*blocked:\s*/i, '').replace(/^./, (c) => c.toUpperCase())
        const refined = untag(d.refined_text)
        return { ...d, raw_text: untag(d.raw_text), refined_text: refined, entry_type: 'blocker' as const, blocker_detail: d.blocker_detail ? untag(d.blocker_detail) : refined }
      })
      setDrafts((d) => [...(d ?? []), ...value])
      setAiSource(r.source)
      if (r.reason) toast(`Claude couldn't organise this (${r.reason}). Used the basic offline organiser instead.`, 'error')
      if (!r.value.length) toast("Couldn't find any work items in that. Try one item per line.", 'info')
    } finally { setBusy(false) }
  }

  const saveDrafts = async () => {
    if (!drafts) return
    const valid = drafts.filter((d) => d.refined_text.trim())
    setSaving(true)
    try {
      await data.addEntries(valid.map((d) => ({
        entry_date: date, category_id: d.category_id, metric_id: d.metric_id, raw_text: d.raw_text || d.refined_text,
        refined_text: d.refined_text.trim(), entry_type: d.entry_type, status: d.status, quantity: d.quantity,
        impact_note: d.impact_note, blocker_detail: d.blocker_detail, evidence_url: d.evidence_url ?? '', stakeholders: d.stakeholders,
        is_late: win === 'late', ai_confidence: d.ai_confidence,
      })))
      const typed = [raw.trim(), blockerLines.length ? `Blockers:\n${blockerLines.map((l) => `• ${l}`).join('\n')}` : ''].filter(Boolean).join('\n\n')
      if (typed) await data.saveDailyLog(date, { raw_input: [log?.raw_input, typed].filter(Boolean).join('\n\n') })
      toast(`Saved ${pluralize(valid.length, 'entry', 'entries')} to ${win === 'today' ? 'today' : prettyDate(date)}`)
      setDrafts(null); setRaw(''); setBlockers(''); setAiSource(null)
    } catch (e) { toast((e as Error).message, 'error') } finally { setSaving(false) }
  }

  // Planner tasks go into the writing box so the AI refines and files them with everything else.
  const addTaskToBox = (title: string) => {
    setRaw((r) => (r.replace(/[•\s]/g, '') ? `${r.replace(/\s*$/, '')}\n• ${title}` : `• ${title}`))
    toast('Added to the box. Click Organise with AI when you\'re ready.', 'info')
  }

  // Entries saved without AI refinement (e.g. typed manually, or added before AI was on).
  const unrefined = (entries ?? []).filter((e) => e.refined_text.trim() === e.raw_text.trim())
  const [tidying, setTidying] = useState(false)
  const tidyUp = async () => {
    if (!unrefined.length || !categories || !metrics) return
    setTidying(true)
    try {
      const r = await refineItems(unrefined.map((e) => e.raw_text), categories, metrics)
      if (r.reason) { toast(`Claude isn't available right now (${r.reason}).`, 'error'); return }
      for (const [i, d] of r.value.entries()) {
        const e = unrefined[i]
        const wasExtra = catById.get(e.category_id)?.is_extra
        await data.updateEntry(e.id, {
          refined_text: d.refined_text,
          // Keep a KPI the user chose; re-file entries sitting in Beyond Scope.
          category_id: wasExtra ? d.category_id : e.category_id,
          metric_id: wasExtra ? d.metric_id : e.metric_id,
          quantity: e.quantity ?? d.quantity,
          entry_type: e.entry_type === 'normal' ? d.entry_type : e.entry_type,
          status: d.status,
          stakeholders: e.stakeholders.length ? e.stakeholders : d.stakeholders,
          impact_note: e.impact_note || d.impact_note,
          blocker_detail: e.blocker_detail || d.blocker_detail,
        })
      }
      toast(`Tidied ${pluralize(unrefined.length, 'entry', 'entries')} with Claude`)
    } catch (err) { toast((err as Error).message, 'error') } finally { setTidying(false) }
  }

  const saveEdit = async () => {
    if (!editing || !editValue) return
    try {
      await data.updateEntry(editing.id, { ...editValue, evidence_url: editValue.evidence_url ?? '' })
      toast('Entry updated'); setEditing(null)
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const remove = async (e: Entry) => {
    if (!confirm('Delete this entry?')) return
    try { await data.deleteEntry(e.id); toast('Entry deleted') } catch (err) { toast((err as Error).message, 'error') }
  }

  const setDayType = async (day_type: DayType) => {
    try { await data.saveDailyLog(date, { day_type }) } catch (e) { toast((e as Error).message, 'error') }
  }
  const setMood = async (mood: number) => {
    try { await data.saveDailyLog(date, { mood: log?.mood === mood ? null : mood }) } catch (e) { toast((e as Error).message, 'error') }
  }

  if (!categories || !metrics) return <PageLoader />
  const isOff = log && log.day_type !== 'work'

  return (
    <div>
      <PageHeader title="Daily Log" subtitle={longDate(date)}
        actions={<Link to="/history"><Button variant="outline" size="sm" icon={<CalendarClock className="h-4 w-4" />}>Older days</Button></Link>} />

      {/* Day switcher: every day that can still be logged, today first */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {days.map((d) => {
          const n = weekEntries?.filter((e) => e.entry_date === d).length ?? 0
          const off = !isWorkDay(d, workDays)
          const label = d === today ? 'Today' : d === shiftDays(today, -1) ? 'Yesterday' : prettyDate(d, 'EEEE')
          return (
            <button key={d} onClick={() => { setParams(d === today ? {} : { date: d }); setDrafts(null) }}
              className={cn('min-w-[104px] rounded-xl border px-4 py-2 text-left transition',
                date === d ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10' : 'border-line bg-surface hover:border-teal-300', off && date !== d && 'opacity-60')}>
              <span className="block text-sm font-semibold">{label}</span>
              <span className="flex items-center justify-between gap-2 text-xs text-muted">
                {prettyDate(d, 'EEE d MMM')}
                <span className={cn('tabular-nums', n ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-muted/70')}>{n || '–'}</span>
              </span>
            </button>
          )
        })}
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" />Earlier weeks are read-only</span>
      </div>

      {win === 'late' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          You're filling in <b>{prettyDate(date, 'EEEE d MMM')}</b>. Entries will be marked as late so your record stays honest.
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Composer */}
          <Card className="p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="section-title">What did you work on{win === 'today' ? ' today' : ''}?</h2>
              <Select value={log?.day_type ?? 'work'} onChange={(e) => setDayType(e.target.value as DayType)} className="w-auto py-1.5 text-sm" aria-label="Day type">
                <option value="work">Work day</option><option value="leave">On leave</option><option value="holiday">Public holiday</option><option value="sick">Sick day</option>
              </Select>
            </div>
            {isOff ? (
              <p className="mt-4 rounded-xl bg-canvas p-4 text-sm text-muted">This day is marked as <b className="text-ink">{log!.day_type === 'holiday' ? 'a public holiday' : log!.day_type === 'sick' ? 'a sick day' : 'leave'}</b>. It won't count against your streak or activity. Switch back to "Work day" to log work.</p>
            ) : (
              <>
                <BulletTextarea value={raw} onValue={setRaw} onSubmit={organise} rows={6} className="mt-4 text-[15px]" aria-label="What you worked on"
                  placeholder={'Start typing. Each Enter starts a new item, e.g.\n\n• did an automation for licensing certification reminders\n• review call with HR on their intranet design page\n• stayed late to fix the Q3 dashboard for leadership'} />
                <div className="mt-3">
                  <label htmlFor="blockers" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium">
                    <AlertTriangle className="h-4 w-4 text-red-500" />Anything blocking you? <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <BulletTextarea id="blockers" value={blockers} onValue={setBlockers} onSubmit={organise} rows={2} className="min-h-[64px] text-[15px]"
                    placeholder="• still waiting on IT for database access" />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-muted">Enter = new item · Shift + Enter = new line · Ctrl + Enter = organise</p>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setDrafts((d) => [...(d ?? []), blankDraft(extraId)])}>Add manually</Button>
                    <Button variant="accent" size="sm" loading={busy} disabled={!hasText} onClick={organise} icon={<Wand2 className="h-4 w-4" />}>Organise with AI</Button>
                  </div>
                </div>
              </>
            )}
          </Card>

          {/* Review drafts */}
          <AnimatePresence>
            {drafts && drafts.length > 0 && (
              <motion.div initial={{ y: 10 }} animate={{ y: 0 }} exit={{ opacity: 0, y: 10 }}>
                <Card className="border-teal-200 p-5 dark:border-teal-500/30">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2 className="section-title flex items-center gap-2"><Sparkles className="h-4 w-4 text-teal-500" />Review {pluralize(drafts.length, 'entry', 'entries')}</h2>
                      <p className="text-sm text-muted">Check the wording and KPI for each one, then save.{aiSource === 'offline' && ' (Basic offline organiser. Claude wasn\'t available for this one.)'}{aiSource === 'claude' && ' Organised by Claude.'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {drafts.map((d, i) => (
                      <motion.div key={i} layout className="relative rounded-xl border border-line/70 bg-canvas/60 p-4">
                        <button onClick={() => setDrafts(drafts.filter((_, j) => j !== i))} className="absolute right-2 top-2 rounded-lg p-1.5 text-muted hover:text-red-600" aria-label="Remove draft"><Trash2 className="h-4 w-4" /></button>
                        {d.raw_text && d.raw_text !== d.refined_text && <p className="mb-2 pr-8 text-xs text-muted">From: "{d.raw_text}"</p>}
                        <EntryEditor compact value={d} categories={categories} metrics={metrics}
                          onChange={(p) => setDrafts(drafts.map((x, j) => (j === i ? { ...x, ...p } : x)))} />
                        {catById.get(d.category_id)?.is_extra && <p className="mt-2 text-xs text-muted">✦ Didn't match a KPI, so it's filed under Beyond Scope. Change the category if it fits one.</p>}
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => setDrafts(null)}>Discard</Button>
                    <Button variant="accent" loading={saving} onClick={saveDrafts} icon={<Check className="h-4 w-4" />}>Save to log</Button>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Saved */}
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="section-title">Logged for {win === 'today' ? 'today' : prettyDate(date)} <span className="font-normal text-muted">· {entries?.length ?? 0}</span></h2>
              {unrefined.length > 0 && (
                <Button size="sm" variant="secondary" loading={tidying} onClick={tidyUp} icon={<Sparkles className="h-4 w-4" />}
                  title="Rewrite raw entries professionally and file them under the right KPI">
                  Tidy up {unrefined.length} with AI
                </Button>
              )}
            </div>
            {loading && !entries ? <PageLoader /> : entries && entries.length ? (
              <div className="mt-4 space-y-2.5">
                {entries.map((e) => (
                  <EntryCard key={e.id} entry={e} category={catById.get(e.category_id)} metric={e.metric_id ? metricById.get(e.metric_id) : undefined}
                    onEdit={() => { setEditing(e); setEditValue({ ...e }) }} onDelete={() => remove(e)} />
                ))}
              </div>
            ) : (
              <EmptyState icon={<ClipboardList className="h-6 w-6" />} title="Nothing logged yet" body={win === 'today' ? 'Start with today. Even three items make a great standup.' : 'Fill in what you did on this day.'} />
            )}
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-5">
          <Card className="p-5">
            <h3 className="section-title">How was the day?</h3>
            <p className="text-sm text-muted">Optional. Helps spot patterns over time.</p>
            <div className="mt-3 flex justify-between">
              {MOODS.map((m, i) => (
                <button key={m} onClick={() => setMood(i + 1)} aria-label={`Mood ${i + 1}`}
                  className={cn('flex h-11 w-11 items-center justify-center rounded-xl text-2xl transition', log?.mood === i + 1 ? 'scale-110 bg-teal-50 ring-2 ring-teal-500 dark:bg-teal-500/10' : 'opacity-60 hover:opacity-100')}>{m}</button>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="section-title">From your planner</h3>
              <Link to="/planner" className="text-sm font-medium text-teal-600">Planner</Link>
            </div>
            {doneTasksNotLogged.length ? (
              <ul className="mt-3 space-y-2">
                {doneTasksNotLogged.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-canvas p-2.5 text-sm">
                    <span className="min-w-0 truncate">{t.title}</span>
                    <Button size="sm" variant="secondary" onClick={() => addTaskToBox(t.title)} icon={<Plus className="h-3.5 w-3.5" />}>Log</Button>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-2 text-sm text-muted">Tasks you tick off in the planner show up here so you can log them in one tap.</p>}
          </Card>

          <Card className="p-5">
            <h3 className="section-title">Your KPIs</h3>
            <ul className="mt-3 space-y-2">
              {categories.map((c) => {
                const n = entries?.filter((e) => e.category_id === c.id).length ?? 0
                return (
                  <li key={c.id} className="flex items-center gap-2.5 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className={cn('tabular-nums', n ? 'font-semibold text-ink' : 'text-muted')}>{n}</span>
                  </li>
                )
              })}
            </ul>
          </Card>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit entry" wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save changes</Button></>}>
        {editValue && <EntryEditor value={editValue} onChange={(p) => setEditValue({ ...editValue, ...p })} categories={categories} metrics={metrics} />}
      </Modal>
    </div>
  )
}

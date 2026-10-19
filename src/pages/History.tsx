import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Copy, Download, FileText, Printer, Search, SearchX } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, Input, PageLoader, Segmented, Select } from '@/components/ui'
import { EntryCard } from '@/components/EntryParts'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { editWindow, longDate, periodLabel, periodRange, prettyDate, shiftDays, shiftPeriod } from '@/lib/dates'
import type { Entry, EntryType, PeriodType } from '@/lib/types'
import { copyText, download } from '@/lib/utils'

type View = 'day' | PeriodType

export default function HistoryPage() {
  const { today, workDays } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [view, setView] = useState<View>((params.get('view') as View) || 'week')
  const [anchor, setAnchor] = useState(params.get('date') || today)
  const [q, setQ] = useState('')
  const [type, setType] = useState<EntryType | ''>('')
  const category = params.get('category') ?? ''

  const range = view === 'day' ? { start: anchor, end: anchor } : periodRange(view, anchor)
  const label = view === 'day' ? longDate(anchor) : periodLabel(view, range.start, range.end)

  const { data: categories } = useQuery(() => data.listCategories(true), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: entries, loading } = useQuery(() => data.listEntries({ from: range.start, to: range.end }), [range.start, range.end])

  const catById = useMemo(() => new Map((categories ?? []).map((c) => [c.id, c])), [categories])
  const filtered = useMemo(() => (entries ?? []).filter((e) => {
    if (category && e.category_id !== category) return false
    if (type && e.entry_type !== type) return false
    if (q) {
      const hay = `${e.refined_text} ${e.raw_text} ${e.stakeholders.join(' ')} ${e.impact_note} ${e.blocker_detail} ${catById.get(e.category_id)?.name ?? ''}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return true
  }), [entries, category, type, q, catById])

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>()
    filtered.forEach((e) => m.set(e.entry_date, [...(m.get(e.entry_date) ?? []), e]))
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  const nextStart = view === 'day' ? shiftDays(anchor, 1) : periodRange(view, shiftPeriod(view, anchor, 1)).start
  const canForward = nextStart <= today
  const move = (dir: 1 | -1) => {
    if (dir === 1 && !canForward) return
    const next = view === 'day' ? shiftDays(anchor, dir) : shiftPeriod(view, anchor, dir)
    setAnchor(next > today ? today : next)
  }

  const asText = () => [label, '', ...byDay.flatMap(([d, es]) => [prettyDate(d, 'EEEE d MMM yyyy'), ...es.map((e) => `• [${catById.get(e.category_id)?.name ?? ''}] ${e.refined_text}${e.entry_type === 'above_beyond' ? ' (above & beyond)' : e.entry_type === 'blocker' ? ' (blocker)' : ''}`), ''])].join('\n')

  const exportCsv = () => {
    const esc = (s: string | number | null) => `"${String(s ?? '').replace(/"/g, '""')}"`
    const rows = [['Date', 'KPI', 'Entry', 'Type', 'Status', 'Quantity', 'Stakeholders', 'Impact', 'Blocker', 'Evidence', 'Late'].map(esc).join(',')]
    filtered.forEach((e) => rows.push([e.entry_date, catById.get(e.category_id)?.name ?? '', e.refined_text, e.entry_type, e.status, e.quantity, e.stakeholders.join('; '), e.impact_note, e.blocker_detail, e.evidence_url, e.is_late ? 'yes' : ''].map(esc).join(',')))
    download(`proofwork-${range.start}-to-${range.end}.csv`, '﻿' + rows.join('\r\n'), 'text/csv;charset=utf-8')
  }

  if (!categories || !metrics) return <PageLoader />

  const above = filtered.filter((e) => e.entry_type === 'above_beyond').length
  const blockers = filtered.filter((e) => e.entry_type === 'blocker').length

  return (
    <div>
      <PageHeader title="Work History" subtitle="Everything you've logged. Filter, search, export."
        actions={<>
          <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => toast((await copyText(asText())) ? 'Copied to clipboard' : 'Copy failed', 'success')} disabled={!filtered.length}>Copy</Button>
          <Button variant="outline" size="sm" icon={<Download className="h-4 w-4" />} onClick={exportCsv} disabled={!filtered.length}>CSV</Button>
          <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()} disabled={!filtered.length}>PDF</Button>
          {view !== 'day' && <Button size="sm" icon={<FileText className="h-4 w-4" />} onClick={() => navigate(`/reports?type=${view}&date=${anchor}`)}>Build report</Button>}
        </>} />

      <Card className="no-print p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented<View> value={view} onChange={(v) => { setView(v); setParams((p) => { p.set('view', v); return p }) }} className="overflow-x-auto"
            options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }, { value: 'quarter', label: 'Quarter' }, { value: 'year', label: 'Year' }]} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => move(-1)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></Button>
            {view === 'day' ? (
              <Input type="date" value={anchor} max={today} onChange={(e) => e.target.value && setAnchor(e.target.value)} className="w-auto py-1.5 text-sm" aria-label="Pick a day" />
            ) : <span className="min-w-[180px] text-center text-sm font-semibold">{label}</span>}
            <Button variant="outline" size="sm" onClick={() => move(1)} disabled={!canForward} aria-label="Next"><ChevronRight className="h-4 w-4" /></Button>
            {anchor !== today && <Button variant="ghost" size="sm" onClick={() => setAnchor(today)}>Today</Button>}
          </div>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_200px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: HR, dashboard, intranet…" className="pl-9" aria-label="Search entries" />
          </div>
          <Select value={category} onChange={(e) => setParams((p) => { if (e.target.value) { p.set('category', e.target.value) } else { p.delete('category') } return p })} aria-label="Filter by KPI">
            <option value="">All KPIs</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}{c.archived_at ? ' (archived)' : ''}</option>)}
          </Select>
          <Select value={type} onChange={(e) => setType(e.target.value as EntryType | '')} aria-label="Filter by type">
            <option value="">All types</option><option value="normal">Normal</option><option value="above_beyond">Above & beyond</option><option value="blocker">Blockers</option>
          </Select>
        </div>
      </Card>

      <div className="printable mt-5">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold">{label}</h2>
          <p className="text-sm text-muted">{filtered.length} entries · {byDay.length} days · {above} above & beyond · {blockers} blockers</p>
        </div>
        {loading && !entries ? <PageLoader /> : byDay.length === 0 ? (
          <Card><EmptyState icon={<SearchX className="h-6 w-6" />} title="Nothing here"
            body={q || category || type ? 'No entries match these filters.' : 'No work was logged in this period.'}
            action={editWindow(view === 'day' ? anchor : today, today, workDays) !== 'locked' ? <Link to="/log"><Button variant="accent">Go to Daily Log</Button></Link> : undefined} /></Card>
        ) : (
          <div className="space-y-6">
            {byDay.map(([d, es]) => (
              <section key={d}>
                <div className="sticky top-[57px] z-10 -mx-1 mb-2 flex items-center justify-between bg-canvas/90 px-1 py-1.5 backdrop-blur lg:top-0">
                  <h3 className="text-sm font-bold">{prettyDate(d, 'EEEE d MMMM')}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted">
                    {es.length} {es.length === 1 ? 'entry' : 'entries'}
                    {editWindow(d, today, workDays) !== 'locked' && <Link to={d === today ? '/log' : `/log?date=${d}`} className="no-print font-medium text-teal-600">Edit</Link>}
                  </div>
                </div>
                <div className="space-y-2">
                  {es.map((e) => <EntryCard key={e.id} entry={e} category={catById.get(e.category_id)} metric={metrics.find((m) => m.id === e.metric_id)} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

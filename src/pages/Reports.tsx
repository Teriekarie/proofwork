import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Copy, FileDown, FileText, Link2, Pencil, Printer, RefreshCw, Share2, Sparkles, Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, EmptyState, Field, Modal, PageLoader, Segmented, Select, Textarea } from '@/components/ui'
import { ReportDocument, reportToWordHtml } from '@/components/ReportDocument'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { buildReportContent, reportToText } from '@/lib/compose'
import { polishReport } from '@/lib/ai'
import { periodLabel, periodRange, prettyDate, shiftPeriod } from '@/lib/dates'
import type { PeriodType, Report } from '@/lib/types'
import { copyText, download } from '@/lib/utils'
import { isDemo } from '@/lib/repo'

const KIND: Record<PeriodType, string> = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Annual' }

export async function generateReport(type: PeriodType, anchor: string, ctx: { name: string; jobTitle: string; workDays: number[] }, existingId?: string) {
  const { start, end } = periodRange(type, anchor)
  const [entries, logs, categories, metrics] = await Promise.all([
    data.listEntries({ from: start, to: end }), data.listDailyLogs({ from: start, to: end }), data.listCategories(true), data.listMetrics(),
  ])
  const content = buildReportContent({ periodType: type, start, end, entries, logs, categories, metrics, workDays: ctx.workDays })
  const label = periodLabel(type, start, end)
  const polished = await polishReport(content, { name: ctx.name, jobTitle: ctx.jobTitle, periodLabel: label })
  return data.saveReport({ id: existingId, period_type: type, period_start: start, period_end: end, title: `${KIND[type]} report · ${label}`, content: polished.value })
}

export default function Reports() {
  const { id } = useParams()
  return id ? <ReportView id={id} /> : <ReportList />
}

function ReportList() {
  const { today, profile, workDays } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [type, setType] = useState<PeriodType>((params.get('type') as PeriodType) || 'month')
  const [anchor, setAnchor] = useState(params.get('date') || today)
  const [busy, setBusy] = useState(false)
  const { data: reports } = useQuery(() => data.listReports(), [])
  const r = periodRange(type, anchor)
  const nextStart = periodRange(type, shiftPeriod(type, anchor, 1)).start

  const go = async () => {
    setBusy(true)
    try {
      const rep = await generateReport(type, anchor, { name: profile?.full_name ?? '', jobTitle: profile?.job_title ?? '', workDays })
      navigate(`/reports/${rep.id}`)
    } catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }

  return (
    <div>
      <PageHeader title="Reports" subtitle="Turn your log into a professional summary for your manager, appraisal or CV." />
      <Card className="p-5 sm:p-6">
        <h2 className="section-title">Create a report</h2>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Segmented<PeriodType> value={type} onChange={(t) => { setType(t); setAnchor(today) }}
            options={[{ value: 'week', label: 'Weekly' }, { value: 'month', label: 'Monthly' }, { value: 'quarter', label: 'Quarterly' }, { value: 'year', label: 'Yearly' }]} />
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setAnchor(shiftPeriod(type, anchor, -1))} aria-label="Previous period"><ChevronLeft className="h-4 w-4" /></Button>
            <span className="min-w-[190px] text-center text-sm font-semibold">{periodLabel(type, r.start, r.end)}</span>
            <Button variant="outline" size="sm" disabled={nextStart > today} onClick={() => { const n = shiftPeriod(type, anchor, 1); setAnchor(n > today ? today : n) }} aria-label="Next period"><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button variant="accent" loading={busy} onClick={go} icon={<Sparkles className="h-4 w-4" />}>Generate report</Button>
        </div>
        <p className="mt-4 text-sm text-muted">Includes a summary, key achievements, work grouped by KPI with metrics, above-and-beyond moments, blockers and next focus. You can edit it before sharing.</p>
      </Card>

      <h2 className="section-title mb-3 mt-8">Saved reports</h2>
      {!reports ? <PageLoader /> : reports.length === 0 ? (
        <Card><EmptyState icon={<FileText className="h-6 w-6" />} title="No reports yet" body="Generate your first one above. Monthly reports are a great habit." /></Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((rep) => (
            <Link key={rep.id} to={`/reports/${rep.id}`} className="card p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-600">{KIND[rep.period_type]}</p>
              <p className="mt-1 font-semibold">{periodLabel(rep.period_type, rep.period_start, rep.period_end)}</p>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{rep.content.summary}</p>
              <p className="mt-3 text-xs text-muted">{rep.content.stats.entries} entries · updated {prettyDate(rep.updated_at.slice(0, 10))}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function ReportView({ id }: { id: string }) {
  const { profile, workDays } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const { data: report, loading } = useQuery(() => data.getReport(id), [id])
  const { data: categories } = useQuery(() => data.listCategories(true), [])
  const [editing, setEditing] = useState<Report | null>(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading && !report) return <PageLoader />
  if (!report) return <EmptyState title="Report not found" action={<Link to="/reports"><Button>Back to reports</Button></Link>} />

  const owner = { full_name: profile?.full_name ?? '', job_title: profile?.job_title ?? '', company: profile?.company ?? '' }
  const colorFor = (cid: string) => categories?.find((c) => c.id === cid)?.color ?? '#1D9E75'
  const fileBase = `${owner.full_name || 'proofwork'} ${report.title}`.replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')

  const regenerate = async () => {
    if (!confirm('Regenerate from your latest log? Manual edits to this report will be replaced.')) return
    setBusy(true)
    try { await generateReport(report.period_type, report.period_start, { name: owner.full_name, jobTitle: owner.job_title, workDays }, report.id); toast('Report refreshed') }
    catch (e) { toast((e as Error).message, 'error') } finally { setBusy(false) }
  }
  const saveEdit = async () => {
    if (!editing) return
    const clean = (xs: string[]) => xs.map((x) => x.trim()).filter(Boolean)
    await data.saveReport({ ...editing, content: { ...editing.content, highlights: clean(editing.content.highlights), next_focus: clean(editing.content.next_focus) } })
    setEditing(null); toast('Report saved')
  }
  const remove = async () => {
    if (!confirm('Delete this report? Share links will stop working.')) return
    await data.deleteReport(report.id); navigate('/reports')
  }

  return (
    <div>
      <div className="no-print mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link to="/reports" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All reports</Link>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" icon={<Pencil className="h-4 w-4" />} onClick={() => setEditing(structuredClone(report))}>Edit</Button>
          <Button variant="outline" size="sm" icon={<RefreshCw className="h-4 w-4" />} loading={busy} onClick={regenerate}>Refresh</Button>
          <Button variant="outline" size="sm" icon={<Copy className="h-4 w-4" />} onClick={async () => toast((await copyText(reportToText(report.title, owner.full_name, report.content))) ? 'Copied as text' : 'Copy failed')}>Copy</Button>
          <Button variant="outline" size="sm" icon={<FileDown className="h-4 w-4" />} onClick={() => download(`${fileBase}.doc`, reportToWordHtml(report, owner), 'application/msword')}>Word</Button>
          <Button variant="outline" size="sm" icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>PDF</Button>
          <Button variant="accent" size="sm" icon={<Share2 className="h-4 w-4" />} onClick={() => setShareOpen(true)}>Share</Button>
          <Button variant="ghost" size="sm" className="text-red-600" onClick={remove} aria-label="Delete report"><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <ReportDocument report={report} owner={owner} colorFor={colorFor} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit report" wide
        footer={<><Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={saveEdit}>Save</Button></>}>
        {editing && (
          <div className="space-y-4">
            <Field label="Summary"><Textarea rows={5} value={editing.content.summary} onChange={(e) => setEditing({ ...editing, content: { ...editing.content, summary: e.target.value } })} /></Field>
            <Field label="Key achievements" hint="One per line"><Textarea rows={6} value={editing.content.highlights.join('\n')} onChange={(e) => setEditing({ ...editing, content: { ...editing.content, highlights: e.target.value.split('\n') } })} /></Field>
            <Field label="Next focus" hint="One per line"><Textarea rows={4} value={editing.content.next_focus.join('\n')} onChange={(e) => setEditing({ ...editing, content: { ...editing.content, next_focus: e.target.value.split('\n') } })} /></Field>
          </div>
        )}
      </Modal>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} reportId={report.id} />
    </div>
  )
}

function ShareModal({ open, onClose, reportId }: { open: boolean; onClose: () => void; reportId: string }) {
  const toast = useToast()
  const [days, setDays] = useState('30')
  const { data: shares } = useQuery(() => (open ? data.listShares(reportId) : Promise.resolve([])), [open, reportId])
  const active = (shares ?? []).filter((s) => !s.revoked_at && (!s.expires_at || s.expires_at > new Date().toISOString()))
  const url = (token: string) => `${window.location.origin}/share/${token}`

  const create = async () => {
    const s = await data.createShare(reportId, days === 'never' ? null : Number(days))
    const ok = await copyText(url(s.token))
    toast(ok ? 'Link created and copied' : 'Link created')
  }

  return (
    <Modal open={open} onClose={onClose} title="Share with your manager">
      <p className="text-sm text-muted">Anyone with the link can view this report, read-only. They won't see the rest of your log. You can revoke a link at any time.</p>
      {isDemo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">Demo mode: links only open in this browser. Once Supabase is connected they work for anyone.</p>}
      <div className="mt-4 flex gap-2">
        <Select value={days} onChange={(e) => setDays(e.target.value)} className="flex-1" aria-label="Link expiry">
          <option value="7">Expires in 7 days</option><option value="30">Expires in 30 days</option><option value="90">Expires in 90 days</option><option value="never">Never expires</option>
        </Select>
        <Button variant="accent" onClick={create} icon={<Link2 className="h-4 w-4" />}>Create link</Button>
      </div>
      {active.length > 0 && (
        <ul className="mt-5 space-y-2">
          {active.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-xl bg-canvas p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-mono text-xs">{url(s.token)}</p>
                <p className="text-xs text-muted">{s.expires_at ? `Expires ${prettyDate(s.expires_at.slice(0, 10), 'd MMM yyyy')}` : 'No expiry'}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={async () => toast((await copyText(url(s.token))) ? 'Copied' : 'Copy failed')} aria-label="Copy link"><Copy className="h-4 w-4" /></Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => data.revokeShare(s.id)}>Revoke</Button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}

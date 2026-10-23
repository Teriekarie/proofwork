import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Archive, Lightbulb, Pencil, Plus, Sparkles, Target } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, Field, Input, Modal, PageLoader, Select, Textarea } from '@/components/ui'
import { KpiDraftEditor } from '@/components/KpiDraftEditor'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { generateKpis, refineItems } from '@/lib/ai'
import { periodRange } from '@/lib/dates'
import { suggestKpisFromExtras } from '@/lib/compose'
import type { KpiCategory, KpiDraft, KpiMetric, MetricPeriod } from '@/lib/types'
import { CATEGORY_COLORS } from '@/lib/utils'

type MetricDraft = Partial<KpiMetric> & { name: string; _delete?: boolean }

export default function Kpis() {
  const { today, profile } = useSession()
  const toast = useToast()
  const { data: categories } = useQuery(() => data.listCategories(), [])
  const { data: metrics } = useQuery(() => data.listMetrics(), [])
  const { data: entries } = useQuery(() => data.listEntries(), [])
  const [edit, setEdit] = useState<{ cat: Partial<KpiCategory> & { name: string }; metrics: MetricDraft[] } | null>(null)
  const [regen, setRegen] = useState<KpiDraft[] | null>(null)
  const [regenBusy, setRegenBusy] = useState(false)
  const [refiling, setRefiling] = useState(false)

  if (!categories || !metrics || !entries) return <PageLoader />
  const month = periodRange('month', today)
  const extra = categories.find((c) => c.is_extra)
  // Entries whose KPI was archived (e.g. after regenerating KPIs) no longer count towards any current KPI.
  const activeIds = new Set(categories.map((c) => c.id))
  const orphaned = entries.filter((e) => !activeIds.has(e.category_id))

  // Re-file orphaned entries under the current KPIs with the AI. Only the KPI, metric and count change; the wording stays.
  const refile = async () => {
    setRefiling(true)
    try {
      let moved = 0
      for (let i = 0; i < orphaned.length; i += 15) {
        const chunk = orphaned.slice(i, i + 15)
        const r = await refineItems(chunk.map((e) => e.refined_text || e.raw_text), categories, metrics)
        if (r.reason) { toast(`Claude isn't available right now (${r.reason}).`, 'error'); break }
        for (const [j, d] of r.value.entries()) {
          await data.updateEntry(chunk[j].id, { category_id: d.category_id, metric_id: d.metric_id, quantity: chunk[j].quantity ?? d.quantity })
          moved++
        }
      }
      if (moved) toast(`Re-filed ${moved} ${moved === 1 ? 'entry' : 'entries'} under your current KPIs`)
    } catch (e) { toast((e as Error).message, 'error') } finally { setRefiling(false) }
  }
  const suggestions = suggestKpisFromExtras(entries, extra?.id)

  const openEdit = (c?: KpiCategory, preset?: string) => setEdit({
    cat: c ? { ...c } : { name: preset ?? '', description: '' },
    metrics: c ? metrics.filter((m) => m.category_id === c.id).map((m) => ({ ...m })) : [],
  })

  const save = async () => {
    if (!edit || !edit.cat.name.trim()) return
    try {
      const cat = await data.saveCategory({ ...edit.cat, name: edit.cat.name.trim() })
      for (const m of edit.metrics) {
        if (m._delete) { if (m.id) await data.deleteMetric(m.id); continue }
        if (!m.name.trim()) continue
        const { _delete: _d, ...rest } = m
        await data.saveMetric({ ...rest, name: m.name.trim(), category_id: cat.id })
      }
      setEdit(null); toast('KPI saved')
    } catch (e) { toast((e as Error).message, 'error') }
  }

  const archive = async (c: KpiCategory) => {
    if (!confirm(`Archive "${c.name}"? Past entries stay in your history and reports.`)) return
    await data.archiveCategory(c.id); toast('KPI archived')
  }

  const startRegen = async () => {
    setRegenBusy(true)
    try {
      const jd = await data.getCurrentJd()
      if (!jd) { toast('Add your job description in Profile first.', 'info'); return }
      const r = await generateKpis(jd.jd_text, profile?.job_title ?? '')
      if (r.reason) toast(`Claude couldn't generate KPIs (${r.reason}). Showing basic suggestions instead.`, 'error')
      setRegen(r.value)
    } finally { setRegenBusy(false) }
  }
  const applyRegen = async () => {
    if (!regen) return
    await data.applyKpiDrafts(regen.filter((d) => d.name.trim()).map((d) => ({ ...d, metrics: d.metrics.filter((m) => m.name.trim()) })))
    setRegen(null); toast('KPIs replaced. Old ones are archived with their entries.')
  }

  return (
    <div>
      <PageHeader title="KPIs" subtitle="Your categories and metrics. Entries are filed against these."
        actions={<>
          <Button variant="outline" size="sm" icon={<Sparkles className="h-4 w-4" />} loading={regenBusy} onClick={startRegen}>Regenerate from JD</Button>
          <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => openEdit()}>Add KPI</Button>
        </>} />

      {orphaned.length > 0 && (
        <Card className="mb-5 flex flex-col gap-3 border-amber-200 bg-amber-50/60 p-5 dark:border-amber-500/30 dark:bg-amber-500/5 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h2 className="flex items-center gap-2 font-semibold"><Archive className="h-5 w-5 text-amber-600" />{orphaned.length} {orphaned.length === 1 ? 'entry is' : 'entries are'} filed under old KPIs</h2>
            <p className="mt-1 text-sm text-muted">They were logged before you regenerated your KPIs, so they don't count towards any current KPI on your dashboard or reports. Re-file them and Claude will match each one to your current KPIs. The wording stays the same.</p>
          </div>
          <Button variant="accent" loading={refiling} onClick={refile} icon={<Sparkles className="h-4 w-4" />}>Re-file with AI</Button>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="mb-5 border-teal-200 bg-teal-50/50 p-5 dark:border-teal-500/30 dark:bg-teal-500/5">
          <h2 className="flex items-center gap-2 font-semibold"><Lightbulb className="h-5 w-5 text-teal-500" />Your role might be growing</h2>
          <p className="mt-1 text-sm text-muted">These themes keep showing up in Beyond Scope. Make one a KPI so it's tracked properly.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button key={s.theme} size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openEdit(undefined, s.theme)}>{s.theme} · {s.count} entries</Button>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {categories.map((c) => {
          const es = entries.filter((e) => e.category_id === c.id)
          const thisMonth = es.filter((e) => e.entry_date >= month.start).length
          const ms = metrics.filter((m) => m.category_id === c.id)
          return (
            <Card key={c.id} className="overflow-hidden">
              <div className="flex">
                <span className="w-1.5 shrink-0" style={{ background: c.color }} />
                <div className="flex-1 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{c.is_extra ? '✦ ' : ''}{c.name}</h3>
                      <p className="mt-1 text-sm text-muted">{c.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-0.5">
                      <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label={`Edit ${c.name}`}><Pencil className="h-4 w-4" /></button>
                      {!c.is_extra && <button onClick={() => archive(c)} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label={`Archive ${c.name}`}><Archive className="h-4 w-4" /></button>}
                    </div>
                  </div>
                  {ms.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {ms.map((m) => (
                        <li key={m.id} className="flex items-center gap-2 text-sm">
                          <Target className="h-3.5 w-3.5 text-muted" />{m.name}
                          {m.target_value != null && <span className="text-muted">· target {m.target_value} {m.unit} / {m.period}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-4 flex items-center gap-4 border-t border-line/70 pt-3 text-sm">
                    <span><b className="tabular-nums">{thisMonth}</b> <span className="text-muted">this month</span></span>
                    <span><b className="tabular-nums">{es.length}</b> <span className="text-muted">all time</span></span>
                    <Link to={`/history?category=${c.id}&view=month`} className="ml-auto font-medium text-teal-600">View entries</Link>
                  </div>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.cat.id ? 'Edit KPI' : 'New KPI'} wide
        footer={<><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} disabled={!edit?.cat.name.trim()}>Save KPI</Button></>}>
        {edit && (
          <div className="space-y-4">
            <Field label="Category name"><Input value={edit.cat.name} onChange={(e) => setEdit({ ...edit, cat: { ...edit.cat, name: e.target.value } })} disabled={edit.cat.is_extra} /></Field>
            <Field label="Description"><Textarea rows={3} value={edit.cat.description ?? ''} onChange={(e) => setEdit({ ...edit, cat: { ...edit.cat, description: e.target.value } })} /></Field>
            {!edit.cat.is_extra && (
              <div>
                <p className="label">Colour</p>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((col) => (
                    <button key={col} type="button" onClick={() => setEdit({ ...edit, cat: { ...edit.cat, color: col } })} aria-label={`Colour ${col}`}
                      className="h-8 w-8 rounded-full ring-offset-2 ring-offset-surface transition" style={{ background: col, boxShadow: edit.cat.color === col ? `0 0 0 2px rgb(var(--surface)), 0 0 0 4px ${col}` : undefined }} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="label">Metrics</p>
              <div className="space-y-2">
                {edit.metrics.map((m, i) => !m._delete && (
                  <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_80px_100px_120px_auto]">
                    <Input className="col-span-2 py-2 text-sm sm:col-span-1" value={m.name} placeholder="Metric name" onChange={(e) => setEdit({ ...edit, metrics: edit.metrics.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} aria-label="Metric name" />
                    <Input className="py-2 text-sm" type="number" min={0} value={m.target_value ?? ''} placeholder="Target" onChange={(e) => setEdit({ ...edit, metrics: edit.metrics.map((x, j) => (j === i ? { ...x, target_value: e.target.value === '' ? null : Number(e.target.value) } : x)) })} aria-label="Target" />
                    <Input className="py-2 text-sm" value={m.unit ?? ''} placeholder="unit" onChange={(e) => setEdit({ ...edit, metrics: edit.metrics.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} aria-label="Unit" />
                    <Select className="py-2 text-sm" value={m.period ?? 'month'} onChange={(e) => setEdit({ ...edit, metrics: edit.metrics.map((x, j) => (j === i ? { ...x, period: e.target.value as MetricPeriod } : x)) })} aria-label="Period">
                      <option value="week">per week</option><option value="month">per month</option><option value="quarter">per quarter</option>
                    </Select>
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setEdit({ ...edit, metrics: edit.metrics.map((x, j) => (j === i ? { ...x, _delete: true } : x)) })}>Remove</Button>
                  </div>
                ))}
              </div>
              <button className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-600" onClick={() => setEdit({ ...edit, metrics: [...edit.metrics, { name: '', target_value: null, unit: '', period: 'month' }] })}>
                <Plus className="h-4 w-4" />Add metric
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!regen} onClose={() => setRegen(null)} title="Regenerate KPIs from your JD" wide
        footer={<><Button variant="ghost" onClick={() => setRegen(null)}>Cancel</Button><Button variant="accent" onClick={applyRegen}>Replace my KPIs</Button></>}>
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">Your current KPIs will be archived, not deleted. Past entries keep their categories in history and reports.</p>
        {regen && <KpiDraftEditor drafts={regen} onChange={setRegen} />}
      </Modal>
    </div>
  )
}

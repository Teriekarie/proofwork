import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Trash2 } from 'lucide-react'
import type { KpiDraft, MetricPeriod } from '@/lib/types'
import { CATEGORY_COLORS } from '@/lib/utils'
import { Button, Input, Select, Textarea } from './ui'

export function KpiDraftEditor({ drafts, onChange }: { drafts: KpiDraft[]; onChange: (d: KpiDraft[]) => void }) {
  const update = (i: number, patch: Partial<KpiDraft>) => onChange(drafts.map((d, j) => (j === i ? { ...d, ...patch } : d)))
  const updateMetric = (i: number, mi: number, patch: Partial<KpiDraft['metrics'][number]>) =>
    update(i, { metrics: drafts[i].metrics.map((m, j) => (j === mi ? { ...m, ...patch } : m)) })

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {drafts.map((d, i) => (
          <motion.div key={i} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="card overflow-hidden">
            <div className="flex">
              <span className="w-1.5 shrink-0" style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }} />
              <div className="flex-1 space-y-3 p-4">
                <div className="flex items-start gap-2">
                  <Input value={d.name} onChange={(e) => update(i, { name: e.target.value })} className="font-semibold" aria-label="KPI category name" placeholder="KPI category" />
                  <Button variant="ghost" size="sm" className="mt-1 shrink-0 text-red-600" onClick={() => onChange(drafts.filter((_, j) => j !== i))} aria-label="Remove KPI">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea value={d.description} onChange={(e) => update(i, { description: e.target.value })} className="min-h-[64px] text-sm" aria-label="Description" placeholder="What does success look like?" />
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Metrics (optional)</p>
                  <div className="space-y-2">
                    {d.metrics.map((m, mi) => (
                      <div key={mi} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_80px_110px_110px_auto]">
                        <Input value={m.name} onChange={(e) => updateMetric(i, mi, { name: e.target.value })} placeholder="e.g. Dashboards delivered" className="col-span-1 py-2 text-sm" aria-label="Metric name" />
                        <Button variant="ghost" size="sm" className="sm:order-last" onClick={() => update(i, { metrics: d.metrics.filter((_, j) => j !== mi) })} aria-label="Remove metric"><Trash2 className="h-4 w-4" /></Button>
                        <div className="col-span-2 grid grid-cols-3 gap-2 sm:col-span-3 sm:contents">
                          <Input type="number" min={0} value={m.target_value ?? ''} onChange={(e) => updateMetric(i, mi, { target_value: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Target" className="py-2 text-sm" aria-label="Target" />
                          <Input value={m.unit} onChange={(e) => updateMetric(i, mi, { unit: e.target.value })} placeholder="unit" className="py-2 text-sm" aria-label="Unit" />
                          <Select value={m.period} onChange={(e) => updateMetric(i, mi, { period: e.target.value as MetricPeriod })} className="py-2 text-sm" aria-label="Period">
                            <option value="week">per week</option><option value="month">per month</option><option value="quarter">per quarter</option>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-teal-600 hover:text-teal-700" onClick={() => update(i, { metrics: [...d.metrics, { name: '', target_value: null, unit: '', period: 'month' }] })}>
                    <Plus className="h-4 w-4" /> Add metric
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <Button variant="outline" className="w-full border-dashed" icon={<Plus className="h-4 w-4" />}
        onClick={() => onChange([...drafts, { name: '', description: '', metrics: [] }])}>Add a KPI category</Button>
    </div>
  )
}

import { useState, type KeyboardEvent } from 'react'
import { ChevronDown, Clock, ExternalLink, Link2, Pencil, Trash2, Users, X } from 'lucide-react'
import type { Entry, EntryDraft, EntryStatus, EntryType, KpiCategory, KpiMetric } from '@/lib/types'
import { cn } from '@/lib/utils'
import { prettyDate } from '@/lib/dates'
import { CategoryChip, Field, Input, Segmented, Select, Textarea, TypeBadge } from './ui'

export type EditableEntry = Pick<EntryDraft, 'refined_text' | 'category_id' | 'metric_id' | 'entry_type' | 'status' | 'quantity' | 'stakeholders' | 'impact_note' | 'blocker_detail'> & { evidence_url?: string }

export function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const t = draft.trim().replace(/,$/, '')
    if (t && !value.includes(t)) onChange([...value, t])
    setDraft('')
  }
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() }
    if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
  }
  return (
    <div className="field flex flex-wrap items-center gap-1.5 py-2">
      {value.map((t) => (
        <span key={t} className="chip bg-navy-50 text-navy-700 dark:bg-white/10 dark:text-ink">
          {t}<button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} onBlur={add} placeholder={value.length ? '' : placeholder}
        className="min-w-[100px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted/70" />
    </div>
  )
}

export function EntryEditor({ value, onChange, categories, metrics, compact }: {
  value: EditableEntry; onChange: (p: Partial<EditableEntry>) => void; categories: KpiCategory[]; metrics: KpiMetric[]; compact?: boolean
}) {
  const [more, setMore] = useState(!compact)
  const catMetrics = metrics.filter((m) => m.category_id === value.category_id)
  return (
    <div className="space-y-3">
      <Textarea value={value.refined_text} onChange={(e) => onChange({ refined_text: e.target.value })} className="min-h-[56px] font-medium" rows={2} aria-label="What you did" />
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
        <Select value={value.category_id} onChange={(e) => onChange({ category_id: e.target.value, metric_id: null })} aria-label="KPI category">
          {categories.map((c) => <option key={c.id} value={c.id}>{c.is_extra ? '✦ ' : ''}{c.name}</option>)}
        </Select>
        <Segmented<EntryType> size="sm" value={value.entry_type} onChange={(v) => onChange({ entry_type: v })} className="self-center"
          options={[{ value: 'normal', label: 'Normal' }, { value: 'above_beyond', label: 'Above & beyond' }, { value: 'blocker', label: 'Blocker' }]} />
      </div>
      {value.entry_type === 'above_beyond' && (
        <Textarea value={value.impact_note} onChange={(e) => onChange({ impact_note: e.target.value })} rows={2} className="min-h-[56px] text-sm"
          placeholder="Why was this above and beyond? (e.g. outside my role, saved 5 hours, weekend fix)" aria-label="Why above and beyond" />
      )}
      {value.entry_type === 'blocker' && (
        <Textarea value={value.blocker_detail} onChange={(e) => onChange({ blocker_detail: e.target.value })} rows={2} className="min-h-[56px] text-sm"
          placeholder="Describe the blocker and who needs to act on it" aria-label="Blocker detail" />
      )}
      <button type="button" onClick={() => setMore((m) => !m)} className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-ink">
        <ChevronDown className={cn('h-3.5 w-3.5 transition', more && 'rotate-180')} /> {more ? 'Fewer details' : 'More details: status, metric, people, evidence'}
      </button>
      {more && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Status">
            <Segmented<EntryStatus> size="sm" value={value.status} onChange={(v) => onChange({ status: v })} options={[{ value: 'done', label: 'Done' }, { value: 'in_progress', label: 'In progress' }]} />
          </Field>
          <Field label="Counts toward metric" optional>
            <div className="grid grid-cols-[1fr_72px] gap-2">
              <Select value={value.metric_id ?? ''} onChange={(e) => onChange({ metric_id: e.target.value || null })} className="py-2 text-sm" disabled={!catMetrics.length}>
                <option value="">{catMetrics.length ? 'None' : 'No metrics for this KPI'}</option>
                {catMetrics.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
              </Select>
              <Input type="number" min={0} step="any" value={value.quantity ?? ''} onChange={(e) => onChange({ quantity: e.target.value === '' ? null : Number(e.target.value) })} placeholder="Qty" className="py-2 text-sm" aria-label="Quantity" />
            </div>
          </Field>
          <Field label="Stakeholders / clients" optional><TagInput value={value.stakeholders} onChange={(v) => onChange({ stakeholders: v })} placeholder="HR, Finance, Acme Ltd… (Enter to add)" /></Field>
          <Field label="Evidence link" optional><Input value={value.evidence_url ?? ''} onChange={(e) => onChange({ evidence_url: e.target.value })} placeholder="https://… dashboard, doc, ticket" className="py-2 text-sm" /></Field>
        </div>
      )}
    </div>
  )
}

export function EntryCard({ entry, category, metric, onEdit, onDelete, showDate }: {
  entry: Entry; category?: KpiCategory; metric?: KpiMetric; onEdit?: () => void; onDelete?: () => void; showDate?: boolean
}) {
  return (
    <div className="group flex gap-3 rounded-xl border border-line/70 bg-surface p-3.5 transition hover:border-line">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: category?.color ?? '#94a3b8' }} />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium leading-snug">{entry.refined_text}</p>
        {entry.entry_type === 'above_beyond' && entry.impact_note && <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">↑ {entry.impact_note}</p>}
        {entry.entry_type === 'blocker' && entry.blocker_detail && entry.blocker_detail !== entry.refined_text && <p className="mt-1 text-sm text-red-700 dark:text-red-300">⚠ {entry.blocker_detail}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          {showDate && <span className="font-medium text-ink">{prettyDate(entry.entry_date)}</span>}
          {category && <CategoryChip name={category.name} color={category.color} />}
          {entry.entry_type !== 'normal' && <TypeBadge type={entry.entry_type} />}
          {entry.status === 'in_progress' && <span className="chip bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300"><Clock className="h-3 w-3" />In progress</span>}
          {entry.is_late && <span className="chip bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">Late entry</span>}
          {metric && <span className="chip bg-canvas">{entry.quantity ?? 1} × {metric.name}</span>}
          {entry.stakeholders.length > 0 && <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" />{entry.stakeholders.join(', ')}</span>}
          {entry.evidence_url && <a href={entry.evidence_url} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-teal-600 hover:underline"><Link2 className="h-3 w-3" />Evidence<ExternalLink className="h-3 w-3" /></a>}
        </div>
      </div>
      {(onEdit || onDelete) && (
        <div className="flex shrink-0 gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
          {onEdit && <button onClick={onEdit} className="rounded-lg p-1.5 text-muted hover:bg-canvas hover:text-ink" aria-label="Edit entry"><Pencil className="h-4 w-4" /></button>}
          {onDelete && <button onClick={onDelete} className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10" aria-label="Delete entry"><Trash2 className="h-4 w-4" /></button>}
        </div>
      )}
    </div>
  )
}

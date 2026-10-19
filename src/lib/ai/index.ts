/**
 * AI features. With Supabase connected, requests go to the `ai` Edge Function,
 * which calls Claude server-side (the API key never reaches the browser).
 * In demo mode, or if the function fails, rule-based fallbacks are used.
 */
import type { EntryDraft, KpiCategory, KpiDraft, KpiMetric, ReportContent } from '../types'
import { isDemo } from '../repo'
import { getSupabase } from '../repo/supabase'
import { heuristicKpis, heuristicOrganise } from './heuristics'

export interface AiResult<T> { value: T; source: 'claude' | 'offline' }

async function callAi<T>(task: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('ai', { body: { task, ...payload } })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.result as T
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generateKpis(jdText: string, jobTitle: string): Promise<AiResult<KpiDraft[]>> {
  if (!isDemo) {
    try {
      const value = await callAi<KpiDraft[]>('generate_kpis', { jd_text: jdText, job_title: jobTitle })
      if (Array.isArray(value) && value.length) return { value, source: 'claude' }
    } catch (e) { console.warn('AI generate_kpis failed, using offline fallback', e) }
  } else await pause(900)
  return { value: heuristicKpis(`${jobTitle}\n${jdText}`), source: 'offline' }
}

export async function organiseLog(raw: string, categories: KpiCategory[], metrics: KpiMetric[]): Promise<AiResult<EntryDraft[]>> {
  if (!isDemo) {
    try {
      const value = await callAi<EntryDraft[]>('organise_log', {
        raw,
        categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description, is_extra: c.is_extra })),
        metrics: metrics.map((m) => ({ id: m.id, category_id: m.category_id, name: m.name, unit: m.unit })),
      })
      if (Array.isArray(value)) return { value: sanitiseDrafts(value, categories, metrics), source: 'claude' }
    } catch (e) { console.warn('AI organise_log failed, using offline fallback', e) }
  } else await pause(700)
  return { value: heuristicOrganise(raw, categories, metrics), source: 'offline' }
}

export async function polishReport(content: ReportContent, ctx: { name: string; jobTitle: string; periodLabel: string }): Promise<AiResult<ReportContent>> {
  if (!isDemo && content.stats.entries > 0) {
    try {
      const value = await callAi<Pick<ReportContent, 'summary' | 'highlights' | 'next_focus'>>('polish_report', { content, ...ctx })
      return { value: { ...content, ...value }, source: 'claude' }
    } catch (e) { console.warn('AI polish_report failed, using unpolished report', e) }
  }
  return { value: content, source: 'offline' }
}

export async function polishStandup(s: { yesterday: string[]; today: string[]; blockers: string[] }): Promise<AiResult<typeof s>> {
  if (!isDemo && (s.yesterday.length || s.today.length)) {
    try {
      return { value: await callAi<typeof s>('polish_standup', { standup: s }), source: 'claude' }
    } catch (e) { console.warn('AI polish_standup failed', e) }
  }
  return { value: s, source: 'offline' }
}

/** Guard against the model returning ids that don't exist. */
function sanitiseDrafts(drafts: EntryDraft[], categories: KpiCategory[], metrics: KpiMetric[]): EntryDraft[] {
  const extra = categories.find((c) => c.is_extra)
  return drafts.map((d) => {
    const cat = categories.find((c) => c.id === d.category_id) ?? extra ?? categories[0]
    const metric = metrics.find((m) => m.id === d.metric_id && m.category_id === cat?.id)
    return {
      raw_text: d.raw_text ?? d.refined_text ?? '',
      refined_text: d.refined_text ?? d.raw_text ?? '',
      category_id: cat?.id ?? '',
      metric_id: metric?.id ?? null,
      entry_type: (['normal', 'above_beyond', 'blocker'] as const).includes(d.entry_type) ? d.entry_type : 'normal',
      status: d.status === 'in_progress' ? 'in_progress' : 'done',
      quantity: typeof d.quantity === 'number' ? d.quantity : null,
      stakeholders: Array.isArray(d.stakeholders) ? d.stakeholders.slice(0, 6) : [],
      impact_note: d.impact_note ?? '',
      blocker_detail: d.blocker_detail ?? '',
      ai_confidence: typeof d.ai_confidence === 'number' ? d.ai_confidence : 0.8,
    }
  })
}

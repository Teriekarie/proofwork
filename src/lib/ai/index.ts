/**
 * AI features. With Supabase connected, requests go to the `ai` Edge Function,
 * which calls Claude server-side (the API key never reaches the browser).
 * In demo mode, or if the function fails, rule-based fallbacks are used.
 */
import type { EntryDraft, KpiCategory, KpiDraft, KpiMetric, ReportContent } from '../types'
import { data, isDemo } from '../repo'
import { getSupabase } from '../repo/supabase'
import { heuristicKpis, heuristicOrganise } from './heuristics'

// The user's role context helps the AI file work correctly (and know their employer isn't a stakeholder).
let whoCache: { at: number; value: { job_title: string; department: string; company: string } } | null = null
async function who() {
  if (whoCache && Date.now() - whoCache.at < 5 * 60_000) return whoCache.value
  const p = await data.getProfile().catch(() => null)
  const value = { job_title: p?.job_title ?? '', department: p?.department ?? '', company: p?.company ?? '' }
  whoCache = { at: Date.now(), value }
  return value
}

/** `reason` explains why the offline fallback was used, so the UI can say so. */
export interface AiResult<T> { value: T; source: 'claude' | 'offline'; reason?: string }

async function callAi<T>(task: string, payload: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('ai', { body: { task, ...payload } })
  if (error) {
    // Surface the function's own error message (e.g. missing API key) rather than a generic HTTP error.
    const ctx = (error as { context?: Response }).context
    const msg = ctx && typeof ctx.json === 'function' ? await ctx.json().then((b: { error?: string }) => b?.error).catch(() => null) : null
    throw new Error(msg || error.message)
  }
  if (data?.error) throw new Error(data.error)
  return data.result as T
}
const why = (e: unknown) => (e instanceof Error ? e.message : 'AI unavailable')

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function generateKpis(jdText: string, jobTitle: string): Promise<AiResult<KpiDraft[]>> {
  let reason: string | undefined
  if (!isDemo) {
    try {
      const value = await callAi<KpiDraft[]>('generate_kpis', { jd_text: jdText, job_title: jobTitle })
      if (Array.isArray(value) && value.length) return { value, source: 'claude' }
    } catch (e) { reason = why(e); console.warn('AI generate_kpis failed, using offline fallback', e) }
  } else await pause(900)
  return { value: heuristicKpis(`${jobTitle}\n${jdText}`), source: 'offline', reason }
}

export async function organiseLog(raw: string, categories: KpiCategory[], metrics: KpiMetric[]): Promise<AiResult<EntryDraft[]>> {
  let reason: string | undefined
  if (!isDemo) {
    try {
      const value = await callAi<EntryDraft[]>('organise_log', {
        raw,
        who: await who(),
        categories: categories.map((c) => ({ id: c.id, name: c.name, description: c.description, is_extra: c.is_extra })),
        metrics: metrics.map((m) => ({ id: m.id, category_id: m.category_id, name: m.name, unit: m.unit })),
      })
      if (Array.isArray(value)) return { value: sanitiseDrafts(value, categories, metrics), source: 'claude' }
    } catch (e) { reason = why(e); console.warn('AI organise_log failed, using offline fallback', e) }
  } else await pause(700)
  return { value: heuristicOrganise(raw, categories, metrics), source: 'offline', reason }
}

/**
 * Refine a list of short items (planner tasks, raw entries) into one draft each, in the same order.
 * Tries a single AI call; if the AI splits or merges items, falls back to one call per item.
 */
export async function refineItems(items: string[], categories: KpiCategory[], metrics: KpiMetric[]): Promise<AiResult<EntryDraft[]>> {
  if (!items.length) return { value: [], source: 'claude' }
  const batch = await organiseLog(items.map((t) => `• ${t}`).join('\n'), categories, metrics)
  if (batch.value.length === items.length) return batch
  const one = await Promise.all(items.map((t) => organiseLog(t, categories, metrics)))
  return {
    value: one.map((r, i) => {
      const [first, ...more] = r.value
      if (!first) {
        const extra = categories.find((c) => c.is_extra) ?? categories[0]
        return { raw_text: items[i], refined_text: items[i], category_id: extra?.id ?? '', metric_id: null, entry_type: 'normal' as const, status: 'done' as const, quantity: null, stakeholders: [], impact_note: '', blocker_detail: '', ai_confidence: 0.3 }
      }
      // Keep one entry per item: fold any extra pieces the AI split off back into the first.
      return more.length ? { ...first, raw_text: items[i], refined_text: [first.refined_text, ...more.map((m) => m.refined_text)].join(' ') } : { ...first, raw_text: items[i] }
    }),
    source: one.every((r) => r.source === 'claude') ? 'claude' : 'offline',
    reason: one.find((r) => r.reason)?.reason,
  }
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

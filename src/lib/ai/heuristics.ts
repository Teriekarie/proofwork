/**
 * Offline fallbacks for the AI features, used in demo mode (and if the AI
 * service is unreachable). They are rule-based approximations of what Claude does.
 */
import type { EntryDraft, EntryType, KpiCategory, KpiDraft, KpiMetric } from '../types'

interface Theme { keys: string[]; kpi: KpiDraft }

export const THEMES: Theme[] = [
  { keys: ['dashboard', 'report', 'analytic', 'analys', 'data', 'insight', 'power bi', 'tableau', 'metric', 'visuali', 'sql', 'excel'],
    kpi: { name: 'Data Analysis & Reporting', description: 'Deliver accurate, timely dashboards, reports and analysis that drive decisions.',
      metrics: [{ name: 'Reports & dashboards delivered', target_value: 4, unit: 'reports', period: 'month' },
        { name: 'Analysis requests completed', target_value: null, unit: 'requests', period: 'month' }] } },
  { keys: ['intelligence', 'strateg', 'market', 'competit', 'research', 'forecast', 'trend', 'benchmark'],
    kpi: { name: 'Business Intelligence & Insight', description: 'Turn data and research into actionable insight for leadership and the business.',
      metrics: [{ name: 'Insight briefings shared', target_value: 2, unit: 'briefings', period: 'month' }] } },
  { keys: ['automat', 'process', 'workflow', 'efficien', 'improv', 'streamlin', 'optimi', 'script', 'power automate', 'reminder'],
    kpi: { name: 'Process Automation & Improvement', description: 'Automate and improve processes to save time and reduce errors.',
      metrics: [{ name: 'Automations / improvements shipped', target_value: 2, unit: 'automations', period: 'month' },
        { name: 'Hours saved (estimated)', target_value: null, unit: 'hours', period: 'quarter' }] } },
  { keys: ['stakeholder', 'partner', 'collaborat', 'engag', 'present', 'communicat', 'client', 'meeting', 'call', 'review', 'workshop', 'liaise'],
    kpi: { name: 'Stakeholder Engagement', description: 'Build strong working relationships and keep stakeholders informed and aligned.',
      metrics: [{ name: 'Stakeholder sessions held', target_value: 6, unit: 'sessions', period: 'month' }] } },
  { keys: ['govern', 'quality', 'accura', 'complian', 'policy', 'standard', 'integrity', 'secur', 'gdpr', 'audit', 'licens', 'certif', 'risk'],
    kpi: { name: 'Data Governance & Compliance', description: 'Maintain data quality, standards and compliance across systems and processes.',
      metrics: [{ name: 'Data quality / compliance checks', target_value: 4, unit: 'checks', period: 'month' }] } },
  { keys: ['lead', 'manag', 'team', 'mentor', 'coach', 'develop people', 'line manage', 'supervis', 'hire', 'recruit'],
    kpi: { name: 'Team Leadership & Development', description: 'Lead, support and grow the team; share knowledge and set direction.',
      metrics: [{ name: '1:1s / coaching sessions', target_value: 4, unit: 'sessions', period: 'month' }] } },
  { keys: ['project', 'deliver', 'deadline', 'implement', 'roadmap', 'initiative', 'launch', 'migrat', 'rollout', 'design', 'intranet'],
    kpi: { name: 'Project Delivery', description: 'Plan and deliver projects and initiatives on time and to the agreed scope.',
      metrics: [{ name: 'Milestones delivered on time', target_value: null, unit: 'milestones', period: 'quarter' }] } },
  { keys: ['train', 'enabl', 'upskill', 'literacy', 'documentation', 'guide', 'onboard', 'knowledge'],
    kpi: { name: 'Training & Enablement', description: 'Help others use data and tools confidently through training and documentation.',
      metrics: [{ name: 'Training sessions / guides', target_value: 1, unit: 'sessions', period: 'month' }] } },
  { keys: ['system', 'platform', 'infrastructure', 'database', 'pipeline', 'warehouse', 'integrat', 'crm', 'erp', 'sharepoint', 'api'],
    kpi: { name: 'Systems & Data Infrastructure', description: 'Build and maintain the systems, pipelines and integrations the business relies on.',
      metrics: [{ name: 'System changes deployed', target_value: null, unit: 'changes', period: 'month' }] } },
]

const count = (text: string, key: string) => text.split(key).length - 1

export function heuristicKpis(jd: string): KpiDraft[] {
  const t = jd.toLowerCase()
  const scored = THEMES.map((th) => ({ th, s: th.keys.reduce((n, k) => n + count(t, k), 0) }))
    .sort((a, b) => b.s - a.s)
  const picked = scored.filter((x) => x.s > 0).slice(0, 7).map((x) => x.th.kpi)
  for (const th of THEMES) {
    if (picked.length >= 5) break
    if (!picked.includes(th.kpi)) picked.push(th.kpi)
  }
  return JSON.parse(JSON.stringify(picked)) as KpiDraft[]
}

// ---------------------------------------------------------------------------

const ACRONYMS = ['hr', 'it', 'kpi', 'kpis', 'bi', 'ai', 'crm', 'erp', 'sql', 'api', 'ceo', 'cfo', 'cto', 'coo', 'qa', 'ux', 'ui', 'okr', 'okrs', 'gdpr', 'pr', 'sla']
const DEPARTMENTS: [RegExp, string][] = [
  [/\bhr\b|human resources|people team/i, 'HR'], [/\bfinance\b|accounts\b/i, 'Finance'], [/\bit\b(?! is| was)|tech team/i, 'IT'],
  [/\blegal\b/i, 'Legal'], [/\bmarketing\b/i, 'Marketing'], [/\bsales\b/i, 'Sales'], [/\boperations\b|\bops\b/i, 'Operations'],
  [/\bcompliance\b/i, 'Compliance'], [/\bprocurement\b/i, 'Procurement'], [/\bleadership\b|\bexec(utive)?s?\b|\bsenior management\b/i, 'Leadership'],
  [/\bclients?\b|\bcustomers?\b/i, 'Client'], [/\bmy (boss|manager|line manager)\b/i, 'Manager'],
]
const BLOCKER = /\b(blocked|blocker|waiting (on|for)|stuck|delayed|couldn'?t|could not|unable|no access|pending approval|held up|issue with|outage|down)\b/i
const ABOVE = /\b(extra|weekend|after hours|late night|stayed late|volunteer|went beyond|above and beyond|ahead of (schedule|deadline)|exceeded|outside (my|of my) (role|scope)|unplanned|urgent request|stepped in|covered for|saved \d+|record)\b/i
const IN_PROGRESS = /\b(working on|started|starting|continu|ongoing|in progress|drafting|halfway|still|progress(ed)? on|began)\b/i
const VERB_START = /^(i\s+)?(also\s+)?(i'?m\s+|am\s+)?(still|waiting|stayed|spoke|took|gave|got|went|wrote|sat|ran|had|did|built|created|made|met|reviewed|sent|wrote|drafted|fixed|updated|prepared|presented|joined|attended|led|ran|set up|setup|completed|finished|started|worked|analy[sz]ed|designed|delivered|tested|trained|helped|supported|resolved|automated|cleaned|migrated|launched|shared|called|emailed|organi[sz]ed|planned|documented|researched|published|deployed|configured|investigated|followed up|caught up|synced|onboarded|interviewed|mentored|coached|[a-z]+ed)\b/i

const TENSE: [RegExp, string][] = [
  [/^(i\s+)?did an? automation/i, 'Built an automation'], [/^(i\s+)?did /i, 'Completed '], [/^(i\s+)?had an? (review |catch[- ]up |)?(call|meeting|session)/i, 'Held a $2$3'],
  [/^(i\s+)?had /i, 'Held '], [/^(i\s+)?made /i, 'Created '], [/^(i\s+)?setup /i, 'Set up '], [/^(i\s+)?worked on /i, 'Worked on '],
]

export function splitItems(raw: string): string[] {
  const lines = raw.split(/\r?\n|;|•|(?:^|\s)[-*]\s+|\d+[.)]\s+/).map((s) => s.trim()).filter(Boolean)
  const out: string[] = []
  for (const line of lines) {
    for (const sentence of line.split(/(?<=[.!?])\s+(?=[A-Z])/)) {
      const parts = sentence.split(/,\s*(?:and\s+|then\s+|also\s+)?|\s+and then\s+|\s+and also\s+|\s+then\s+(?=[a-z]+ed\b)/i)
      let buf = ''
      for (const p of parts) {
        const s = p.trim()
        if (!s) continue
        if (buf && VERB_START.test(s)) { out.push(buf); buf = s } else buf = buf ? `${buf}, ${s}` : s
      }
      if (buf) out.push(buf)
    }
  }
  return out.map((s) => s.replace(/[.\s]+$/, '')).filter((s) => s.length > 2)
}

export function refine(text: string): string {
  let s = text.trim().replace(/^(today|this morning|this afternoon|yesterday),?\s+/i, '').replace(/^(and|also|then)\s+/i, '')
  for (const [re, rep] of TENSE) if (re.test(s)) { s = s.replace(re, rep); break }
  s = s.replace(/^i\s+/i, '')
  s = s.replace(new RegExp(`\\b(${ACRONYMS.join('|')})\\b`, 'gi'), (m) => m.toUpperCase())
  return s.charAt(0).toUpperCase() + s.slice(1)
}

const tokens = (s: string) => s.toLowerCase().match(/[a-z][a-z]+/g) ?? []
const STOP = new Set(['the', 'and', 'for', 'with', 'their', 'our', 'on', 'of', 'to', 'in', 'a', 'an', 'had', 'did', 'was', 'were', 'that', 'this', 'from', 'about', 'into', 'work', 'deliver'])

export function heuristicOrganise(raw: string, categories: KpiCategory[], metrics: KpiMetric[]): EntryDraft[] {
  const extra = categories.find((c) => c.is_extra)
  const kpis = categories.filter((c) => !c.is_extra)
  const vocab = new Map<string, string[]>()
  for (const c of kpis) {
    const theme = THEMES.find((t) => t.kpi.name === c.name)
    const ms = metrics.filter((m) => m.category_id === c.id).map((m) => m.name).join(' ')
    vocab.set(c.id, [...tokens(`${c.name} ${c.description} ${ms}`).filter((t) => !STOP.has(t)), ...(theme?.keys ?? [])])
  }

  return splitItems(raw).map((item) => {
    const low = item.toLowerCase()
    const words = tokens(item).filter((t) => !STOP.has(t))
    const stakeholders = DEPARTMENTS.filter(([re]) => re.test(item)).map(([, n]) => n)
    const isMeeting = /\b(call|meeting|session|review|workshop|catch[- ]?up|sync|presentation|presented)\b/i.test(item)
    let best: { id: string; score: number } = { id: extra?.id ?? kpis[0]?.id ?? '', score: 0 }
    for (const c of kpis) {
      const keys = vocab.get(c.id) ?? []
      // A meeting with a named team is primarily stakeholder work.
      let score = isMeeting && stakeholders.length && /stakeholder|engag|relationship|partner/i.test(c.name) ? 3 : 0
      for (const k of keys) {
        if (k.includes(' ')) { if (low.includes(k)) score += 2 }
        else if (words.some((w) => w.startsWith(k.slice(0, Math.max(4, Math.min(k.length, 6)))))) score += 1
      }
      if (score > best.score) best = { id: c.id, score }
    }
    const entry_type: EntryType = BLOCKER.test(item) ? 'blocker' : ABOVE.test(item) ? 'above_beyond' : 'normal'
    const qty = item.match(/\b(\d+(?:\.\d+)?)\s+(?=[a-z])/i)
    const catMetrics = metrics.filter((m) => m.category_id === best.id)
    const metric = qty ? catMetrics.find((m) => tokens(`${m.name} ${m.unit}`).some((t) => low.includes(t.slice(0, 5)))) ?? catMetrics[0] : undefined
    return {
      raw_text: item,
      refined_text: refine(item),
      category_id: best.score > 0 ? best.id : (extra?.id ?? best.id),
      metric_id: metric?.id ?? null,
      entry_type,
      status: IN_PROGRESS.test(item) ? 'in_progress' : 'done',
      quantity: qty ? Number(qty[1]) : null,
      stakeholders: [...new Set(stakeholders)],
      impact_note: '',
      blocker_detail: '',
      ai_confidence: best.score > 0 ? Math.min(0.95, 0.45 + best.score * 0.12) : 0.4,
    }
  })
}

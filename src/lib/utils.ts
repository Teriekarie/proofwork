import { clsx, type ClassValue } from 'clsx'

export const cn = (...v: ClassValue[]) => clsx(v)

export const uid = () =>
  (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

export const nowIso = () => new Date().toISOString()

export const firstName = (full: string) => full.trim().split(/\s+/)[0] || 'there'

export const initials = (full: string) =>
  full.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'

export const pluralize = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// Fixed-order categorical palette, validated for CVD separation and 3:1 contrast on light and dark surfaces.
// KPI generation is capped at 8 categories so hues are never cycled; Beyond Scope uses the neutral EXTRA_COLOR.
export const CATEGORY_COLORS = ['#1D9E75', '#3B73D9', '#C97A16', '#8B5CF6', '#E1546A', '#0B8BCB', '#5E9A0C', '#C944DE']
export const EXTRA_COLOR = '#94A3B8'

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true } catch { return false }
}

export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

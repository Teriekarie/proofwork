import { AlertTriangle, ArrowRight, Award, Star } from 'lucide-react'
import type { Report } from '@/lib/types'
import { periodLabel } from '@/lib/dates'
import { escapeHtml } from '@/lib/utils'

export interface ReportOwner { full_name: string; job_title: string; company: string }

export function ReportDocument({ report, owner, colorFor }: { report: Report; owner: ReportOwner; colorFor?: (categoryId: string) => string }) {
  const c = report.content
  const kind = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Annual' }[report.period_type]
  return (
    <article className="printable card mx-auto max-w-3xl p-6 sm:p-10">
      <header className="border-b border-line pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-600">{kind} work report</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{periodLabel(report.period_type, report.period_start, report.period_end)}</h1>
        <p className="mt-2 text-muted">{owner.full_name}{owner.job_title && ` · ${owner.job_title}`}{owner.company && ` · ${owner.company}`}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 border-b border-line py-6 sm:grid-cols-4">
        {[['Entries', c.stats.entries], ['Days logged', c.stats.days_logged], ['Above & beyond', c.stats.above_beyond], ['KPI areas active', c.stats.categories_active]].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-canvas p-3"><dt className="text-xs text-muted">{k}</dt><dd className="text-2xl font-bold tabular-nums">{v}</dd></div>
        ))}
      </dl>

      <section className="py-6">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Summary</h2>
        <p className="mt-2 text-[15px] leading-relaxed">{c.summary}</p>
      </section>

      {c.highlights.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted"><Award className="h-4 w-4 text-teal-500" />Key achievements</h2>
          <ul className="mt-3 space-y-2">{c.highlights.map((h, i) => <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-500" />{h}</li>)}</ul>
        </section>
      )}

      {c.sections.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted">Work by KPI</h2>
          <div className="mt-4 space-y-6">
            {c.sections.map((s) => (
              <div key={s.category_id}>
                <h3 className="flex items-center gap-2 font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: colorFor?.(s.category_id) ?? '#1D9E75' }} />
                  {s.category} <span className="font-normal text-muted">· {s.items.length}</span>
                </h3>
                {s.metrics.length > 0 && (
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {s.metrics.map((m) => (
                        <tr key={m.name} className="border-b border-line/60 last:border-0">
                          <td className="py-1.5 text-muted">{m.name}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums">{m.actual}{m.target != null && <span className="font-normal text-muted"> / {m.target} target</span>} {m.unit}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <ul className="mt-2 space-y-1.5">{s.items.map((it, i) => <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {c.above_beyond.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted"><Star className="h-4 w-4 text-emerald-500" />Above & beyond</h2>
          <ul className="mt-3 space-y-2">{c.above_beyond.map((h, i) => <li key={i} className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[15px] text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200">{h}</li>)}</ul>
        </section>
      )}

      {c.blockers.length > 0 && (
        <section className="border-t border-line py-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted"><AlertTriangle className="h-4 w-4 text-red-500" />Blockers raised</h2>
          <ul className="mt-3 space-y-1.5">{c.blockers.map((h, i) => <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />{h}</li>)}</ul>
        </section>
      )}

      {c.next_focus.length > 0 && (
        <section className="border-t border-line pt-6">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted"><ArrowRight className="h-4 w-4 text-navy-400" />Next focus</h2>
          <ul className="mt-3 space-y-1.5">{c.next_focus.map((h, i) => <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-navy-400" />{h}</li>)}</ul>
        </section>
      )}
      <footer className="mt-8 border-t border-line pt-4 text-xs text-muted">Generated with Proofwork from daily work logs.</footer>
    </article>
  )
}

/** Word-compatible HTML document (opens in Word, Google Docs, Pages). */
export function reportToWordHtml(report: Report, owner: ReportOwner): string {
  const c = report.content
  const e = escapeHtml
  const list = (xs: string[]) => `<ul>${xs.map((x) => `<li>${e(x)}</li>`).join('')}</ul>`
  const kind = { week: 'Weekly', month: 'Monthly', quarter: 'Quarterly', year: 'Annual' }[report.period_type]
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="utf-8"><title>${e(report.title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#0f1e2e;line-height:1.45}h1{color:#1A3C5E;font-size:22pt;margin:0}h2{color:#1A3C5E;font-size:13pt;border-bottom:1px solid #d6e1ec;padding-bottom:3pt;margin-top:18pt}h3{font-size:11.5pt;margin:12pt 0 4pt}.k{color:#1D9E75;font-size:9pt;letter-spacing:2pt;text-transform:uppercase;font-weight:bold}.m{color:#64748b}table{border-collapse:collapse}td{padding:3pt 10pt 3pt 0}</style></head>
<body>
<p class="k">${kind} work report</p>
<h1>${e(periodLabel(report.period_type, report.period_start, report.period_end))}</h1>
<p class="m">${e([owner.full_name, owner.job_title, owner.company].filter(Boolean).join(' · '))}</p>
<table><tr><td><b>${c.stats.entries}</b> entries</td><td><b>${c.stats.days_logged}</b> days logged</td><td><b>${c.stats.above_beyond}</b> above &amp; beyond</td><td><b>${c.stats.categories_active}</b> KPI areas active</td></tr></table>
<h2>Summary</h2><p>${e(c.summary)}</p>
${c.highlights.length ? `<h2>Key achievements</h2>${list(c.highlights)}` : ''}
${c.sections.length ? `<h2>Work by KPI</h2>${c.sections.map((s) => `<h3>${e(s.category)} (${s.items.length})</h3>${s.metrics.length ? `<table>${s.metrics.map((m) => `<tr><td class="m">${e(m.name)}</td><td><b>${m.actual}</b>${m.target != null ? ` / ${m.target} target` : ''} ${e(m.unit)}</td></tr>`).join('')}</table>` : ''}${list(s.items)}`).join('')}` : ''}
${c.above_beyond.length ? `<h2>Above &amp; beyond</h2>${list(c.above_beyond)}` : ''}
${c.blockers.length ? `<h2>Blockers raised</h2>${list(c.blockers)}` : ''}
${c.next_focus.length ? `<h2>Next focus</h2>${list(c.next_focus)}` : ''}
<p class="m" style="margin-top:24pt;font-size:9pt">Generated with Proofwork from daily work logs.</p>
</body></html>`
}

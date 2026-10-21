import { motion } from 'framer-motion'
import { CheckCircle2, Flame, Mic2, Sparkles, Star, Wand2 } from 'lucide-react'
import { CATEGORY_COLORS, cn } from '@/lib/utils'

// Illustrative sample data for the sign-in panel's product preview.
const KPIS = [
  { name: 'Data Analysis & Reporting', actual: 3, target: 4, color: CATEGORY_COLORS[0] },
  { name: 'Process Automation', actual: 2, target: 2, color: CATEGORY_COLORS[1] },
  { name: 'Stakeholder Engagement', actual: 5, target: 6, color: CATEGORY_COLORS[2] },
]

// 14 weeks × 7 days of activity levels (0–4), deterministic so it renders the same every time.
const HEAT = Array.from({ length: 14 * 7 }, (_, i) => {
  const day = i % 7
  if (day >= 5) return 0
  return [1, 2, 3, 2, 4, 1, 3, 2, 0, 3][(i * 7 + 3) % 10]
})
const HEAT_CLS = ['bg-white/[0.07]', 'bg-teal-900', 'bg-teal-700', 'bg-teal-500', 'bg-teal-300']

const float = (delay: number, distance = 8) => ({
  animate: { y: [0, -distance, 0] },
  transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const, delay },
})

function Glass({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('rounded-2xl border border-white/10 bg-navy-900/70 p-4 text-white shadow-2xl shadow-black/30 backdrop-blur-md', className)}>
      {children}
    </div>
  )
}

export function AuthShowcase() {
  return (
    <div className="relative mx-auto h-[590px] w-full max-w-[460px] [&_.chip]:whitespace-nowrap" aria-hidden>
      {/* Dashboard card */}
      <motion.div {...float(0, 6)} className="absolute left-0 right-8 top-0">
        <Glass className="p-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-navy-200">Dashboard · October</p>
            <span className="chip bg-amber-400/15 text-amber-200"><Flame className="h-3 w-3" />12-day streak</span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[['18', 'this week'], ['4', 'above & beyond'], ['7', 'KPIs active']].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/[0.06] px-3 py-2">
                <p className="text-xl font-bold tabular-nums">{v}</p>
                <p className="text-[11px] leading-tight text-navy-200">{l}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2.5">
            {KPIS.map((k, i) => (
              <div key={k.name}>
                <div className="flex justify-between text-xs">
                  <span className="text-navy-100">{k.name}</span>
                  <span className="font-semibold tabular-nums">{k.actual}<span className="font-normal text-navy-300"> / {k.target}</span></span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div className="h-full rounded-full" style={{ background: k.color }}
                    initial={{ width: '8%' }} animate={{ width: `${(k.actual / k.target) * 100}%` }} transition={{ duration: 1.2, delay: 0.3 + i * 0.15, ease: 'easeOut' }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-flow-col grid-rows-7 gap-[3px]">
            {HEAT.map((lvl, i) => <span key={i} className={cn('h-2.5 w-2.5 rounded-[2px]', HEAT_CLS[lvl])} />)}
          </div>
        </Glass>
      </motion.div>

      {/* Today's log, organised */}
      <motion.div {...float(1.2, 9)} className="absolute -left-6 top-[350px] w-[318px]">
        <Glass>
          <p className="flex items-center gap-1.5 text-xs font-semibold text-teal-300"><Wand2 className="h-3.5 w-3.5" />Organised by Claude</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-white/[0.06] p-2.5">
              <p className="text-[13px] font-medium leading-snug">Built an automated reminder workflow for domain expiry dates</p>
              <span className="chip mt-1.5 bg-white/10 text-[11px] text-navy-100"><span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[1] }} />Process Automation</span>
            </div>
            <div className="rounded-xl bg-white/[0.06] p-2.5">
              <p className="text-[13px] font-medium leading-snug">Fixed the Q3 board dashboard after hours for leadership</p>
              <div className="mt-1.5 flex gap-1.5">
                <span className="chip bg-white/10 text-[11px] text-navy-100"><span className="h-1.5 w-1.5 rounded-full" style={{ background: CATEGORY_COLORS[0] }} />Data & Reporting</span>
                <span className="chip bg-emerald-400/15 text-[11px] text-emerald-200"><Star className="h-3 w-3" />Above & beyond</span>
              </div>
            </div>
          </div>
        </Glass>
      </motion.div>

      {/* Standup ready */}
      <motion.div {...float(2.4, 7)} className="absolute -right-4 top-[392px] w-[190px]">
        <Glass className="bg-teal-600/80">
          <p className="flex items-center gap-1.5 text-xs font-semibold"><Mic2 className="h-3.5 w-3.5" />Standup ready</p>
          <ul className="mt-2 space-y-1.5 text-[12px] leading-snug text-teal-50">
            <li className="flex gap-1.5"><CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />Yesterday: 4 items</li>
            <li className="flex gap-1.5"><CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />Today: 3 planned</li>
            <li className="flex gap-1.5"><CheckCircle2 className="mt-px h-3.5 w-3.5 shrink-0" />No blockers</li>
          </ul>
        </Glass>
      </motion.div>

      {/* Sparkle badge */}
      <motion.div {...float(0.6, 5)} className="absolute -top-4 right-0">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 text-white shadow-lg shadow-teal-500/40">
          <Sparkles className="h-5 w-5" />
        </span>
      </motion.div>
    </div>
  )
}

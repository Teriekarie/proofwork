import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, BarChart3, CalendarCheck2, FileText, Lock, Mic2, PenLine, ShieldCheck, Sparkles, Target, Wand2,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button, CategoryChip, TypeBadge } from '@/components/ui'

const fade = { initial: { opacity: 0, y: 16 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.5 } }

export default function Landing() {
  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-30 border-b border-line/60 bg-surface/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 sm:gap-2">
            <a href="#how" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">How it works</a>
            <a href="#features" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-muted hover:text-ink sm:block">Features</a>
            <Link to="/login" className="rounded-lg px-3 py-2 text-sm font-semibold text-ink hover:bg-canvas">Log in</Link>
            <Link to="/signup"><Button size="sm" variant="accent">Get started</Button></Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(ellipse_70%_60%_at_70%_0%,rgba(29,158,117,0.14),transparent_70%),radial-gradient(ellipse_60%_50%_at_10%_10%,rgba(26,60,94,0.12),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 md:grid-cols-2 md:pb-24 md:pt-20">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="chip mb-5 border border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-500/30 dark:bg-teal-500/10 dark:text-teal-300">
              <Sparkles className="h-3.5 w-3.5" /> AI-powered work log
            </span>
            <h1 className="text-4xl font-extrabold leading-[1.08] text-navy-700 dark:text-white sm:text-5xl lg:text-6xl">
              Every day,<br /><span className="bg-gradient-to-r from-teal-500 to-navy-500 bg-clip-text text-transparent">on the record.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-muted">
              Log what you did in plain words. Proofwork maps it to your KPIs, writes tomorrow's standup, and builds the monthly report your manager actually wants to read.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link to="/signup"><Button size="lg" variant="accent" className="w-full sm:w-auto">Get started free <ArrowRight className="h-4 w-4" /></Button></Link>
              <a href="#how"><Button size="lg" variant="outline" className="w-full sm:w-auto">See how it works</Button></a>
            </div>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Lock className="h-4 w-4" /> Your work log is private to you.</p>
          </motion.div>

          {/* Product preview */}
          <motion.div initial={{ opacity: 0, y: 30, rotate: 1 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.7, delay: 0.15 }} className="relative">
            <div className="card p-5 shadow-lift">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted">Today's brain-dump</p>
              <p className="mt-2 rounded-xl bg-canvas p-3.5 text-[15px] leading-relaxed text-ink">
                did an automation for licensing certification reminder, had a review call with hr on their intranet design page, stayed late to fix the Q3 dashboard for leadership
              </p>
              <div className="my-4 flex items-center gap-2 text-sm font-medium text-teal-600 dark:text-teal-400"><Wand2 className="h-4 w-4" /> Organised into 3 entries</div>
              <div className="space-y-2.5">
                {[
                  { t: 'Built an automation for licensing certification renewal reminders', c: 'Process Automation', col: '#1D9E75', type: 'normal' as const },
                  { t: 'Held a design review call with HR on the intranet page', c: 'Stakeholder Engagement', col: '#C97A16', type: 'normal' as const },
                  { t: 'Stayed late to fix the Q3 dashboard for leadership', c: 'Data Analysis & Reporting', col: '#3B73D9', type: 'above_beyond' as const },
                ].map((e, i) => (
                  <motion.div key={e.t} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 + i * 0.15 }}
                    className="rounded-xl border border-line/70 bg-surface p-3">
                    <p className="text-sm font-medium">{e.t}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5"><CategoryChip name={e.c} color={e.col} />{e.type !== 'normal' && <TypeBadge type={e.type} />}</div>
                  </motion.div>
                ))}
              </div>
            </div>
            <div className="absolute -bottom-5 -left-4 hidden rounded-2xl border border-line/70 bg-surface px-4 py-3 shadow-lift sm:block">
              <p className="text-xs text-muted">Logging streak</p>
              <p className="text-xl font-bold">🔥 12 days</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="border-y border-line/60 bg-canvas py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fade} className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold text-navy-700 dark:text-white sm:text-4xl">Three minutes a day. A year of proof.</h2>
            <p className="mt-3 text-lg text-muted">Set up once from your job description, then just write what you did.</p>
          </motion.div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { icon: Target, title: 'Upload your JD', body: 'Paste or upload your job description. AI turns it into clear KPI categories and metrics you can edit any time.' },
              { icon: PenLine, title: 'Log your day', body: 'Write it how you\'d say it. Proofwork splits, polishes and files each item under the right KPI, or tags it Beyond Scope.' },
              { icon: FileText, title: 'Show your impact', body: 'Standup notes ready each morning. Weekly, monthly and yearly reports ready for your manager and appraisals.' },
            ].map((s, i) => (
              <motion.div key={s.title} {...fade} transition={{ duration: 0.5, delay: i * 0.1 }} className="card p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-600 text-white"><s.icon className="h-5 w-5" /></span>
                  <span className="text-sm font-bold text-teal-600 dark:text-teal-400">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-muted">{s.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.h2 {...fade} className="text-center text-3xl font-bold text-navy-700 dark:text-white sm:text-4xl">Everything you need to own your story</motion.h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Mic2, title: 'Standup in one tap', body: 'Yesterday, today and blockers, written for you and ready to read out.' },
              { icon: BarChart3, title: 'KPI dashboard', body: 'See where your effort goes, which KPIs are thriving and which have gone quiet.' },
              { icon: Sparkles, title: 'Above & beyond tracking', body: 'Every extra mile captured, so nothing is forgotten at appraisal time.' },
              { icon: CalendarCheck2, title: 'Daily planner', body: 'Plan your day, carry over unfinished work, and turn done tasks into log entries.' },
              { icon: FileText, title: 'Professional reports', body: 'Monthly, quarterly and yearly summaries with achievements and metrics. Export or share a link.' },
              { icon: ShieldCheck, title: 'Private & secure', body: 'Encrypted, isolated per user, with email verification and secure sign-in options.' },
            ].map((f, i) => (
              <motion.div key={f.title} {...fade} transition={{ duration: 0.45, delay: (i % 3) * 0.08 }} className="rounded-2xl border border-line/70 p-6 transition hover:border-teal-300 hover:shadow-card">
                <f.icon className="h-6 w-6 text-teal-500" />
                <h3 className="mt-3 font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm text-muted">{f.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6">
        <motion.div {...fade} className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-navy-600 px-6 py-14 text-center text-white sm:px-12">
          <h2 className="text-3xl font-bold sm:text-4xl">Walk into your next review with receipts.</h2>
          <p className="mx-auto mt-3 max-w-xl text-navy-100">Start logging today. Free for you and your colleagues.</p>
          <Link to="/signup" className="mt-8 inline-block"><Button size="lg" variant="accent">Create your account <ArrowRight className="h-4 w-4" /></Button></Link>
        </motion.div>
      </section>

      <footer className="border-t border-line/60 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-sm text-muted sm:flex-row sm:px-6">
          <Logo />
          <p>© {new Date().getFullYear()} Proofwork. Every day, on the record.</p>
        </div>
      </footer>
    </div>
  )
}

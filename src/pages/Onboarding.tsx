import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Briefcase, Check, FileText, Sparkles, Target, UserRound } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button, Card, CategoryChip } from '@/components/ui'
import { AboutFields, JdInput, WorkFields, usernameBlocking, useUsernameCheck, type ProfileDraft } from '@/components/ProfileFields'
import { KpiDraftEditor } from '@/components/KpiDraftEditor'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data } from '@/lib/hooks'
import { generateKpis } from '@/lib/ai'
import type { KpiDraft } from '@/lib/types'
import { EXTRA_COLOR, cn } from '@/lib/utils'
import { auth } from '@/lib/repo'

const STEPS = [
  { title: 'About you', icon: UserRound, blurb: 'So your reports and standups sound like you.' },
  { title: 'Work setup', icon: Briefcase, blurb: 'Your schedule decides when each work day opens and closes.' },
  { title: 'Job description', icon: FileText, blurb: 'Your JD is the source of your KPIs.' },
  { title: 'Your KPIs', icon: Target, blurb: 'Review what the AI found. Edit anything.' },
]

export default function Onboarding() {
  const { profile, refreshProfile } = useSession()
  const navigate = useNavigate()
  const toast = useToast()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [p, setP] = useState<ProfileDraft>(() => {
    const { id: _i, email: _e, onboarded_at: _o, ...rest } = profile!
    return rest
  })
  const [jd, setJd] = useState('')
  const [jdFile, setJdFile] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<KpiDraft[] | null>(null)
  const [generating, setGenerating] = useState(false)
  const [aiSource, setAiSource] = useState<'claude' | 'offline' | null>(null)
  const [saving, setSaving] = useState(false)
  const uState = useUsernameCheck(p.username)

  // Resuming after a refresh: bring back the JD saved earlier in onboarding.
  useEffect(() => {
    data.getCurrentJd().then((j) => {
      if (j) { setJd((cur) => cur || j.jd_text); setJdFile((cur) => cur ?? j.file_name) }
    }).catch(() => {})
  }, [])

  const patch = (x: Partial<ProfileDraft>) => setP((s) => ({ ...s, ...x }))

  const canNext = [
    p.full_name.trim().length > 1 && p.username.trim().length >= 3 && p.job_title.trim().length > 1 && !usernameBlocking(uState),
    p.company.trim().length > 0 && p.work_days.length > 0,
    jd.trim().split(/\s+/).length >= 15,
    !!drafts && drafts.filter((d) => d.name.trim()).length > 0,
  ][step]

  const go = async (n: number) => {
    if (n > step && step === 0) {
      try { await data.saveProfile(p) } catch (e) { return toast((e as Error).message, 'error') }
    }
    if (n > step && step === 1) await data.saveProfile(p)
    if (n === 3 && !drafts) void generate()
    setDir(n > step ? 1 : -1)
    setStep(n)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const generate = async () => {
    setGenerating(true)
    try {
      await data.saveJd({ source: jdFile ? 'upload' : 'paste', file_name: jdFile, jd_text: jd.trim() })
      const r = await generateKpis(jd, p.job_title)
      setDrafts(r.value); setAiSource(r.source)
      if (r.reason) toast(`Claude couldn't generate KPIs (${r.reason}). Showing basic suggestions instead.`, 'error')
    } catch (e) { toast((e as Error).message, 'error') } finally { setGenerating(false) }
  }

  const finish = async () => {
    if (!drafts) return
    setSaving(true)
    try {
      await data.applyKpiDrafts(drafts.filter((d) => d.name.trim()).map((d) => ({ ...d, metrics: d.metrics.filter((m) => m.name.trim()) })))
      await data.saveProfile({ ...p, onboarded_at: new Date().toISOString() })
      await refreshProfile()
      toast("You're all set. Welcome to Proofwork!")
      navigate('/home')
    } catch (e) { toast((e as Error).message, 'error') } finally { setSaving(false) }
  }

  const S = STEPS[step]

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line/70 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Logo />
          <button className="text-sm font-medium text-muted hover:text-ink" onClick={() => auth.signOut().then(() => navigate('/'))}>Sign out</button>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Progress */}
        <ol className="mb-8 grid grid-cols-4 gap-2">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <div className={cn('h-1.5 rounded-full transition-colors', i <= step ? 'bg-teal-500' : 'bg-line')} />
              <p className={cn('mt-2 hidden text-xs font-medium sm:block', i === step ? 'text-ink' : 'text-muted')}>{i + 1}. {s.title}</p>
            </li>
          ))}
        </ol>

        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-600 text-white"><S.icon className="h-5 w-5" /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">Step {step + 1} of 4</p>
            <h1 className="text-2xl font-bold">{S.title}</h1>
          </div>
        </div>
        <p className="-mt-3 mb-6 text-muted">{S.blurb}</p>

        {/* Enter-only slide (no opacity/exit phase) so a step can never be left invisible mid-animation. */}
          <motion.div key={step} initial={{ x: 24 * dir }} animate={{ x: 0 }} transition={{ duration: 0.22 }}>
            {step === 0 && <Card className="p-5 sm:p-7"><AboutFields value={p} onChange={patch} /></Card>}
            {step === 1 && <Card className="p-5 sm:p-7"><WorkFields value={p} onChange={patch} /></Card>}
            {step === 2 && (
              <Card className="p-5 sm:p-7">
                <JdInput text={jd} onText={setJd} fileName={jdFile} onFileName={setJdFile} />
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-canvas p-3 text-sm text-muted">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-teal-500" />
                  The AI reads your JD to suggest 5–8 KPI categories with metrics. You can change them any time, and add new ones when your role grows.
                </p>
              </Card>
            )}
            {step === 3 && (
              generating || !drafts ? (
                <Card className="flex flex-col items-center px-6 py-16 text-center">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2.4, ease: 'linear' }}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-400 to-navy-500 text-white shadow-lg">
                    <Sparkles className="h-7 w-7" />
                  </motion.div>
                  <p className="mt-5 text-lg font-semibold">Reading your job description…</p>
                  <p className="mt-1 text-muted">Finding your KPI categories and sensible metrics.</p>
                </Card>
              ) : (
                <div>
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted">
                      {drafts.length} categories found{aiSource === 'offline' && ' (offline suggestions; Claude takes over once connected)'}.
                    </p>
                    <Button variant="ghost" size="sm" icon={<Sparkles className="h-4 w-4" />} onClick={generate}>Regenerate</Button>
                  </div>
                  <KpiDraftEditor drafts={drafts} onChange={setDrafts} />
                  <div className="mt-4 flex items-start gap-3 rounded-2xl border border-dashed border-line bg-surface p-4">
                    <CategoryChip name="Beyond Scope" color={EXTRA_COLOR} />
                    <p className="text-sm text-muted">Added automatically. Work that doesn't fit a KPI lands here so it's still tracked and reported.</p>
                  </div>
                </div>
              )
            )}
          </motion.div>

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 0} icon={<ArrowLeft className="h-4 w-4" />}>Back</Button>
          {step < 3 ? (
            <Button variant={step === 2 ? 'accent' : 'primary'} onClick={() => go(step + 1)} disabled={!canNext}>
              {step === 2 ? <><Sparkles className="h-4 w-4" />Generate my KPIs</> : <>Continue <ArrowRight className="h-4 w-4" /></>}
            </Button>
          ) : (
            <Button variant="accent" onClick={finish} loading={saving} disabled={!canNext || generating} icon={<Check className="h-4 w-4" />}>Save KPIs & finish</Button>
          )}
        </div>
        {step === 2 && !canNext && jd.trim() && <p className="mt-3 text-right text-sm text-muted">Add a bit more detail (at least 15 words).</p>}
      </div>
    </div>
  )
}

import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, Eye, EyeOff, MailCheck, X } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { AuthShowcase } from '@/components/AuthShowcase'
import { Button, Field, Input } from '@/components/ui'
import { useToast } from '@/components/toast'
import { auth, isDemo, type OAuthProvider } from '@/lib/repo'
import { checkPassword } from '@/lib/password'
import { cn } from '@/lib/utils'

function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link to="/"><Logo /></Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <motion.div initial={{ y: 12 }} animate={{ y: 0 }} className="w-full max-w-sm">
            <h1 className="text-3xl font-bold">{title}</h1>
            <p className="mt-2 text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
            <p className="mt-8 text-center text-xs text-muted"><Link to="/privacy" className="hover:text-ink hover:underline">Privacy & data</Link></p>
          </motion.div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-navy-700 lg:block">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(29,158,117,0.45),transparent_60%),radial-gradient(ellipse_at_bottom_left,rgba(59,115,217,0.25),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:22px_22px]" />
        <div className="relative flex h-full min-h-screen flex-col px-12 py-12 text-white xl:px-16">
          <div className="flex flex-1 items-center justify-center py-8 [@media(max-height:860px)]:-my-10 [@media(max-height:860px)]:scale-[0.85]">
            <AuthShowcase />
          </div>
          <div className="mx-auto w-full max-w-[460px]">
            <p className="text-2xl font-semibold leading-snug">
              Log your day in plain words. Walk into every standup and appraisal with proof.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-sm text-navy-100">
              {['3 min to log a day', '1-tap standup notes', 'Monthly reports for your manager'].map((t) => (
                <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{t}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OAuthButtons() {
  const toast = useToast()
  const [busy, setBusy] = useState<OAuthProvider | null>(null)
  const go = async (p: OAuthProvider) => {
    setBusy(p)
    try { await auth.signInWithOAuth(p) } catch (e) { toast((e as Error).message, 'info'); setBusy(null) }
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      <Button type="button" variant="outline" loading={busy === 'google'} onClick={() => go('google')}
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.2 14.6 2.2 12 2.2 6.6 2.2 2.3 6.6 2.3 12s4.3 9.8 9.7 9.8c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" /></svg>}>
        Google
      </Button>
      <Button type="button" variant="outline" loading={busy === 'azure'} onClick={() => go('azure')}
        icon={<svg viewBox="0 0 24 24" className="h-4 w-4"><path fill="#F25022" d="M2 2h9.5v9.5H2z" /><path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" /><path fill="#00A4EF" d="M2 12.5h9.5V22H2z" /><path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" /></svg>}>
        Microsoft
      </Button>
    </div>
  )
}

function Divider() {
  return <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-wider text-muted"><span className="h-px flex-1 bg-line" />or with email<span className="h-px flex-1 bg-line" /></div>
}

function PasswordInput({ value, onChange, id, autoComplete, placeholder }: { value: string; onChange: (v: string) => void; id: string; autoComplete: string; placeholder?: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <Input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder} className="pr-11" required />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function StrengthMeter({ password, email }: { password: string; email?: string }) {
  const c = checkPassword(password, email)
  const colors = ['bg-red-500', 'bg-red-500', 'bg-amber-500', 'bg-teal-500', 'bg-teal-600']
  if (!password) return null
  return (
    <div className="mt-2.5">
      <div className="flex gap-1">{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1.5 flex-1 rounded-full transition', i < Math.max(1, c.score) ? colors[c.score] : 'bg-line')} />)}</div>
      <p className={cn('mt-1.5 text-xs font-semibold', c.score >= 3 ? 'text-teal-600' : c.score === 2 ? 'text-amber-600' : 'text-red-600')}>{c.label}</p>
      <ul className="mt-2 space-y-1">
        {c.rules.map((r) => (
          <li key={r.label} className={cn('flex items-center gap-1.5 text-xs', r.ok ? 'text-teal-700 dark:text-teal-400' : 'text-muted')}>
            {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{r.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Signup() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const strength = checkPassword(pw, email)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!strength.acceptable) return setError('Please choose a stronger password.')
    if (pw !== pw2) return setError("Passwords don't match.")
    if (!agree) return setError('Please accept the privacy terms to continue.')
    setBusy(true)
    try {
      const r = await auth.signUp(email, pw)
      if (r.needsVerification) setSentTo(email)
      else navigate('/onboarding')
    } catch (err) {
      setError((err as Error).message)
    } finally { setBusy(false) }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Check your inbox" subtitle={<>We sent a verification link to <b className="text-ink">{sentTo}</b>.</>}
        footer={<Link to="/login" className="font-semibold text-teal-600">Back to log in</Link>}>
        <div className="flex flex-col items-center rounded-2xl bg-teal-50 p-8 text-center dark:bg-teal-500/10">
          <MailCheck className="h-12 w-12 text-teal-500" />
          <p className="mt-4 text-sm text-muted">Click the link in the email to verify your account. You'll then set up your profile and KPIs.</p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create your account" subtitle="Start building your record in under 5 minutes."
      footer={<>Already have an account? <Link to="/login" className="font-semibold text-teal-600">Log in</Link></>}>
      <OAuthButtons />
      <Divider />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Work email" htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com" required />
        </Field>
        <Field label="Password" htmlFor="pw">
          <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" placeholder="At least 10 characters" />
          <StrengthMeter password={pw} email={email} />
        </Field>
        <Field label="Confirm password" htmlFor="pw2" error={pw2 && pw !== pw2 ? "Passwords don't match" : null}>
          <PasswordInput id="pw2" value={pw2} onChange={setPw2} autoComplete="new-password" />
        </Field>
        <label className="flex items-start gap-2.5 text-sm text-muted">
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-4 w-4 rounded accent-teal-500" />
          <span>I've read the <Link to="/privacy" target="_blank" className="font-medium text-teal-600 hover:underline">privacy & data page</Link>. My log is stored securely and processed by AI when I use AI features.</span>
        </label>
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Button type="submit" variant="accent" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
    </AuthLayout>
  )
}

export function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setBusy(true)
    try { await auth.signIn(email, pw); navigate('/home') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Log in to keep your record going."
      footer={<>New to Proofwork? <Link to="/signup" className="font-semibold text-teal-600">Create an account</Link></>}>
      <OAuthButtons />
      <Divider />
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email" htmlFor="email">
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </Field>
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="pw" className="text-sm font-medium">Password</label>
            <Link to="/forgot-password" className="text-sm font-medium text-teal-600">Forgot password?</Link>
          </div>
          <PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="current-password" />
        </div>
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
      </form>
    </AuthLayout>
  )
}

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null); setBusy(true)
    try { await auth.sendPasswordReset(email); setSent(true) } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Reset your password" subtitle="We'll email you a secure link to choose a new one."
      footer={<Link to="/login" className="font-semibold text-teal-600">Back to log in</Link>}>
      {sent ? (
        <div className="rounded-2xl bg-teal-50 p-6 text-center dark:bg-teal-500/10">
          <MailCheck className="mx-auto h-10 w-10 text-teal-500" />
          <p className="mt-3 text-sm">If an account exists for <b>{email}</b>, a reset link is on its way.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Email" htmlFor="email"><Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
          {error && <p className="rounded-xl bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
          {isDemo && <p className="text-center text-xs text-muted">Demo mode: reset emails work once Supabase is connected.</p>}
        </form>
      )}
    </AuthLayout>
  )
}

export function ResetPassword() {
  const navigate = useNavigate()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(null)
    if (!checkPassword(pw).acceptable) return setError('Please choose a stronger password.')
    if (pw !== pw2) return setError("Passwords don't match.")
    setBusy(true)
    try { await auth.updatePassword(pw); toast('Password updated'); navigate('/home') } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong. You won't need to change it often.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password" htmlFor="pw"><PasswordInput id="pw" value={pw} onChange={setPw} autoComplete="new-password" /><StrengthMeter password={pw} /></Field>
        <Field label="Confirm new password" htmlFor="pw2"><PasswordInput id="pw2" value={pw2} onChange={setPw2} autoComplete="new-password" /></Field>
        {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
    </AuthLayout>
  )
}

export { PasswordInput }

import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Check, ClipboardPaste, FileUp, Loader2, X } from 'lucide-react'
import type { EmploymentType, Profile, WorkArrangement } from '@/lib/types'
import { auth } from '@/lib/repo'
import { data } from '@/lib/hooks'
import { extractJdText, JD_ACCEPT } from '@/lib/jdParse'
import { cn } from '@/lib/utils'
import { Avatar, Field, Input, Segmented, Select, Textarea } from './ui'
import { useToast } from './toast'

export type ProfileDraft = Omit<Profile, 'id' | 'email' | 'onboarded_at'>

export function useUsernameCheck(username: string, original = '') {
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'taken' | 'invalid'>('idle')
  useEffect(() => {
    const u = username.trim()
    if (!u || u.toLowerCase() === original.toLowerCase()) return setState('idle')
    if (!/^[a-zA-Z0-9_.]{3,24}$/.test(u)) return setState('invalid')
    setState('checking')
    const t = setTimeout(async () => {
      try { setState((await auth.isUsernameAvailable(u)) ? 'ok' : 'taken') } catch { setState('idle') }
    }, 400)
    return () => clearTimeout(t)
  }, [username, original])
  return state
}

export function AboutFields({ value, onChange, originalUsername }: { value: ProfileDraft; onChange: (p: Partial<ProfileDraft>) => void; originalUsername?: string }) {
  const toast = useToast()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const uState = useUsernameCheck(value.username, originalUsername)

  const pickAvatar = async (f: File | undefined) => {
    if (!f) return
    if (!f.type.startsWith('image/')) return toast('Please choose an image file.', 'error')
    if (f.size > 3 * 1024 * 1024) return toast('Please choose an image under 3 MB.', 'error')
    setUploading(true)
    try { onChange({ avatar_url: await data.uploadAvatar(f) }) } catch (e) { toast((e as Error).message, 'error') } finally { setUploading(false) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar name={value.full_name || '?'} src={value.avatar_url} size={72} />
          <button type="button" onClick={() => fileRef.current?.click()} className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-teal-500 text-white shadow ring-2 ring-surface" aria-label="Upload avatar">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0])} />
        </div>
        <div className="text-sm text-muted">
          <p className="font-medium text-ink">Profile photo</p>
          <p>Optional. JPG or PNG, up to 3 MB.</p>
          {value.avatar_url && <button className="mt-1 text-xs font-medium text-red-600" onClick={() => onChange({ avatar_url: null })}>Remove</button>}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="full_name"><Input id="full_name" value={value.full_name} onChange={(e) => onChange({ full_name: e.target.value })} autoComplete="name" placeholder="Alex Morgan" /></Field>
        <Field label="Username" htmlFor="username"
          error={uState === 'taken' ? 'That username is taken' : uState === 'invalid' ? '3–24 letters, numbers, _ or .' : null}
          hint={uState === 'ok' ? <span className="inline-flex items-center gap-1 text-teal-600"><Check className="h-3.5 w-3.5" /> Available</span> : uState === 'checking' ? 'Checking…' : 'Unique across Proofwork'}>
          <div className="relative">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">@</span>
            <Input id="username" value={value.username} onChange={(e) => onChange({ username: e.target.value.replace(/\s/g, '') })} className="pl-8" autoComplete="username" placeholder="alex.morgan" />
          </div>
        </Field>
        <Field label="Job title" htmlFor="job_title"><Input id="job_title" value={value.job_title} onChange={(e) => onChange({ job_title: e.target.value })} placeholder="Intelligence & Analytics Lead" /></Field>
        <Field label="Department" htmlFor="department" optional><Input id="department" value={value.department} onChange={(e) => onChange({ department: e.target.value })} placeholder="Strategy & Insights" /></Field>
        <Field label="Manager's name" htmlFor="manager" optional hint="Used to address reports."><Input id="manager" value={value.manager_name} onChange={(e) => onChange({ manager_name: e.target.value })} /></Field>
      </div>
    </div>
  )
}

export const usernameBlocking = (s: ReturnType<typeof useUsernameCheck>) => s === 'taken' || s === 'invalid' || s === 'checking'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function WorkFields({ value, onChange }: { value: ProfileDraft; onChange: (p: Partial<ProfileDraft>) => void }) {
  const zones = useMemo(() => {
    try { return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf('timeZone') } catch { return [value.timezone] }
  }, [value.timezone])

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company" htmlFor="company"><Input id="company" value={value.company} onChange={(e) => onChange({ company: e.target.value })} autoComplete="organization" /></Field>
        <Field label="Location" htmlFor="location" optional><Input id="location" value={value.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="City, Country" /></Field>
      </div>
      <Field label="Timezone" htmlFor="tz" hint="Decides when your day starts and ends for logging.">
        <Select id="tz" value={value.timezone} onChange={(e) => onChange({ timezone: e.target.value })}>
          {zones.map((z) => <option key={z} value={z}>{z.replace(/_/g, ' ')}</option>)}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="label">Work arrangement</p>
          <Segmented<WorkArrangement> value={value.work_arrangement ?? ('' as WorkArrangement)} onChange={(v) => onChange({ work_arrangement: v })} className="w-full [&>button]:flex-1"
            options={[{ value: 'remote', label: 'Remote' }, { value: 'hybrid', label: 'Hybrid' }, { value: 'on_site', label: 'On-site' }]} />
        </div>
        <div>
          <p className="label">Employment type</p>
          <Segmented<EmploymentType> value={value.employment_type ?? ('' as EmploymentType)} onChange={(v) => onChange({ employment_type: v })} className="w-full [&>button]:flex-1"
            options={[{ value: 'full_time', label: 'Full-time' }, { value: 'part_time', label: 'Part-time' }, { value: 'contract', label: 'Contract' }]} />
        </div>
      </div>
      <div>
        <p className="label">Work days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((d, i) => {
            const on = value.work_days.includes(i)
            return (
              <button key={d} type="button" onClick={() => onChange({ work_days: on ? value.work_days.filter((x) => x !== i) : [...value.work_days, i].sort() })}
                className={cn('h-10 w-12 rounded-xl border text-sm font-semibold transition', on ? 'border-teal-500 bg-teal-500 text-white' : 'border-line bg-surface text-muted hover:text-ink')}>
                {d}
              </button>
            )
          })}
        </div>
        <p className="mt-1.5 text-sm text-muted">Days off don't break your streak or count as low activity.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Daily standup time" htmlFor="standup"><Input id="standup" type="time" value={value.standup_time} onChange={(e) => onChange({ standup_time: e.target.value })} /></Field>
        <Field label="End-of-day reminder" htmlFor="reminder"><Input id="reminder" type="time" value={value.reminder_time} onChange={(e) => onChange({ reminder_time: e.target.value })} /></Field>
      </div>
    </div>
  )
}

export function JdInput({ text, onText, fileName, onFileName }: { text: string; onText: (t: string) => void; fileName: string | null; onFileName: (n: string | null) => void }) {
  const toast = useToast()
  const [mode, setMode] = useState<'paste' | 'upload'>(fileName ? 'upload' : 'paste')
  const [parsing, setParsing] = useState(false)
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const handle = async (f: File | undefined) => {
    if (!f) return
    setParsing(true)
    try {
      const t = await extractJdText(f)
      onText(t); onFileName(f.name)
      toast(`Read ${t.split(/\s+/).length.toLocaleString()} words from ${f.name}`)
    } catch (e) { toast((e as Error).message, 'error') } finally { setParsing(false) }
  }

  return (
    <div className="space-y-4">
      <Segmented value={mode} onChange={setMode} options={[
        { value: 'paste', label: <span className="inline-flex items-center gap-1.5"><ClipboardPaste className="h-4 w-4" />Paste text</span> },
        { value: 'upload', label: <span className="inline-flex items-center gap-1.5"><FileUp className="h-4 w-4" />Upload file</span> },
      ]} />
      {mode === 'upload' && (
        <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files?.[0]) }}
          onClick={() => ref.current?.click()}
          className={cn('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
            drag ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10' : 'border-line hover:border-teal-400')}>
          {parsing ? <Loader2 className="h-8 w-8 animate-spin text-teal-500" /> : <FileUp className="h-8 w-8 text-teal-500" />}
          <p className="mt-3 font-medium">{parsing ? 'Reading your file…' : fileName ? `Loaded: ${fileName}` : 'Drop your JD here or click to browse'}</p>
          <p className="mt-1 text-sm text-muted">PDF, Word (.docx) or text, up to 10 MB</p>
          <input ref={ref} type="file" accept={JD_ACCEPT} className="hidden" onChange={(e) => handle(e.target.files?.[0])} />
        </div>
      )}
      <Field label={mode === 'upload' ? 'Extracted text (check and edit)' : 'Job description or main responsibilities'} htmlFor="jd"
        hint={`${text.trim() ? text.trim().split(/\s+/).length : 0} words`}>
        <div className="relative">
          <Textarea id="jd" value={text} onChange={(e) => { onText(e.target.value); if (mode === 'paste') onFileName(null) }} rows={mode === 'upload' ? 8 : 12}
            placeholder={'Paste your job description, or list your main responsibilities, e.g.\n• Lead analytics and business intelligence across the group\n• Build dashboards and reports for leadership\n• Automate manual processes…'} />
          {text && <button type="button" onClick={() => { onText(''); onFileName(null) }} className="absolute right-2 top-2 rounded-lg p-1 text-muted hover:text-ink" aria-label="Clear"><X className="h-4 w-4" /></button>}
        </div>
      </Field>
    </div>
  )
}

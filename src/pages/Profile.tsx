import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, KeyRound, Monitor, Moon, ShieldAlert, Sun } from 'lucide-react'
import { PageHeader } from '@/components/AppShell'
import { Button, Card, Field, Input, PageLoader, Segmented } from '@/components/ui'
import { AboutFields, JdInput, WorkFields, usernameBlocking, useUsernameCheck, type ProfileDraft } from '@/components/ProfileFields'
import { StrengthMeter } from './Auth'
import { useToast } from '@/components/toast'
import { useSession } from '@/lib/session'
import { data, useQuery } from '@/lib/hooks'
import { auth, isDemo } from '@/lib/repo'
import { checkPassword } from '@/lib/password'
import { getThemePref, setThemePref, type ThemePref } from '@/lib/theme'
import { download } from '@/lib/utils'

export default function ProfilePage() {
  const { profile, refreshProfile } = useSession()
  const toast = useToast()
  const navigate = useNavigate()
  const [p, setP] = useState<ProfileDraft | null>(null)
  const [saving, setSaving] = useState(false)
  const { data: jd } = useQuery(() => data.getCurrentJd(), [])
  const [jdText, setJdText] = useState('')
  const [jdFile, setJdFile] = useState<string | null>(null)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [theme, setTheme] = useState<ThemePref>(getThemePref())
  const uState = useUsernameCheck(p?.username ?? '', profile?.username)

  useEffect(() => {
    if (profile && !p) { const { id: _i, email: _e, onboarded_at: _o, ...rest } = profile; setP(rest) }
  }, [profile, p])
  useEffect(() => { if (jd) { setJdText(jd.jd_text); setJdFile(jd.file_name) } }, [jd])

  if (!profile || !p) return <PageLoader />
  const patch = (x: Partial<ProfileDraft>) => setP({ ...p, ...x })

  const saveProfile = async () => {
    setSaving(true)
    try { await data.saveProfile(p); await refreshProfile(); toast('Profile saved') } catch (e) { toast((e as Error).message, 'error') } finally { setSaving(false) }
  }
  const saveJd = async () => {
    await data.saveJd({ source: jdFile ? 'upload' : 'paste', file_name: jdFile, jd_text: jdText.trim() })
    toast('Job description saved. Regenerate KPIs from the KPIs page if your role changed.')
  }
  const changePw = async (e: FormEvent) => {
    e.preventDefault()
    if (!checkPassword(pw, profile.email).acceptable) return toast('Please choose a stronger password.', 'error')
    if (pw !== pw2) return toast("Passwords don't match.", 'error')
    try { await auth.updatePassword(pw); setPw(''); setPw2(''); toast('Password updated') } catch (err) { toast((err as Error).message, 'error') }
  }
  const exportData = async () => {
    const all = await data.exportAll()
    download(`proofwork-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 2), 'application/json')
  }
  const deleteAccount = async () => {
    const typed = prompt('This permanently deletes your account and all your logs, reports and KPIs. Type DELETE to confirm.')
    if (typed !== 'DELETE') return
    await data.deleteAccount(); navigate('/')
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Profile & settings" subtitle={profile.email} />

      <div className="space-y-5">
        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-5">About you</h2>
          <AboutFields value={p} onChange={patch} originalUsername={profile.username} />
        </Card>
        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-5">Work setup</h2>
          <WorkFields value={p} onChange={patch} />
        </Card>
        <div className="flex justify-end"><Button onClick={saveProfile} loading={saving} disabled={usernameBlocking(uState)}>Save profile</Button></div>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-5">Job description</h2>
          <JdInput text={jdText} onText={setJdText} fileName={jdFile} onFileName={setJdFile} />
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={() => navigate('/kpis')}>Go to KPIs</Button>
            <Button onClick={saveJd} disabled={jdText.trim().split(/\s+/).length < 15}>Save job description</Button>
          </div>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-4">Appearance</h2>
          <Segmented<ThemePref> value={theme} onChange={(t) => { setTheme(t); setThemePref(t) }} options={[
            { value: 'light', label: <span className="inline-flex items-center gap-1.5"><Sun className="h-4 w-4" />Light</span> },
            { value: 'dark', label: <span className="inline-flex items-center gap-1.5"><Moon className="h-4 w-4" />Dark</span> },
            { value: 'system', label: <span className="inline-flex items-center gap-1.5"><Monitor className="h-4 w-4" />System</span> },
          ]} />
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-1 flex items-center gap-2"><KeyRound className="h-4 w-4" />Change password</h2>
          <p className="mb-4 text-sm text-muted">If you signed in with Google or Microsoft, this sets a password for email login too.</p>
          <form onSubmit={changePw} className="grid gap-4 sm:grid-cols-2">
            <Field label="New password"><Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /><StrengthMeter password={pw} email={profile.email} /></Field>
            <Field label="Confirm"><Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
            <div className="sm:col-span-2 flex justify-end"><Button type="submit" variant="outline" disabled={!pw}>Update password</Button></div>
          </form>
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="section-title mb-1">Your data</h2>
          <p className="mb-4 text-sm text-muted">{isDemo ? 'Demo mode: your data is stored only in this browser.' : 'Stored securely in Proofwork\'s encrypted database. Only you can access your entries.'}</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportData}>Export all my data</Button>
            <Button variant="danger" icon={<ShieldAlert className="h-4 w-4" />} onClick={deleteAccount}>Delete account</Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

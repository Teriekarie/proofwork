import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/Logo'

const UPDATED = '21 October 2026'
const CONTACT = 'teriekarie@gmail.com'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-2 space-y-2 leading-relaxed text-muted [&_b]:text-ink">{children}</div>
    </section>
  )
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-line/70 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5 sm:px-6">
          <Link to="/"><Logo /></Link>
          <Link to="/signup" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />Back</Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="page-title">Privacy & data</h1>
        <p className="mt-2 text-muted">Last updated {UPDATED}. In plain words: your work log is yours, it's private, and you can take it or delete it at any time.</p>

        <Section title="Who runs Proofwork">
          <p>Proofwork is a personal project run by <b>Theresa Karamor</b>, offered free to friends and colleagues. It is not run by, or connected to, any employer. Questions or requests: <a className="font-medium text-teal-600 hover:underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.</p>
        </Section>

        <Section title="What we store">
          <p><b>Account:</b> your email, and a securely hashed password (nobody, including the owner, can see your password).</p>
          <p><b>Profile:</b> name, username, job title, company, department, location, timezone, work days and optional photo.</p>
          <p><b>Your work:</b> job description text, KPIs, daily log entries, planner tasks, standups and reports.</p>
          <p>We don't use trackers or ads, and we never sell or share your data.</p>
        </Section>

        <Section title="Who can see your work">
          <p><b>Only you.</b> The database enforces this rule itself: every row is locked to its owner, so other users can't see your entries, even by accident.</p>
          <p>If you create a <b>share link</b> for a report, anyone with that link can read <i>that one report</i>, and nothing else. You can revoke a link or set it to expire at any time.</p>
          <p>The project owner has administrator access to the database for maintenance and backups, and doesn't read users' entries.</p>
        </Section>

        <Section title="How AI is used">
          <p>When you click <b>Organise with AI</b>, generate KPIs, or create a standup or report, the relevant text is sent to <b>Anthropic's Claude API</b> to process it, and the result is sent back. Anthropic doesn't use API data to train its models. Each person has a daily limit on AI actions.</p>
          <p>Nothing is sent to the AI unless you click one of those actions. Logging and editing manually never involves AI.</p>
        </Section>

        <Section title="Where your data lives">
          <p>The database and sign-in are hosted by <b>Supabase</b> in the EU (Ireland region), encrypted in transit and at rest. The website is served by <b>Vercel</b>. Encrypted backups are kept for up to 90 days.</p>
        </Section>

        <Section title="Your controls">
          <p><b>Export:</b> Profile → <i>Export all my data</i> downloads everything as a file.</p>
          <p><b>Delete:</b> Profile → <i>Delete account</i> permanently removes your account and all your data. Copies in backups expire within 90 days.</p>
          <p><b>Correct:</b> you can edit your profile, KPIs and recent entries at any time.</p>
        </Section>

        <Section title="Important to know">
          <p>Proofwork is for <b>your own record</b> of your work. Avoid putting confidential client data, passwords or personal information about others into your log. Describe the work, not the secrets.</p>
        </Section>
      </main>
    </div>
  )
}

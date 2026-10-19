import { Link, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { Button, EmptyState, PageLoader } from '@/components/ui'
import { ReportDocument } from '@/components/ReportDocument'
import { useQuery } from '@/lib/hooks'
import { data } from '@/lib/repo'

export default function SharedReport() {
  const { token = '' } = useParams()
  const { data: shared, loading } = useQuery(() => data.getSharedReport(token), [token])

  return (
    <div className="min-h-screen bg-canvas">
      <header className="no-print border-b border-line/70 bg-surface">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3.5">
          <Logo />
          <Link to="/signup"><Button size="sm" variant="accent">Try Proofwork</Button></Link>
        </div>
      </header>
      <main className="px-4 py-8">
        {loading ? <PageLoader /> : shared ? (
          <>
            <p className="no-print mx-auto mb-4 flex max-w-3xl items-center gap-1.5 text-xs text-muted"><Lock className="h-3.5 w-3.5" />Read-only report shared by {shared.owner.full_name}</p>
            <ReportDocument report={shared.report} owner={shared.owner} />
          </>
        ) : (
          <EmptyState icon={<Lock className="h-6 w-6" />} title="This link isn't available" body="It may have expired or been revoked by its owner." />
        )}
      </main>
    </div>
  )
}

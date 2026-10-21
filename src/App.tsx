import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useSession } from './lib/session'
import { AppShell } from './components/AppShell'
import { PageLoader } from './components/ui'
import Landing from './pages/Landing'
import { ForgotPassword, Login, ResetPassword, Signup } from './pages/Auth'
import Onboarding from './pages/Onboarding'
import HomePage from './pages/Home'
import Dashboard from './pages/Dashboard'
import DailyLog from './pages/DailyLog'
import StandupPage from './pages/Standup'
import Planner from './pages/Planner'
import HistoryPage from './pages/History'
import Reports from './pages/Reports'
import Kpis from './pages/Kpis'
import Insights from './pages/Insights'
import ProfilePage from './pages/Profile'
import SharedReport from './pages/SharedReport'
import Privacy from './pages/Privacy'

function RequireAuth({ children, onboarding }: { children: ReactNode; onboarding?: boolean }) {
  const { ready, session, profile } = useSession()
  const loc = useLocation()
  if (!ready) return <div className="min-h-screen"><PageLoader /></div>
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (!profile) return <div className="min-h-screen"><PageLoader /></div>
  if (!onboarding && !profile.onboarded_at) return <Navigate to="/onboarding" replace />
  return <>{children}</>
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { ready, session, profile } = useSession()
  if (!ready) return <div className="min-h-screen"><PageLoader /></div>
  if (session && profile) return <Navigate to={profile.onboarded_at ? '/home' : '/onboarding'} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicOnly><Landing /></PublicOnly>} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/share/:token" element={<SharedReport />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/onboarding" element={<RequireAuth onboarding><Onboarding /></RequireAuth>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/home" element={<HomePage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/log" element={<DailyLog />} />
        <Route path="/standup" element={<StandupPage />} />
        <Route path="/planner" element={<Planner />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/reports/:id" element={<Reports />} />
        <Route path="/kpis" element={<Kpis />} />
        <Route path="/insights" element={<Insights />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

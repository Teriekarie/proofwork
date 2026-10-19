import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  BarChart3, CalendarCheck2, FileText, History, Home, LayoutDashboard, LogOut, Menu, Mic2, Moon, PenLine,
  Sparkles, Sun, Target, UserRound, X,
} from 'lucide-react'
import { Logo } from './Logo'
import { Avatar } from './ui'
import { useSession } from '@/lib/session'
import { auth, isDemo } from '@/lib/repo'
import { cn } from '@/lib/utils'
import { setThemePref } from '@/lib/theme'

export const NAV = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/log', label: 'Daily Log', icon: PenLine },
  { to: '/standup', label: 'Standup', icon: Mic2 },
  { to: '/planner', label: 'Planner', icon: CalendarCheck2 },
  { to: '/history', label: 'Work History', icon: History },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/kpis', label: 'KPIs', icon: Target },
  { to: '/insights', label: 'Insights', icon: Sparkles },
]

const MOBILE_TABS = [
  { to: '/home', label: 'Home', icon: Home },
  { to: '/dashboard', label: 'Dashboard', icon: BarChart3 },
  { to: '/log', label: 'Log', icon: PenLine, primary: true },
  { to: '/standup', label: 'Standup', icon: Mic2 },
]

function ThemeButton({ compact }: { compact?: boolean }) {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))
  const toggle = () => {
    const next = !dark
    setThemePref(next ? 'dark' : 'light')
    setDark(next)
  }
  return (
    <button onClick={toggle} className={cn('flex items-center gap-3 rounded-xl text-sm font-medium text-muted hover:bg-navy-50 hover:text-ink dark:hover:bg-white/5', compact ? 'p-2' : 'w-full px-3 py-2.5')}
      aria-label="Toggle dark mode">
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      {!compact && (dark ? 'Light mode' : 'Dark mode')}
    </button>
  )
}

export function AppShell() {
  const { profile } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)
  const name = profile?.full_name || profile?.email || ''

  const signOut = async () => { await auth.signOut(); navigate('/login') }

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line/70 bg-surface px-3 py-5 lg:flex">
        <NavLink to="/home" className="mb-7 px-3"><Logo /></NavLink>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => cn('group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
                isActive ? 'bg-navy-50 text-navy-700 dark:bg-white/[0.07] dark:text-white' : 'text-muted hover:bg-navy-50/60 hover:text-ink dark:hover:bg-white/5')}>
              {({ isActive }) => (<>
                {isActive && <motion.span layoutId="nav-pill" className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-teal-500" />}
                <Icon className={cn('h-[18px] w-[18px]', isActive && 'text-teal-600 dark:text-teal-400')} />{label}
              </>)}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 space-y-0.5 border-t border-line/70 pt-4">
          <ThemeButton />
          <NavLink to="/profile" className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm hover:bg-navy-50 dark:hover:bg-white/5', isActive && 'bg-navy-50 dark:bg-white/[0.07]')}>
            <Avatar name={name} src={profile?.avatar_url} size={28} />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">{profile?.full_name || 'Your profile'}</span>
              <span className="block truncate text-xs text-muted">{profile?.job_title || profile?.email}</span>
            </span>
          </NavLink>
          <button onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-navy-50 hover:text-ink dark:hover:bg-white/5">
            <LogOut className="h-[18px] w-[18px]" />Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line/70 bg-surface/90 px-4 py-3 backdrop-blur lg:hidden">
        <NavLink to="/home"><Logo /></NavLink>
        <div className="flex items-center gap-1">
          <ThemeButton compact />
          <NavLink to="/profile" aria-label="Profile"><Avatar name={name} src={profile?.avatar_url} size={32} /></NavLink>
        </div>
      </header>

      <main className="min-w-0 flex-1">
        {isDemo && (
          <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
            Demo mode: your data is saved in this browser only. Connect Supabase to sync across devices and turn on Claude AI.
          </div>
        )}
        {/* Enter-only transition: no exit phase, so a page can never be left hidden mid-animation. */}
        <motion.div key={location.pathname} initial={{ y: 6 }} animate={{ y: 0 }} transition={{ duration: 0.18 }}
          className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 sm:pt-8 lg:px-10 lg:pb-12">
          <Outlet />
        </motion.div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-line/70 bg-surface/95 pb-safe backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map(({ to, label, icon: Icon, primary }) => (
            <NavLink key={to} to={to} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-teal-600 dark:text-teal-400' : 'text-muted')}>
              {primary ? (
                <span className="-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-500 text-white shadow-lg shadow-teal-500/30"><Icon className="h-5 w-5" /></span>
              ) : <Icon className="h-5 w-5" />}
              {label}
            </NavLink>
          ))}
          <button onClick={() => setMoreOpen(true)} className="flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted">
            <Menu className="h-5 w-5" />More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-navy-950/40" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMoreOpen(false)} />
            <motion.div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-surface p-4 pb-safe shadow-lift" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', duration: 0.35, bounce: 0 }}>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">All sections</span>
                <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-muted" aria-label="Close"><X className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[...NAV, { to: '/profile', label: 'Profile', icon: UserRound }].map(({ to, label, icon: Icon }) => (
                  <NavLink key={to} to={to} onClick={() => setMoreOpen(false)}
                    className={({ isActive }) => cn('flex flex-col items-center gap-1.5 rounded-xl p-3 text-xs font-medium', isActive ? 'bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300' : 'bg-canvas text-ink')}>
                    <Icon className="h-5 w-5" />{label}
                  </NavLink>
                ))}
              </div>
              <button onClick={signOut} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-line py-3 text-sm font-medium text-muted">
                <LogOut className="h-4 w-4" />Sign out
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

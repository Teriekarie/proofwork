import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { auth, type Session } from './repo'
import { data } from './hooks'
import type { Profile } from './types'
import { DEFAULT_WORK_DAYS, guessTimezone, todayIn } from './dates'

interface Ctx {
  ready: boolean
  session: Session | null
  profile: Profile | null
  refreshProfile: () => Promise<void>
  today: string
  tz: string
  workDays: number[]
}

const SessionCtx = createContext<Ctx | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  const refreshProfile = useCallback(async () => {
    try { setProfile(await data.getProfile()) } catch { setProfile(null) }
  }, [])

  useEffect(() => {
    let alive = true
    auth.getSession().then(async (s) => {
      if (!alive) return
      setSession(s)
      if (s) await refreshProfile()
      setReady(true)
    })
    const off = auth.onAuthChange(async (s) => {
      setSession(s)
      if (s) await refreshProfile(); else setProfile(null)
    })
    return () => { alive = false; off() }
  }, [refreshProfile])

  const tz = profile?.timezone || guessTimezone()
  const [today, setToday] = useState(() => todayIn(tz))
  useEffect(() => {
    setToday(todayIn(tz))
    const id = setInterval(() => setToday(todayIn(tz)), 60_000)
    return () => clearInterval(id)
  }, [tz])

  const value = useMemo<Ctx>(() => ({
    ready, session, profile, refreshProfile, today, tz,
    workDays: profile?.work_days?.length ? profile.work_days : DEFAULT_WORK_DAYS,
  }), [ready, session, profile, refreshProfile, today, tz])

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>
}

export function useSession() {
  const c = useContext(SessionCtx)
  if (!c) throw new Error('useSession must be inside SessionProvider')
  return c
}

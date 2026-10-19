import { useCallback, useEffect, useRef, useState } from 'react'
import { data as rawData, type DataRepo } from './repo'

// Every write through `data` bumps a version so mounted queries refetch.
const listeners = new Set<() => void>()
let version = 0
export function invalidate() { version++; listeners.forEach((l) => l()) }

const WRITE = /^(save|add|update|delete|apply|archive|create|revoke|upload)/
export const data: DataRepo = new Proxy(rawData, {
  get(target, prop: keyof DataRepo) {
    const v = target[prop]
    if (typeof v !== 'function') return v
    return async (...args: unknown[]) => {
      const out = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args)
      if (WRITE.test(String(prop))) invalidate()
      return out
    }
  },
})

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; error: Error | null; reload: () => void } {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>({ data: undefined, loading: true, error: null })
  const [tick, setTick] = useState(version)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    const l = () => setTick(version)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  useEffect(() => {
    let alive = true
    setState((s) => ({ ...s, loading: true }))
    fnRef.current()
      .then((d) => alive && setState({ data: d, loading: false, error: null }))
      .catch((e: Error) => alive && setState((s) => ({ ...s, loading: false, error: e })))
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

export function useMediaQuery(q: string): boolean {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

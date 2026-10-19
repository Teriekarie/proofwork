export type ThemePref = 'light' | 'dark' | 'system'
const KEY = 'proofwork:theme'

export function getThemePref(): ThemePref {
  try { return (localStorage.getItem(KEY) as ThemePref) || 'system' } catch { return 'system' }
}

export function applyTheme(pref: ThemePref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setThemePref(pref: ThemePref) {
  try { localStorage.setItem(KEY, pref) } catch { /* ignore */ }
  applyTheme(pref)
}

export function watchSystemTheme() {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const on = () => { if (getThemePref() === 'system') applyTheme('system') }
  mq.addEventListener('change', on)
}

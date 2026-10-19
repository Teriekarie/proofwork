export interface PasswordCheck {
  score: 0 | 1 | 2 | 3 | 4
  label: 'Too weak' | 'Weak' | 'Fair' | 'Strong' | 'Very strong'
  rules: { label: string; ok: boolean }[]
  acceptable: boolean
}

const COMMON = ['password', '123456', 'qwerty', 'letmein', 'welcome', 'admin', 'iloveyou', 'monkey', 'abc123', 'proofwork']

export function checkPassword(pw: string, email = ''): PasswordCheck {
  const lower = pw.toLowerCase()
  const local = email.split('@')[0]?.toLowerCase() ?? ''
  const rules = [
    { label: 'At least 10 characters', ok: pw.length >= 10 },
    { label: 'Upper and lower case letters', ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
    { label: 'At least one number', ok: /\d/.test(pw) },
    { label: 'At least one symbol', ok: /[^A-Za-z0-9]/.test(pw) },
    {
      label: 'Not a common password or your email',
      ok: pw.length > 0 && !COMMON.some((c) => lower.includes(c)) && !(local.length >= 3 && lower.includes(local)),
    },
  ]
  const passed = rules.filter((r) => r.ok).length
  let score = Math.max(0, passed - 1) as PasswordCheck['score']
  if (pw.length >= 16 && passed >= 4) score = 4
  if (!rules[0].ok || !rules[4].ok) score = Math.min(score, 1) as PasswordCheck['score']
  const labels = ['Too weak', 'Weak', 'Fair', 'Strong', 'Very strong'] as const
  return { score, label: labels[score], rules, acceptable: rules[0].ok && rules[4].ok && score >= 2 }
}

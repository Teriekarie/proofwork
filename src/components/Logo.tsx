import { cn } from '@/lib/utils'

export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill="#1A3C5E" />
      <path d="M22 46V18h12a9 9 0 0 1 0 18h-6" fill="none" stroke="#fff" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="44" cy="44" r="5" fill="#1D9E75" />
    </svg>
  )
}

export function Logo({ className, light }: { className?: string; light?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('text-xl font-extrabold tracking-tight', light ? 'text-white' : 'text-navy-600 dark:text-white')}>
        Proof<span className="text-teal-500">work</span>
      </span>
    </span>
  )
}

import { useRef, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import { Textarea } from './ui'

const BULLET = '• '

/**
 * A textarea that keeps a bulleted list: typing into an empty box starts a bullet,
 * Enter starts the next bullet, and Enter on an empty bullet ends the list.
 * Shift+Enter inserts a plain line break; Ctrl/Cmd+Enter is left to `onSubmit`.
 */
export function BulletTextarea({ value, onValue, onSubmit, ...rest }: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onValue: (v: string) => void
  onSubmit?: () => void
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const setAndPlace = (next: string, caret: number) => {
    onValue(next)
    requestAnimationFrame(() => { const el = ref.current; if (el) { el.selectionStart = el.selectionEnd = caret } })
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter') return
    if (e.metaKey || e.ctrlKey) { e.preventDefault(); onSubmit?.(); return }
    if (e.shiftKey) return
    const el = e.currentTarget
    const { selectionStart: s, selectionEnd: end } = el
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const line = value.slice(lineStart, s)
    e.preventDefault()
    if (line.trim() === BULLET.trim()) {
      // Enter on an empty bullet: remove it and end the list.
      setAndPlace(value.slice(0, lineStart) + value.slice(end), lineStart)
      return
    }
    const insert = `\n${BULLET}`
    setAndPlace(value.slice(0, s) + insert + value.slice(end), s + insert.length)
  }

  const onChange = (next: string) => {
    // Typing into an empty box starts the first bullet (pasted multi-line text is left as is).
    if (!value && next && !next.includes('\n') && !/^\s*([-*•]|\d+[.)])\s/.test(next)) {
      setAndPlace(BULLET + next, BULLET.length + next.length)
      return
    }
    onValue(next)
  }

  return <Textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={onKeyDown} {...rest} />
}

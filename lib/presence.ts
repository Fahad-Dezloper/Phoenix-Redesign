import { useEffect, useState } from 'react'
// Keeps an element mounted for `ms` after `open` goes false so its exit animation can play (radix Presence equivalent).
export function usePresence(open: boolean, ms = 150) {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [open, ms])
  return { mounted: open || mounted, state: (open ? 'open' : 'closed') as 'open' | 'closed' }
}

// Escape closes an open popover, like every Radix popover on the real site.
export function useEscape(open: boolean, close: () => void) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, close])
}

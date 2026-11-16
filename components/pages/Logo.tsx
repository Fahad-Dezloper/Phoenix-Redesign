'use client'
import { useEffect, useRef, useState } from 'react'
import { logo } from '@/lib/data'
// market logo with a lettered fallback for symbols that have no bundled svg (also catches errors that fire before hydration)
export default function Logo({ sym, size = 20, cls }: { sym: string; size?: number; cls?: string }) {
  const [bad, setBad] = useState(false), r = useRef<HTMLImageElement>(null)
  useEffect(() => { const i = r.current; if (i && i.complete && i.naturalWidth === 0) setBad(true) }, [])
  const st = { width: size, height: size, borderRadius: '50%', flex: 'none' as const }
  if (bad) return <span className={cls} style={{ ...st, display: 'inline-grid', placeItems: 'center', background: 'hsl(var(--muted))', color: 'hsl(var(--foreground))', font: `600 ${Math.round(size * 0.5)}px/1 var(--font)` }}>{sym[0]}</span>
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={r} className={cls} src={logo(sym)} alt="" style={st} onError={() => setBad(true)} />
}

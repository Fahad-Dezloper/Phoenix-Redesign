'use client'
// Leverage control (v2): small square stops (1x, 5x, 10x, max) with long bricks between them for the ranges in between.
// The bricks are equal width, so the low leverage people use most gets the most room. Drag, click, scroll or use the keys.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

type Tier = 'ok' | 'mid' | 'bad'
type Part = { k: 'a'; v: number } | { k: 'b'; lo: number; hi: number }
const NAME: Record<Tier, string> = { ok: 'Low', mid: 'Medium', bad: 'High' }

export default function LevBar({ value, max, tierOf, onChange }: { value: number; max: number; tierOf: (lev: number) => Tier; onChange: (lev: number) => void }) {
  // stops: 1x, 5x, 10x and the market's max (whichever exist)
  const parts = useMemo<Part[]>(() => {
    const A = Array.from(new Set([1, 5, 10, max].filter(x => x >= 1 && x <= max))).sort((a, b) => a - b)
    const out: Part[] = []
    A.forEach((v, i) => { out.push({ k: 'a', v }); const n = A[i + 1]; if (n !== undefined && n - v > 1) out.push({ k: 'b', lo: v + 1, hi: n - 1 }) })
    return out
  }, [max])
  const box = useRef<HTMLDivElement>(null), els = useRef<(HTMLElement | null)[]>([]), tip = useRef<HTMLSpanElement>(null)
  const [hov, setHov] = useState<number | null>(null), [drag, setDrag] = useState(false), [, setLay] = useState(0)
  useLayoutEffect(() => { setLay(x => x + 1) }, [max]) // measure once laid out so labels and the bubble line up
  // keep the hover bubble inside the bar: the 1x and max bubbles would otherwise stick out past the card edges
  useLayoutEffect(() => { const b = box.current, e = tip.current; if (!b || !e || hov === null) return; const w = e.offsetWidth, W = b.clientWidth, x = xOf(hov); e.style.left = Math.min(Math.max(x, w / 2), W - w / 2) + 'px' }, [hov]) // eslint-disable-line react-hooks/exhaustive-deps
  const clamp = (v: number) => Math.min(max, Math.max(1, Math.round(v)))
  const frac = (p: { lo: number; hi: number }, v: number) => Math.min(1, Math.max(0, (v - p.lo + 1) / (p.hi - p.lo + 1)))

  // pointer → leverage: on a stop it is that stop; on a brick it is the step under the pointer; in a gap, the nearest piece
  const at = (x: number) => {
    let best = -1, bd = Infinity
    els.current.forEach((e, i) => { if (!e) return; const r = e.getBoundingClientRect(); const d = x < r.left ? r.left - x : x > r.right ? x - r.right : 0; if (d < bd) { bd = d; best = i } })
    const p = parts[best], r = els.current[best]!.getBoundingClientRect()
    if (p.k === 'a') return p.v
    const n = p.hi - p.lo + 1, f = Math.min(1, Math.max(0, (x - r.left) / r.width))
    return Math.min(p.hi, Math.max(p.lo, p.lo + Math.ceil(f * n) - 1))
  }
  // x position (px, inside the bar) of a leverage value, for labels and the bubble
  const xOf = (v: number) => {
    const b = box.current; if (!b) return 0
    const r0 = b.getBoundingClientRect()
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i], e = els.current[i]; if (!e) continue
      const r = e.getBoundingClientRect()
      if (p.k === 'a' && p.v === v) return r.left - r0.left + r.width / 2
      if (p.k === 'b' && v >= p.lo && v <= p.hi) return r.left - r0.left + r.width * frac(p, v)
    }
    return 0
  }
  const set = (v: number) => { const l = clamp(v); if (l !== value) onChange(l) }
  // wheel changes leverage without scrolling the form (needs a non-passive listener)
  const live = useRef({ value, set }); live.current = { value, set }
  useEffect(() => { const b = box.current; if (!b) return; const w = (e: WheelEvent) => { e.preventDefault(); live.current.set(live.current.value + (e.deltaY > 0 ? -1 : 1)) }; b.addEventListener('wheel', w, { passive: false }); return () => b.removeEventListener('wheel', w) }, [])
  const stops = parts.filter((p): p is { k: 'a'; v: number } => p.k === 'a').map(p => p.v)

  return (
    <div className="lvb">
      <div ref={box} className={`lvb-bar${drag ? ' drag' : ''}${hov !== null ? ' hov' : ''}`} tabIndex={0} role="slider" aria-label="Leverage" aria-valuemin={1} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value}x, ${NAME[tierOf(value)]} risk`}
        onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); setDrag(true); const v = at(e.clientX); setHov(v); set(v) }}
        onPointerMove={e => { const v = at(e.clientX); setHov(v); if (drag) set(v) }}
        onPointerUp={() => setDrag(false)} onPointerCancel={() => setDrag(false)} onPointerLeave={() => { if (!drag) setHov(null) }}
        onKeyDown={e => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(value + 1) }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(value - 1) }
          if (e.key === 'Home') { e.preventDefault(); set(1) }
          if (e.key === 'End') { e.preventDefault(); set(max) }
        }}>
        {parts.map((p, i) => {
          if (p.k === 'a') return <i key={'a' + p.v} ref={el => { els.current[i] = el }} className={`lvb-a${p.v <= value ? ' on' : ''}${p.v === value ? ' cur' : ''}`} style={{ ['--bc' as string]: `var(--lt-${tierOf(p.v)})` }} />
          const f = value > p.hi ? 1 : value < p.lo ? 0 : frac(p, value)
          const g = hov !== null && hov > value ? (hov > p.hi ? 1 : hov < p.lo ? 0 : frac(p, hov)) : 0
          const inIt = value >= p.lo && value <= p.hi
          return (
            <div key={'b' + p.lo} ref={el => { els.current[i] = el }} className={`lvb-b${inIt ? ' cur' : ''}`} style={{ ['--bc' as string]: `var(--lt-${tierOf(Math.min(Math.max(value, p.lo), p.hi))})` }}>
              <span className="g" style={{ transform: `scaleX(${Math.max(f, g)})` }} />
              <span className="f" style={{ transform: `scaleX(${f})` }} />
              {inIt && <span className="e" style={{ left: `${f * 100}%` }} />}
            </div>
          )
        })}
        {hov !== null && <span ref={tip} className="lvb-tip num" style={{ left: xOf(hov) }}>{hov}x · {NAME[tierOf(hov)]}</span>}
      </div>
      <div className="lvb-labs">{stops.map((v, i) => <button key={v} type="button" tabIndex={-1} className={`${v === value ? 'on ' : ''}lt-${tierOf(v)}`} style={i === 0 ? { left: 0, transform: 'none' } : i === stops.length - 1 ? { left: 'auto', right: 0, transform: 'none' } : { left: xOf(v) }} onClick={() => set(v)}>{v}x</button>)}</div>
    </div>
  )
}

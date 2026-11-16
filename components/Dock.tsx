'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/store'

// v2: the four page links live in a floating dock. A pill slides to the active link.
// Drag it by the grip dots, the padding, or any link (press and move). It follows the pointer exactly and stays where it is dropped.
// Smart guides, like a design canvas: it snaps to the horizontal centre, the left / right margins, the middle of the window,
// the middle of the top bar and its home spot above the footer, and draws a guide line while it is snapped. Hold Alt to drag without snapping.
const KEY = 'phx-v2-dock3'
const BOTTOM = 46 // home position: just above the footer
const NAV_C = 28 // vertical centre of the 56px top bar (the dock can sit inside it, centred)
const EDGE = 12 // margin used by the left / right snap lines
const SNAP = 10 // px
const clamp = (n: number, a: number, b: number) => Math.min(Math.max(n, a), Math.max(a, b))

type AX = 'c' | 'l' | 'r' | number // number = fraction of the window width
type AY = 'nav' | 'mid' | 'home' | number // number = fraction of the window height
type Pos = { x: AX; y: AY } | null // dock centre; null = home (bottom centre)
type Guide = { x: number | null; y: number | null; label: string }

export default function Dock() {
  const path = usePathname()
  const { signedIn, ghost, sym } = useApp()
  const active = signedIn || !!ghost
  const on = (p: string) => (p === '/' ? !['/portfolio', '/rewards', '/leaderboard', '/markets'].some(x => path.startsWith(x)) : path.startsWith(p))
  const items = [
    { href: '/' + sym, label: 'Trade', m: '/', off: false, dot: false },
    { href: '/portfolio', label: 'Portfolio', m: '/portfolio', off: !active, dot: false },
    { href: '/rewards', label: 'Rewards', m: '/rewards', off: !!ghost, dot: !ghost },
    { href: '/leaderboard', label: 'Leaderboard', m: '/leaderboard', off: false, dot: false },
  ]
  const idx = items.findIndex(i => on(i.m))
  const root = useRef<HTMLElement>(null), refs = useRef<(HTMLAnchorElement | null)[]>([])
  const [pos, setPos] = useState<Pos>(null)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const [guide, setGuide] = useState<Guide | null>(null)
  const [view, setView] = useState({ w: 1440, h: 900 }), [size, setSize] = useState({ w: 400, h: 42 })
  const [pill, setPill] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const gesture = useRef<{ px: number; py: number; cx: number; cy: number; moved: boolean } | null>(null)
  const justDragged = useRef(false)

  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.x !== undefined && v.y !== undefined) setPos(v) } catch { /* ignore */ } }, [])
  const save = (p: Pos) => { setPos(p); try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY) } catch { /* ignore */ } }

  const measure = () => {
    const el = refs.current[idx], r = root.current
    setPill(el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight } : null)
    if (r) setSize(s => (s.w === r.offsetWidth && s.h === r.offsetHeight ? s : { w: r.offsetWidth, h: r.offsetHeight }))
    setView(v => (v.w === innerWidth && v.h === innerHeight ? v : { w: innerWidth, h: innerHeight }))
  }
  useLayoutEffect(measure, [idx, sym, signedIn, ghost]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure) }) // eslint-disable-line react-hooks/exhaustive-deps

  const { w, h } = size, vw = view.w, vh = view.h
  const xOf = (a: AX) => (a === 'c' ? vw / 2 : a === 'l' ? EDGE + w / 2 : a === 'r' ? vw - EDGE - w / 2 : a * vw)
  const yOf = (a: AY) => (a === 'nav' ? NAV_C : a === 'mid' ? vh / 2 : a === 'home' ? vh - BOTTOM - h / 2 : a * vh)
  // anywhere in the window, including the top bar, so it can sit above the strip
  const limit = (x: number, y: number) => ({ x: clamp(x, w / 2 + 8, vw - w / 2 - 8), y: clamp(y, 4 + h / 2, vh - 8 - h / 2) })
  const centre = pos ? limit(xOf(pos.x), yOf(pos.y)) : limit(vw / 2, yOf('home'))
  const c = drag ?? centre

  // snap a raw centre to the guides (unless Alt is held)
  const snap = (rx: number, ry: number, alt: boolean) => {
    const p = limit(rx, ry)
    let ax: AX = p.x / vw, ay: AY = p.y / vh, gx: number | null = null, gy: number | null = null, lx = '', ly = ''
    if (!alt) {
      const xs: [number, AX, number, string][] = [[vw / 2, 'c', vw / 2, 'centre'], [EDGE + w / 2, 'l', EDGE, 'left edge'], [vw - EDGE - w / 2, 'r', vw - EDGE, 'right edge']]
      const ys: [number, AY, number, string][] = [[vh / 2, 'mid', vh / 2, 'middle'], [NAV_C, 'nav', NAV_C, 'top bar'], [yOf('home'), 'home', vh - BOTTOM, 'bottom']]
      const bx = xs.filter(s => Math.abs(s[0] - p.x) <= SNAP).sort((a, b) => Math.abs(a[0] - p.x) - Math.abs(b[0] - p.x))[0]
      const by = ys.filter(s => Math.abs(s[0] - p.y) <= SNAP).sort((a, b) => Math.abs(a[0] - p.y) - Math.abs(b[0] - p.y))[0]
      if (bx) { p.x = bx[0]; ax = bx[1]; gx = bx[2]; lx = bx[3] }
      if (by) { p.y = by[0]; ay = by[1]; gy = by[2]; ly = by[3] }
    }
    // name what it is aligned to, like a design canvas
    const label = lx === 'centre' && ly === 'middle' ? 'Centre' : lx === 'centre' && ly === 'top bar' ? 'Top centre' : lx === 'centre' && ly === 'bottom' ? 'Bottom centre' : lx === 'centre' ? 'Centred horizontally' : ly === 'middle' ? 'Centred vertically' : ly === 'top bar' ? 'Top bar centre' : ly === 'bottom' ? 'Bottom margin' : lx ? lx[0].toUpperCase() + lx.slice(1) : ''
    return { p, pos: { x: ax, y: ay } as NonNullable<Pos>, guide: gx !== null || gy !== null ? { x: gx, y: gy, label } : null }
  }

  const onDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    gesture.current = { px: e.clientX, py: e.clientY, cx: centre.x, cy: centre.y, moved: false }
    const move = (ev: PointerEvent) => {
      const g = gesture.current; if (!g) return
      const dx = ev.clientX - g.px, dy = ev.clientY - g.py
      if (!g.moved && Math.hypot(dx, dy) < 4) return
      if (!g.moved) { g.moved = true; document.body.style.userSelect = 'none'; document.body.style.cursor = 'grabbing' }
      const s = snap(g.cx + dx, g.cy + dy, ev.altKey) // keeps the spot you grabbed under the pointer
      setDrag(s.p); setGuide(s.guide)
    }
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      const g = gesture.current; gesture.current = null
      document.body.style.userSelect = ''; document.body.style.cursor = ''
      if (!g?.moved) return
      justDragged.current = true; setTimeout(() => { justDragged.current = false }, 0)
      const s = snap(g.cx + (ev.clientX - g.px), g.cy + (ev.clientY - g.py), ev.altKey)
      setDrag(null); setGuide(null)
      if (s.pos.x === 'c' && s.pos.y === 'home') save(null)
      else save({ x: typeof s.pos.x === 'number' ? +s.pos.x.toFixed(5) : s.pos.x, y: typeof s.pos.y === 'number' ? +s.pos.y.toFixed(5) : s.pos.y })
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }

  return (
    <>
      {drag && guide && (
        <div className="dock-guides" aria-hidden>
          {guide.x !== null && <i className="gl v" style={{ left: guide.x }} />}
          {guide.y !== null && <i className="gl h" style={{ top: guide.y }} />}
          {guide.label && <b className="gt" style={{ left: c.x, top: Math.max(6, c.y - h / 2 - 30) }}>{guide.label}</b>}
        </div>
      )}
      <nav ref={root} className={`dock${drag ? ' dragging' : ''}`} aria-label="Pages" style={{ left: c.x, top: c.y }}
        onPointerDown={onDown} onClickCapture={e => { if (justDragged.current) { e.preventDefault(); e.stopPropagation() } }} onDoubleClick={e => { if (e.target === e.currentTarget) save(null) }}>
        <span className="dock-h l" title="Drag to move" aria-hidden><i /><i /><i /><i /><i /></span>
        {pill && <i className="dock-pill" style={{ width: pill.w, height: pill.h, transform: `translate(${pill.x}px,${pill.y}px)` }} />}
        {items.map((i, k) => (
          <Link key={i.label} ref={el => { refs.current[k] = el }} href={i.href} draggable={false} className={`${k === idx ? 'on ' : ''}${i.off ? 'off' : ''}`} aria-current={k === idx ? 'page' : undefined}>
            {i.label}{i.dot && <b className="rdot" />}
          </Link>
        ))}
        <span className="dock-h r" title="Drag to move" aria-hidden><i /><i /><i /><i /><i /></span>
      </nav>
    </>
  )
}

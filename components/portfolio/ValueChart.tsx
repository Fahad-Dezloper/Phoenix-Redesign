'use client'
// Portfolio chart: account value (area), cumulative PnL (area) or daily PnL (bars). Plain SVG, history synthesised from the account.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Account } from '@/lib/account'
import { fmt } from '@/lib/data'
import { useApp } from '@/lib/store'

export type ChartTab = 'Value' | 'Cumulative PnL' | 'Daily PnL'
export const RANGES = ['1 Day', '1 Week', '1 Month', 'YTD', '1 Year', 'All Time'] as const
export type Range = (typeof RANGES)[number]
type Pt = { t: number; v: number }
type Mk = { t: number; buy: boolean }
const DAY = 864e5

function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) }
function interp(pts: Pt[], t: number) {
  if (!pts.length) return 0
  if (t <= pts[0].t) return pts[0].v
  if (t >= pts[pts.length - 1].t) return pts[pts.length - 1].v
  let lo = 0, hi = pts.length - 1
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].t <= t) lo = m; else hi = m }
  const a = pts[lo], b = pts[hi]
  return a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t || 1)
}
export function rangeMs(r: Range, acct: Account) {
  const now = Date.now()
  if (r === '1 Day') return DAY
  if (r === '1 Week') return 7 * DAY
  if (r === '1 Month') return 30 * DAY
  if (r === 'YTD') return now - new Date(new Date().getFullYear(), 0, 1).getTime()
  if (r === '1 Year') return 365 * DAY
  const first = acct.dw.length ? Math.min(...acct.dw.map(d => d.t)) : now - 7 * DAY
  return acct.ghost ? 90 * DAY : Math.max(DAY, (now - first) * 1.3)
}

// build the value series for a range
export function buildSeries(acct: Account, range: number): { pts: Pt[]; marks: Mk[] } {
  const now = Date.now(), t0 = now - range, N = 240
  const eq = acct.eq
  const pts: Pt[] = []
  if (acct.ghost) {
    const rnd = rng(acct.addr.length * 977 + acct.addr.charCodeAt(0))
    const e0 = eq.length ? eq[0] : { t: now - 7 * DAY, v: acct.equity }
    const vol = acct.equity * 0.011
    // backwards walk before known history
    const pre: Pt[] = []; let v = e0.v
    for (let t = e0.t - range / N; t >= t0 - range / N; t -= range / N) { v += (rnd() - 0.5) * vol * Math.sqrt(Math.max(1, range / N / 36e5)); pre.unshift({ t, v: Math.max(acct.equity * 0.4, v) }) }
    const all = [...pre, ...eq, { t: now, v: acct.equity }]
    for (let i = 0; i < N; i++) { const t = t0 + (i * range) / (N - 1); pts.push({ t, v: interp(all, t) + (i === N - 1 ? 0 : (rnd() - 0.5) * acct.equity * 0.006) }) }
  } else {
    const first = acct.dw.length ? Math.min(...acct.dw.map(d => d.t)) : now
    const base = eq.length ? eq[0].v : acct.equity
    const known: Pt[] = [...eq, { t: now, v: acct.equity }]
    for (let i = 0; i < N; i++) {
      const t = t0 + (i * range) / (N - 1)
      pts.push({ t, v: t < first ? 0 : t < (eq[0]?.t ?? now) ? base : interp(known, t) })
    }
    if (first > t0 && first < now) { pts.push({ t: first - 1, v: 0 }, { t: first, v: base }); pts.sort((a, b) => a.t - b.t) }
  }
  const marks: Mk[] = []
  if (acct.ghost) {
    const rnd = rng(123 + acct.addr.charCodeAt(1))
    for (let i = 0; i < 13; i++) marks.push({ t: now - rnd() * 5.2 * DAY, buy: rnd() > 0.45 })
  } else {
    acct.dw.forEach(d => marks.push({ t: d.t, buy: d.kind === 'Deposit' }))
    acct.fills.forEach(f => marks.push({ t: f.t, buy: f.kind === 'Open Long' || f.kind === 'Close Short' }))
  }
  return { pts, marks: marks.filter(m => m.t >= t0) }
}

// one series per (account, range, 5s bucket): the chart and the headline number share it instead of each rebuilding 240 points on every tick
const SCM = new Map<string, { pts: Pt[]; marks: Mk[] }>()
export function seriesFor(acct: Account, range: number) {
  const key = [acct.addr, acct.ghost ? 1 : 0, range, Math.floor(Date.now() / 5000), acct.eq.length, acct.dw.length, acct.fills.length].join('|')
  const hit = SCM.get(key)
  if (hit) return hit
  const v = buildSeries(acct, range)
  if (SCM.size > 12) SCM.clear()
  SCM.set(key, v)
  return v
}

const nice = (lo: number, hi: number, n = 5) => {
  const span = hi - lo || 1, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? mag * 10
  const a = Math.floor(lo / step) * step, out: number[] = []
  for (let v = a; v <= hi + step * 0.999; v += step) out.push(+v.toFixed(8))
  return out
}
const axis = (v: number) => (Math.abs(v) >= 1e6 ? '$' + +(v / 1e6).toFixed(2) + 'M' : Math.abs(v) >= 1e3 ? (v < 0 ? '-' : '') + '$' + +(Math.abs(v) / 1e3).toFixed(1).replace(/\.0$/, '') + 'K' : v === 0 ? '$0' : (v < 0 ? '-$' : '$') + Math.abs(v).toFixed(2))
const p2 = (n: number) => String(n).padStart(2, '0')
function xticks(t0: number, t1: number, range: number): { t: number; l: string }[] {
  const out: { t: number; l: string }[] = []
  if (range <= 1.5 * DAY) {
    const d = new Date(t0); d.setMinutes(0, 0, 0)
    for (let t = d.getTime() + 36e5; t < t1; t += 36e5) if (new Date(t).getHours() % 4 === 0) out.push({ t, l: p2(new Date(t).getHours()) + ':00' })
  } else if (range <= 45 * DAY) {
    const d = new Date(t0); d.setHours(0, 0, 0, 0)
    const stepD = range <= 8 * DAY ? 1 : 5
    for (let t = d.getTime() + DAY; t < t1; t += DAY) { const x = new Date(t); if (stepD === 1 || (x.getDate() - 1) % stepD === 0) out.push({ t, l: `${p2(x.getMonth() + 1)}/${p2(x.getDate())}` }) }
  } else {
    const d = new Date(t0); d.setDate(1); d.setHours(0, 0, 0, 0)
    const stepM = range > 500 * DAY ? 3 : range > 150 * DAY ? 2 : 1
    for (let x = new Date(d.getFullYear(), d.getMonth() + 1, 1); x.getTime() < t1; x = new Date(x.getFullYear(), x.getMonth() + stepM, 1)) out.push({ t: x.getTime(), l: x.toLocaleString('en-US', { month: 'short' }) + (x.getMonth() === 0 ? " '" + String(x.getFullYear()).slice(2) : '') })
  }
  return out
}
// a placeholder with the chart's own frame (gridlines, right axis, x labels) so nothing moves when the data arrives
export function ChartSkel() {
  return (
    <div className="pf-chart pf-chartsk" aria-busy="true" aria-label="Loading chart">
      {[0, 1, 2, 3, 4].map(i => <div key={i} className="gl" style={{ top: `${(i / 4) * 86 + 3}%` }}><span className="skel" /></div>)}
      <svg className="wave" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden><path d="M0 30 C10 28 14 22 22 24 S36 30 44 20 S58 14 66 18 S82 8 100 6 L100 40 L0 40Z" /></svg>
    </div>
  )
}
const MONEY = (v: number) => (v < 0 ? '-$' : '$') + fmt(Math.abs(v))

export default function ValueChart({ acct, tab, range }: { acct: Account; tab: ChartTab; range: Range }) {
  const { v2 } = useApp()
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 300 })
  const [busy, setBusy] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const rms = rangeMs(range, acct)
  useEffect(() => {
    const el = box.current; if (!el) return
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight })); ro.observe(el)
    setSize({ w: el.clientWidth, h: el.clientHeight }); return () => ro.disconnect()
  }, [])
  // PnL views fetch separately in the real app: show the skeleton the first time a view is opened, not again for one that is already loaded
  const loaded = useRef(new Set<string>())
  useEffect(() => {
    const k = tab + '|' + range + '|' + acct.addr
    if (tab === 'Value' || loaded.current.has(k)) { setBusy(false); return }
    setBusy(true); const id = setTimeout(() => { loaded.current.add(k); setBusy(false) }, 900); return () => clearTimeout(id)
  }, [tab, range, acct.addr])

  const { pts, marks } = seriesFor(acct, rms) // refreshes the live end-point every few seconds

  const W = size.w, H = size.h, AX = 72, PB = 28, PT = 10
  const cw = Math.max(10, W - AX), ch = Math.max(10, H - PB - PT)
  const t0 = pts[0].t, t1 = pts[pts.length - 1].t
  // keep x labels at least ~54px apart so a narrow card never prints them on top of each other
  const thin = <T,>(a: T[], px: (v: T) => number) => { let last = -1e9; return a.filter(v => { const p = px(v); if (p - last < 54) return false; last = p; return true }) }

  // series for the selected tab
  const flows = (t: number) => acct.ghost ? 0 : acct.dw.filter(d => d.t <= t).reduce((a, d) => a + d.amount, 0)
  const line = useMemo(() => tab === 'Cumulative PnL' ? pts.map(p => ({ t: p.t, v: acct.ghost ? p.v - pts[0].v : p.v - flows(p.t) })) : pts, [tab, pts, acct.ghost, acct.dw]) // eslint-disable-line react-hooks/exhaustive-deps
  const bars = useMemo(() => {
    if (tab !== 'Daily PnL') return []
    const n = range === '1 Week' ? 7 : range === '1 Month' ? 30 : Math.min(12, Math.max(2, Math.round(rms / (30 * DAY))))
    const end = new Date(); end.setHours(0, 0, 0, 0); const step = range === '1 Week' || range === '1 Month' ? DAY : rms / n
    const eT = end.getTime() - (range === '1 Week' || range === '1 Month' ? 0 : -DAY)
    const out: { t: number; v: number; l: string }[] = []
    for (let i = 0; i < n; i++) {
      const b1 = eT - (n - 1 - i) * step - (range === '1 Week' || range === '1 Month' ? DAY : 0), b0 = b1 - step
      const raw = interp(pts, b1) - interp(pts, b0), flow = acct.ghost ? 0 : flows(b1) - flows(b0)
      const d = new Date(b0 + step / 2)
      out.push({ t: b0, v: raw - flow, l: step >= 20 * DAY ? d.toLocaleString('en-US', { month: 'short' }) : `${p2(d.getMonth() + 1)}/${p2(d.getDate())}` })
    }
    return out
  }, [tab, range, pts, acct.ghost]) // eslint-disable-line react-hooks/exhaustive-deps

  const vals = tab === 'Daily PnL' ? bars.map(b => b.v) : line.map(p => p.v)
  const fit = !!acct.ghost || v2 // v2 (like Ghost Mode) fits the value line to the data instead of always starting at $0, so movement is visible
  let lo = Math.min(...vals, tab === 'Value' ? Infinity : 0), hi = Math.max(...vals, tab === 'Value' ? -Infinity : 0)
  if (tab === 'Value') { if (fit) { const pad = (hi - lo) * 0.08; lo -= pad; hi += pad } else { lo = Math.min(0, lo); hi = Math.max(hi, 0.0001) } }
  if (hi - lo < 1e-9) { hi = lo + 1 }
  const ticks = nice(lo, hi, fit ? 4 : 5), yl = Math.min(ticks[0], lo), yh = Math.max(ticks[ticks.length - 1], hi)
  const y = (v: number) => PT + ch - ((v - yl) / (yh - yl)) * ch
  const x = (t: number) => ((t - t0) / (t1 - t0)) * cw
  const path = line.map((p, i) => (i ? 'L' : 'M') + x(p.t).toFixed(1) + ' ' + y(p.v).toFixed(1)).join('')
  const last = line[line.length - 1]
  const gid = 'pfg' + tab.length

  const onMove = (e: React.MouseEvent) => {
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), px = e.clientX - r.left
    if (px < 0 || px > cw) { setHover(null); return }
    setHover(px)
  }
  let tip: { x: number; y: number; a: string; b: string } | null = null
  if (hover != null) {
    if (tab === 'Daily PnL') {
      const bw = cw / bars.length, i = Math.min(bars.length - 1, Math.floor(hover / bw)), b = bars[i]
      if (b) tip = { x: i * bw + bw / 2, y: y(Math.max(b.v, 0)), a: (b.v < 0 ? '-$' : '+$') + fmt(Math.abs(b.v)), b: b.l }
    } else {
      const t = t0 + (hover / cw) * (t1 - t0), v = interp(line, t), d = new Date(t)
      tip = { x: hover, y: y(v), a: tab === 'Value' ? MONEY(v) : (v < 0 ? '-$' : '+$') + fmt(Math.abs(v)), b: `${p2(d.getMonth() + 1)}/${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}` }
    }
  }

  return (
    <div className="pf-chart" ref={box} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      {busy ? <ChartSkel /> : (
        <svg width={W} height={H}>
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="hsl(27 96% 61%)" stopOpacity=".38" /><stop offset="1" stopColor="hsl(27 96% 61%)" stopOpacity="0" /></linearGradient></defs>
          {ticks.map(v => <g key={v}><line x1={0} x2={cw} y1={y(v)} y2={y(v)} stroke="hsl(218 23% 23%)" strokeOpacity={tab === 'Daily PnL' && v === 0 ? 0.9 : 0.55} strokeDasharray={tab === 'Daily PnL' && v === 0 ? '3 3' : undefined} /><text x={cw + 12} y={y(v) + 4}>{axis(v)}</text></g>)}
          {tab === 'Value' && thin(xticks(t0, t1, rms), k => x(k.t)).map(k => <text key={k.t} x={x(k.t)} y={H - 6} textAnchor="middle">{k.l}</text>)}
          {tab === 'Cumulative PnL' && thin(xticks(t0, t1, rms), k => x(k.t)).map(k => <text key={k.t} x={x(k.t)} y={H - 6} textAnchor="middle">{k.l}</text>)}
          {tab === 'Daily PnL' && bars.map((b, i) => { const bw = cw / bars.length, w = Math.min(bw * 0.58, 56), cx = i * bw + bw / 2; return (
            <g key={i}><rect x={cx - w / 2} width={w} y={b.v >= 0 ? y(b.v) : y(0)} height={Math.max(1, Math.abs(y(b.v) - y(0)))} rx={2} fill={b.v >= 0 ? 'hsl(142 42% 44%)' : 'hsl(0 45% 52%)'} />{(i % Math.max(1, Math.ceil(54 / (cw / bars.length)))) === 0 && <text x={cx} y={H - 6} textAnchor="middle">{b.l}</text>}</g>) })}
          {tab !== 'Daily PnL' && <>
            <path d={path + `L${x(t1)} ${y(Math.max(yl, Math.min(0, yh)))}L0 ${y(Math.max(yl, Math.min(0, yh)))}Z`} fill="none" />
            <path d={path} fill="none" stroke="hsl(27 96% 61%)" strokeWidth={1.5} strokeLinejoin="round" />
            {tab === 'Value' && marks.map((m, i) => { const cx = x(m.t), cy = y(interp(line, m.t)), c = m.buy ? 'hsl(142 69% 52%)' : 'hsl(0 80% 62%)'; return (
              <g key={i}><circle cx={cx} cy={cy} r={6} fill={c} stroke="hsl(240 6% 10%)" strokeWidth={1.5} /><path d={m.buy ? `M${cx - 3} ${cy}H${cx + 3}M${cx} ${cy - 3}V${cy + 3}` : `M${cx - 3} ${cy}H${cx + 3}`} stroke="#fff" strokeWidth={1.5} strokeLinecap="round" /></g>) })}
          </>}
          {tip && <><line x1={tip.x} x2={tip.x} y1={PT} y2={PT + ch} stroke="hsl(215 25% 65%)" strokeOpacity={0.35} strokeDasharray="3 3" />{tab !== 'Daily PnL' && <circle cx={tip.x} cy={tip.y} r={4} fill="hsl(27 96% 61%)" stroke="hsl(240 6% 10%)" strokeWidth={2} />}</>}
        </svg>
      )}
      {!busy && tip && <div className="pf-tip" style={{ left: Math.min(tip.x + 12, cw - 110), top: Math.max(0, tip.y - 44) }}>{tip.a}<span>{tip.b}</span></div>}
    </div>
  )
}

export function seriesSummary(acct: Account, tab: ChartTab, range: Range) {
  const { pts } = seriesFor(acct, rangeMs(range, acct))
  if (tab === 'Value') return { total: acct.equity, delta: acct.equity - pts[0].v }
  const pnl = acct.ghost ? acct.equity - pts[0].v : acct.equity - acct.deposited + acct.withdrawn
  return { total: pnl, delta: pnl }
}

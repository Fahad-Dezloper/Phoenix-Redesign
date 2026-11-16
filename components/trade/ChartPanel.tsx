'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, Expand, GitCompareArrows, Minimize2, Settings, X } from 'lucide-react'
import { TvIcon } from '@/components/icons/Phx'
import { E } from '@/lib/sim'
import { price as fp } from '@/lib/data'
import { useApp } from '@/lib/store'
import { useTpsl, useOrderCalc } from './OrderForm'
import { usePresence, useEscape } from '@/lib/presence'

const TFS = ['1m', '5m', '15m', '1h', '4h']
const MORE = ['30m', '2h', '12h', '1D', '1W']
const TF_MS: Record<string, number> = { '1m': 6e4, '5m': 3e5, '15m': 9e5, '30m': 18e5, '1h': 36e5, '2h': 72e5, '4h': 144e5, '12h': 432e5, '1D': 864e5, '1W': 6048e5 }
const RANGES: [string, number][] = [['1d', 30], ['5d', 55], ['1m', 80], ['3m', 110], ['1y', 140]]
const UP0 = '#4ADE80', DN0 = '#F65A5A', AX0 = '#8896AC', GRID0 = 'rgba(148,163,184,0.04)'
const INDS = ['Moving Average', 'EMA', 'Bollinger Bands', 'Volume']
// v2 compare lines: one accent, one neutral light (never buy/sell). cmpCss is shared with CompareDialog for its colour dots.
const CMP_COLS = ['--phoenix', '--foreground']
export const cmpCss = (i: number) => (i === 0 ? 'hsl(var(--phoenix))' : 'hsl(var(--foreground) / 0.78)')
// fake candle skeleton: [height %, offset from the bottom %], deterministic so the placeholder never jumps between renders
const SK_C: [number, number][] = Array.from({ length: 44 }, (_, i) => { const w = Math.sin(i * 0.55) * 14 + Math.sin(i * 1.7) * 6; return [14 + Math.abs(Math.sin(i * 2.3)) * 12, 38 + w + i * 0.4] })

function niceTicks(lo: number, hi: number, n: number) {
  const raw = (hi - lo) / n || 1, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p
  const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p, out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) out.push(v)
  return out
}
const pad2 = (n: number) => String(n).padStart(2, '0')
const sma = (v: number[], n: number, i: number) => { if (i < n - 1) return NaN; let s = 0; for (let k = i - n + 1; k <= i; k++) s += v[k]; return s / n }


export default function ChartPanel() {
  const app = useApp()
  const { say, sym, tf, set, market, mark, loading, signedIn, ghost, acct, form, settings, chartPrice, tickN, openDialog, v2, setForm, compare } = app
  const cmp = v2 ? compare.filter(c => c !== sym).slice(0, 2) : [] // markets drawn as % change lines over this chart
  const cmpOn = cmp.length > 0
  const T = useTpsl()
  const oc = useOrderCalc() // the order form's own numbers (est. liquidation line)
  const tok = (n: string) => (typeof document === 'undefined' ? '' : getComputedStyle(document.documentElement).getPropertyValue(n).trim())
  const UP = v2 ? `hsl(${tok('--buy')})` : UP0, DN = v2 ? `hsl(${tok('--sell')})` : DN0, AX = v2 ? `hsl(${tok('--muted-foreground')})` : AX0, GRID = v2 ? `hsl(${tok('--foreground')} / 0.06)` : GRID0
  const [moreOpen, setMoreOpen] = useState(false), [indOpen, setIndOpen] = useState(false), [gear, setGear] = useState(false)
  const prMore = usePresence(moreOpen), prInd = usePresence(indOpen), prGear = usePresence(gear)
  useEscape(moreOpen, () => setMoreOpen(false)); useEscape(indOpen, () => setIndOpen(false)); useEscape(gear, () => setGear(false))
  const [fs, setFs] = useState(false), [inds, setInds] = useState<string[]>(['Volume']), [legOn, setLegOn] = useState(true), [goOpen, setGoOpen] = useState(false), [tier, setTier] = useState(0)
  const prGo = usePresence(goOpen)
  useEscape(goOpen, () => setGoOpen(false)); useEscape(fs, () => setFs(false))
  const rootEl = useRef<HTMLElement>(null), manual = useRef<{ lo: number; hi: number } | null>(null)
  const opts = settings.chartOpts // shared with Settings > Chart
  const [vis, setVis] = useState(80), [off, setOff] = useState(0), [rng, setRng] = useState('')
  const [tool, setTool] = useState(0), [hover, setHover] = useState<{ x: number; y: number } | null>(null)
  const [sz, setSz] = useState({ w: 0, h: 0 }), [auto, setAuto] = useState(true), [pctm, setPctm] = useState(false), [logm, setLogm] = useState(false)
  const pctOn = pctm || cmpOn, logOn = logm && !cmpOn // comparing forces a percent axis (every line starts at 0% on the left edge)
  const plot = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; off: number } | null>(null)
  const geo = useRef({ start: 0, step: 1, axisW: 62 })
  const ymap = useRef({ lo: 0, hi: 1, top: 6, ph: 1, lg: false }), frozen = useRef<{ lo: number; hi: number } | null>(null), pillDrag = useRef<'tp' | 'sl' | null>(null), yEase = useRef<{ key: string; lo: number; hi: number } | null>(null)
  const [pills, setPills] = useState<{ tp: number | null; sl: number | null }>({ tp: null, sl: null }), [, setRev] = useState(0)

  useEffect(() => {
    const el = plot.current, root = rootEl.current; if (!el) return
    const upd = () => { const w = el.clientWidth, h = el.clientHeight; setSz(p => (p.w === w && p.h === h ? p : { w, h })) }
    const tierOf = () => { const w = root?.clientWidth ?? 9999; setTier(w < 570 ? 2 : w < 660 ? 1 : 0) }
    const ro = new ResizeObserver(() => { upd(); tierOf() }); ro.observe(el); if (root) ro.observe(root); upd(); tierOf()
    return () => ro.disconnect()
  }, [])

  const candles = E.candles(sym, tf)
  const showAct = opts.act, showLines = (signedIn || !!ghost) && settings.showPositionLines
  const dec = market.dec
  const cdn = E.countdown(sym, tf)
  // % change of a compared market across the visible range (same window the canvas draws)
  const cmpPct = (cs: string) => {
    const n = candles.length, v = Math.min(Math.max(vis, 20), n), o = Math.min(Math.max(off, 0), n - v), end = n - o, start = end - v
    const cc = E.candles(cs, tf), sh = cc.length - n, a = cc[start + sh]?.c, b = cc[end - 1 + sh]?.c
    return a && b ? (b / a - 1) * 100 : 0
  }

  // ---------- draw ----------
  useEffect(() => {
    const c = cv.current; if (!c || !sz.w) return
    const dpr = window.devicePixelRatio || 1, W = plot.current?.clientWidth || sz.w, H = plot.current?.clientHeight || sz.h // read the live size so the canvas never draws at a stale size and gets stretched (that put the TP/SL pills off their lines)
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr) }
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H)
    const axisW = 58, timeH = 29, top = 6, pw = W - axisW, ph = H - timeH - top
    const n = candles.length, v = Math.min(Math.max(vis, 20), n), o = Math.min(Math.max(off, 0), n - v)
    const end = n - o, start = end - v, step = pw / (v + 4)
    geo.current = { start, step, axisW }
    const sl = candles.slice(start, end)
    // overlay prices (so lines are always on-scale)
    const lines: { y: number; label: string; col: string; dash: number[]; tag?: boolean; w?: number; fit?: boolean; pin?: boolean }[] = []
    if (showLines) {
      const P = acct.positions.find(p => p.sym === sym)
      if (P && opts.pos) {
        if (opts.posEntry) lines.push({ y: P.entry, label: `${P.side}: ${P.size.toFixed(P.size < 1 ? 4 : 2)} ${sym} @ $${fp(P.entry, dec)}   PnL: ${P.upnl >= 0 ? '+' : '-'}$${Math.abs(P.upnl).toFixed(2)}  ✕`, col: P.side === 'Long' ? UP : DN, dash: [2, 3], tag: true })
        if (opts.posLiq && P.liq > 0) lines.push({ y: P.liq, label: `Liq. $${fp(P.liq, dec)}`, col: '#FB923C', dash: [6, 4], tag: true })
        if (opts.posTpsl && P.tp && !app.tpEdit) lines.push({ y: P.tp, label: `TP $${fp(P.tp, dec)}`, col: UP, dash: [6, 4], tag: true })
        if (opts.posTpsl && P.sl && !app.tpEdit) lines.push({ y: P.sl, label: `SL $${fp(P.sl, dec)}`, col: DN, dash: [6, 4], tag: true })
      }
      if (opts.orders && showAct) for (const r of acct.orders.filter(r => r.sym === sym)) lines.push({ y: r.price, label: `${r.kind} ${r.side}  ${r.size} ${sym} @ $${fp(r.price, dec)}`, col: r.side === 'Long' ? UP : DN, dash: [6, 4], tag: true })
    }
    const sz0 = parseFloat(form.size) || 0
    if (signedIn && opts.form && sz0 > 0) {
      const px = form.kind === 'Limit' && parseFloat(form.limit) ? parseFloat(form.limit) : mark
      if (form.kind === 'Limit' && opts.formLimit) lines.push({ y: px, label: `Limit Price $${fp(px, dec)}`, col: AX, dash: [6, 4], tag: true })
      else if (opts.formEntry) lines.push({ y: px, label: 'Est. Entry Price', col: '#9CA3AF', dash: [6, 4], tag: false })
      if (opts.formLiq && !ghost && oc.base > 0 && oc.liq != null && oc.liq > 0 && Math.abs(mark - oc.liq) / mark < 0.95) lines.push({ y: oc.liq, label: `Est. Liq. $${fp(oc.liq, dec)}`, col: v2 ? `hsl(${tok('--phoenix')})` : '#FB923C', dash: [4, 4], tag: true, pin: true }) // off-scale: pinned to the edge with an arrow, so the candles keep their scale
      if (form.tpsl && opts.formTpsl && (!app.tpEdit || app.tpEdit === sym)) { const tp = parseFloat(form.tpPx), sl = parseFloat(form.slPx); if (tp) lines.push({ y: tp, label: `TP $${fp(tp, dec)}`, col: UP, dash: [3, 3], tag: true, fit: true }); if (sl) lines.push({ y: sl, label: `SL $${fp(sl, dec)}`, col: DN, dash: [3, 3], tag: true, fit: true }) }
    }
    if (v2 && signedIn && opts.form && opts.formTpsl && form.tpsl && !(sz0 > 0) && (!app.tpEdit || app.tpEdit === sym)) { const tp = parseFloat(form.tpPx), sl2 = parseFloat(form.slPx); if (tp) lines.push({ y: tp, label: `TP $${fp(tp, dec)}`, col: UP, dash: [3, 3], tag: true, fit: true }); if (sl2) lines.push({ y: sl2, label: `SL $${fp(sl2, dec)}`, col: DN, dash: [3, 3], tag: true, fit: true }) }
    let lo = Math.min(...sl.map(k => k.l)), hi = Math.max(...sl.map(k => k.h))
    const span = hi - lo || hi * 0.01; lo -= span * 0.08; hi += span * 0.08
    for (const l of lines) if (v2 && l.fit ? true : l.y > lo - span * 0.5 && l.y < hi + span * 0.5) { const pd = l.fit ? 0.12 : 0.04; lo = Math.min(lo, l.y - span * pd); hi = Math.max(hi, l.y + span * pd) }
    // the TP/SL pills sit on their price lines: keep both prices well inside the price area (a pad of the whole range, not just the candles), so a pill is never pinned to the edge away from its line
    if (v2 && signedIn && form.tpsl && (!app.tpEdit || app.tpEdit === sym)) { const vs = [parseFloat(form.tpPx), parseFloat(form.slPx)].filter(v => v > 0); if (vs.length) { lo = Math.min(lo, ...vs); hi = Math.max(hi, ...vs); const pad = (hi - lo) * 0.07; if (Math.min(...vs) - lo < pad) lo = Math.min(...vs) - pad; if (hi - Math.max(...vs) < pad) hi = Math.max(...vs) + pad } }
    // compare lines live in this chart's price space: base * (1 + their % change since the left edge), so one % axis reads for every line
    const cbase = sl[0]?.c || 1
    const cser = cmp.map((cs, ci) => {
      const cc = E.candles(cs, tf), sh = cc.length - n, b0 = cc[start + sh]?.c || cc[0]?.c || 1, pts: [number, number][] = []
      for (let i = start; i < end; i++) { const k2 = cc[i + sh]; if (k2) pts.push([i, cbase * (k2.c / b0)]) }
      const t = tok(CMP_COLS[ci])
      return { sym: cs, col: t ? `hsl(${t}${ci ? ' / 0.78' : ''})` : '#FB923C', pts, pct: pts.length ? (pts[pts.length - 1][1] / cbase - 1) * 100 : 0 }
    })
    for (const c2 of cser) for (const [, y] of c2.pts) { if (y < lo) lo = y; if (y > hi) hi = y }
    if (cser.length) { const sp2 = hi - lo; lo -= sp2 * 0.03; hi += sp2 * 0.03 }
    if (!auto && manual.current && !cmpOn) { lo = manual.current.lo; hi = manual.current.hi }
    if (frozen.current) { lo = frozen.current.lo; hi = frozen.current.hi }
    // ease the price scale toward its target, so a TP/SL that is typed or dragged glides the chart instead of snapping it (far jumps, e.g. a new market, still snap)
    { const key = `${sym}|${tf}|${vis}|${off}|${logOn}|${pctOn}`, r0 = yEase.current
      if (!r0 || r0.key !== key || frozen.current || (!auto && manual.current) || cmpOn) yEase.current = { key, lo, hi }
      else {
        const sp = Math.max(r0.hi - r0.lo, 1e-9)
        if (Math.abs(lo - r0.lo) > sp * 4 || Math.abs(hi - r0.hi) > sp * 4) yEase.current = { key, lo, hi }
        else { const nl = r0.lo + (lo - r0.lo) * 0.22, nh = r0.hi + (hi - r0.hi) * 0.22, done = Math.abs(lo - nl) < sp * 0.003 && Math.abs(hi - nh) < sp * 0.003
          yEase.current = { key, lo: done ? lo : nl, hi: done ? hi : nh }; if (!done) requestAnimationFrame(() => setRev(x => x + 1)) }
        lo = yEase.current.lo; hi = yEase.current.hi
      } }
    const lg = logOn && lo > 0, llo = lg ? Math.log(lo) : 0, lhi = lg ? Math.log(hi) : 1
    const Y = (p: number) => top + (1 - (lg ? (Math.log(Math.max(p, lo * 0.5)) - llo) / (lhi - llo) : (p - lo) / (hi - lo))) * ph
    const pbase = sl[0]?.c || 1, lab = (v: number) => (pctOn ? `${v >= pbase ? '+' : ''}${(((v - pbase) / pbase) * 100).toFixed(2)}%` : fp(v, t_dec(v)))
    const t_dec = (t: number) => (t % 1 === 0 && dec < 3 ? (hi - lo > 20 ? 2 : dec) : dec)
    ymap.current = { lo, hi, top, ph, lg }
    { const tpv = parseFloat(form.tpPx), slv = parseFloat(form.slPx), on = v2 && signedIn && form.tpsl && (!app.tpEdit || app.tpEdit === sym); const q = (v: number) => (on && v ? Math.round(Y(v) * 2) / 2 : null); const np = { tp: q(tpv), sl: q(slv) }; setPills(pp => (pp.tp === np.tp && pp.sl === np.sl ? pp : np)) }
    const X = (i: number) => (i - start + 0.5) * step
    g.font = '12px abcDiatype, ui-sans-serif, sans-serif'; g.textBaseline = 'middle'
    // grid + y labels
    g.lineWidth = 1
    for (const t of niceTicks(lo, hi, Math.max(4, Math.round(ph / 58)))) {
      const y = Math.round(Y(t)) + 0.5; g.strokeStyle = GRID; g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke()
      g.fillStyle = AX; g.textAlign = 'left'; g.fillText(lab(t), pw + 8, y)
    }
    // time axis
    const showTimes = false, tms = TF_MS[tf] ?? 36e5, base = Math.floor(Date.now() / tms) * tms
    const every = Math.max(1, Math.ceil(100 / step))
    g.textAlign = 'center'
    for (let i = start; i < end; i++) {
      if (!showTimes || (n - 1 - i) % every) continue
      const t = new Date(base - (n - 1 - i) * tms), x = X(i)
      const midnight = t.getUTCHours() === 0 && t.getUTCMinutes() === 0
      g.strokeStyle = GRID; g.beginPath(); g.moveTo(Math.round(x) + 0.5, top); g.lineTo(Math.round(x) + 0.5, top + ph); g.stroke()
      g.fillStyle = midnight ? '#E5E7EB' : AX
      g.fillText(tms >= 864e5 ? `${t.getUTCDate()} ${t.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' })}` : midnight ? String(t.getUTCDate()) : `${pad2(t.getUTCHours())}:${pad2(t.getUTCMinutes())}`, x, H - timeH / 2 + 2)
    }
    // volume
    if (inds.includes('Volume')) {
      const mv = Math.max(...sl.map(k => k.v), 1), vh = ph * 0.09
      for (let i = start; i < end; i++) { const k = candles[i]; g.fillStyle = k.c >= k.o ? 'rgba(74,222,128,.22)' : 'rgba(246,90,90,.22)'; const h = (k.v / mv) * vh; g.fillRect(X(i) - step * 0.3, top + ph - h, step * 0.6, h) }
    }
    // candles
    for (let i = start; i < end; i++) {
      const k = candles[i], x = Math.round(X(i)) + 0.5, col = k.c >= k.o ? UP : DN
      g.strokeStyle = col; g.fillStyle = col; g.beginPath(); g.moveTo(x, Y(k.h)); g.lineTo(x, Y(k.l)); g.stroke()
      const bw = Math.max(1, Math.floor(step * 0.5)), y1 = Y(Math.max(k.o, k.c)), y2 = Y(Math.min(k.o, k.c))
      g.fillRect(Math.round(X(i) - bw / 2), y1, bw, Math.max(1, y2 - y1))
    }
    // indicators
    const closes = candles.map(k => k.c)
    const poly = (f: (i: number) => number, col: string) => { g.strokeStyle = col; g.lineWidth = 1.5; g.beginPath(); let st = false; for (let i = start; i < end; i++) { const val = f(i); if (isNaN(val)) continue; const x = X(i), y = Y(val); if (st) g.lineTo(x, y); else { g.moveTo(x, y); st = true } } g.stroke(); g.lineWidth = 1 }
    if (inds.includes('Moving Average')) poly(i => sma(closes, 20, i), '#60A5FA')
    if (inds.includes('EMA')) { let e = closes[0]; const ev = closes.map(c => (e = e + (c - e) * (2 / 51))); poly(i => ev[i], '#FACC15') }
    if (inds.includes('Bollinger Bands')) {
      const sd = (i: number) => { const m = sma(closes, 20, i); if (isNaN(m)) return NaN; let s = 0; for (let k = i - 19; k <= i; k++) s += (closes[k] - m) ** 2; return Math.sqrt(s / 20) }
      poly(i => sma(closes, 20, i) + 2 * sd(i), 'rgba(167,139,250,.9)'); poly(i => sma(closes, 20, i) - 2 * sd(i), 'rgba(167,139,250,.9)')
    }
    // buy / sell marks: this market's fills, each on the candle whose time bucket holds it (same time grid as the axis: the last candle is the current bucket)
    if (showLines && opts.act && opts.marks && !cmpOn) {
      const tms = TF_MS[tf] ?? 36e5, nowB = Math.floor(Date.now() / tms), seen = new Set<string>()
      for (const f of acct.fills) {
        if (f.sym !== sym) continue
        const i = n - 1 - (nowB - Math.floor(f.t / tms)); if (i < start || i >= end) continue
        const buy = f.kind === 'Open Long' || f.kind === 'Close Short', key = i + (buy ? 'b' : 's'); if (seen.has(key)) continue; seen.add(key)
        const k2 = candles[i], x = X(i), sz2 = Math.max(4, Math.min(6, step * 0.45))
        g.fillStyle = buy ? UP : DN; g.beginPath()
        if (buy) { const y = Y(k2.l) + 5; g.moveTo(x, y); g.lineTo(x - sz2, y + sz2 * 1.4); g.lineTo(x + sz2, y + sz2 * 1.4) } // below the candle, pointing up
        else { const y = Y(k2.h) - 5; g.moveTo(x, y); g.lineTo(x - sz2, y - sz2 * 1.4); g.lineTo(x + sz2, y - sz2 * 1.4) } // above, pointing down
        g.closePath(); g.fill()
      }
    }
    // compare lines + their % tag on the axis
    for (const c2 of cser) {
      if (!c2.pts.length) continue
      g.strokeStyle = c2.col; g.lineWidth = 1.75; g.lineJoin = 'round'; g.beginPath()
      c2.pts.forEach(([i, y], j) => (j ? g.lineTo(X(i), Y(y)) : g.moveTo(X(i), Y(y)))); g.stroke(); g.lineWidth = 1
      const ly = Math.round(Y(c2.pts[c2.pts.length - 1][1])) + 0.5
      g.fillStyle = c2.col; g.beginPath(); g.roundRect(pw + 2, ly - 9, axisW - 4, 18, 2); g.fill()
      g.fillStyle = '#0b0c0f'; g.textAlign = 'center'; g.font = '500 11px abcDiatype, ui-sans-serif, sans-serif'; g.fillText(`${c2.pct >= 0 ? '+' : ''}${c2.pct.toFixed(2)}%`, pw + axisW / 2, ly + 1); g.font = '12px abcDiatype, ui-sans-serif, sans-serif'
    }
    // overlay lines
    for (const l of lines) {
      let y = Math.round(Y(l.y)) + 0.5
      if (l.pin && (y < top || y > top + ph)) { // off the visible range: a label at the nearest edge with an arrow, no line
        const up = y < top; y = up ? top + 12 : top + ph - 12
        g.font = '11px abcDiatype, ui-sans-serif, sans-serif'; g.textAlign = 'left'
        const t2 = `${l.label} ${up ? '↑' : '↓'}`, tw = g.measureText(t2).width + 14
        g.fillStyle = 'rgba(15,16,20,.92)'; g.strokeStyle = l.col; g.setLineDash(l.dash); const px2 = pw - tw - 8; g.beginPath(); g.roundRect(px2, y - 10, tw, 20, 4); g.fill(); g.stroke(); g.setLineDash([])
        g.fillStyle = l.col; g.fillText(t2, px2 + 7, y + 1); g.font = '12px abcDiatype, ui-sans-serif, sans-serif'; continue
      }
      if (y < top || y > top + ph) continue
      g.strokeStyle = l.col; g.setLineDash(l.dash); g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.setLineDash([])
      g.font = '11px abcDiatype, ui-sans-serif, sans-serif'; g.textAlign = 'left'
      const tw = g.measureText(l.label).width + 14, lx = 70
      g.fillStyle = 'rgba(15,16,20,.92)'; g.strokeStyle = l.col; g.beginPath(); g.roundRect(lx, y - 10, tw, 20, 4); g.fill(); g.stroke()
      g.fillStyle = l.col; g.fillText(l.label, lx + 7, y + 1)
      if (l.tag) { g.fillStyle = l.col; g.fillRect(pw, y - 9, axisW, 18); g.fillStyle = '#0b0c0f'; g.textAlign = 'center'; g.fillText(fp(l.y, dec), pw + axisW / 2, y + 1) }
      g.font = '12px abcDiatype, ui-sans-serif, sans-serif'
    }
    // last price line + tag
    const last = candles[n - 1], lp = chartPrice === 'Mark Price' ? mark : last.c
    if (lp > lo && lp < hi && o === 0) {
      const col = last.c >= last.o ? UP : DN, y = Math.round(Y(lp)) + 0.5
      g.strokeStyle = col; g.globalAlpha = 0.7; g.setLineDash([1, 3]); g.beginPath(); g.moveTo(0, y); g.lineTo(pw, y); g.stroke(); g.setLineDash([]); g.globalAlpha = 1
      g.fillStyle = col; g.beginPath(); g.roundRect(pw + 9, y - 14, 40, 28, 2); g.fill()
      g.fillStyle = '#0b0c0f'; g.textAlign = 'center'; g.font = '500 12px abcDiatype, ui-sans-serif, sans-serif'
      g.fillText(cmpOn ? lab(lp) : fp(lp, dec), pw + axisW / 2, y - 6); g.fillText(`${pad2(Math.floor(cdn / 60))}:${pad2(cdn % 60)}`, pw + axisW / 2, y + 7)
    }
    // crosshair
    if (hover && tool === 0 && hover.x < pw && hover.y > top && hover.y < top + ph) {
      g.strokeStyle = 'rgba(148,163,184,.55)'; g.setLineDash([4, 4]); g.beginPath(); g.moveTo(Math.round(hover.x) + 0.5, top); g.lineTo(Math.round(hover.x) + 0.5, top + ph); g.moveTo(0, Math.round(hover.y) + 0.5); g.lineTo(pw, Math.round(hover.y) + 0.5); g.stroke(); g.setLineDash([])
      const fr = 1 - (hover.y - top) / ph, pv = lg ? Math.exp(llo + fr * (lhi - llo)) : lo + fr * (hi - lo)
      g.fillStyle = '#374151'; g.fillRect(pw, hover.y - 9, axisW, 18); g.fillStyle = '#F3F4F6'; g.textAlign = 'center'; g.fillText(pctOn ? lab(pv) : fp(pv, dec), pw + axisW / 2, hover.y + 1)
    }
  })

  const hi = (() => {
    const { start, step } = geo.current
    if (!hover || step <= 0) return candles.length - 1
    return Math.min(candles.length - 1, Math.max(0, start + Math.floor(hover.x / step)))
  })()
  const k = candles[hi] ?? candles[candles.length - 1], prev = candles[hi - 1] ?? k
  const dv = k.c - prev.c, col = k.c >= k.o ? 'buy' : 'sell'
  const now = new Date()

  const onWheel = (e: React.WheelEvent) => { setVis(v => Math.min(140, Math.max(20, v + (e.deltaY > 0 ? 6 : -6)))) }
  const onDown = (e: React.MouseEvent) => { drag.current = { x: e.clientX, off } }
  const onMove = (e: React.MouseEvent) => {
    const r = plot.current!.getBoundingClientRect(); setHover({ x: e.clientX - r.left, y: e.clientY - r.top })
    if (drag.current && e.buttons === 1) setOff(Math.max(0, Math.min(140 - vis, drag.current.off + Math.round((e.clientX - drag.current.x) / geo.current.step))))
  }
  const pillStart = useRef({ y: 0, p: 0 }), tRef = useRef(T)
  tRef.current = T
  const endPill = () => { pillDrag.current = null; frozen.current = null; setRev(x => x + 1) }
  const startPill = (kind: 'tp' | 'sl') => (e: React.PointerEvent) => {
    e.stopPropagation(); e.preventDefault()
    frozen.current = { lo: ymap.current.lo, hi: ymap.current.hi }; pillDrag.current = kind
    pillStart.current = { y: e.clientY, p: parseFloat(kind === 'tp' ? form.tpPx : form.slPx) || mark }
    const mv = (ev: PointerEvent) => { const m = ymap.current, dy = pillStart.current.y - ev.clientY, p = m.lg ? pillStart.current.p * Math.exp((dy / m.ph) * (Math.log(m.hi) - Math.log(m.lo))) : pillStart.current.p + (dy * (m.hi - m.lo)) / m.ph; if (kind === 'tp') tRef.current.setTpPrice(p); else tRef.current.setSlPrice(p) }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); document.body.style.cursor = ''; endPill() }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up); document.body.style.cursor = 'ns-resize'
  }
  const pill = (kind: 'tp' | 'sl') => {
    if (pills[kind] == null) return null; const y = Math.min(ymap.current.top + ymap.current.ph - 11, Math.max(ymap.current.top + 11, pills[kind] as number))
    const isTp = kind === 'tp', pct = isTp ? form.tpGain : form.slLoss
    return (
      <div key={kind} className={`t-tpill ${isTp ? 'g' : 'r'}`} style={{ top: y - 11 }} onPointerDown={startPill(kind)} onMouseDown={e => e.stopPropagation()} role="slider" aria-label={isTp ? 'Take profit price, drag to change' : 'Stop loss price, drag to change'}>
        <i className="grip" /><span>{isTp ? 'Take profit' : 'Stop loss'}</span><b className="num">{isTp ? '+' : '-'}{pct}%</b>
        <button aria-label="Remove" onPointerDown={e => e.stopPropagation()} onClick={() => setForm(isTp ? { tpPx: '', tpGain: '' } : { slPx: '', slLoss: '' })}>✕</button>
      </div>
    )
  }
  const pickTool = (i: number, name: string) => {
    if (name === 'Zoom In') { setVis(v => Math.max(20, v - 20)); return }
    if (i === 0) { setTool(0); return }
    say(`${name} is not available in this demo`, 'ok', 1800)
  }
  const goTo = (where: 'latest' | 'mid' | 'old') => { const n = candles.length, v = Math.min(Math.max(vis, 20), n), max = Math.max(0, n - v); setOff(where === 'latest' ? 0 : where === 'old' ? max : Math.round(max / 2)); setGoOpen(false) }
  const tglOpt = (kk: keyof typeof opts) => set({ settings: { ...settings, chartOpts: { ...opts, [kk]: !opts[kk] } } })
  const ck = ({ k: kk, label, sub, disabled }: { k: keyof typeof opts; label: string; sub?: boolean; disabled?: boolean }) => (
    <button key={kk} className={`t-ck${sub ? ' sub' : ''}${disabled ? ' dis' : ''}`} onClick={() => !disabled && tglOpt(kk)}><div className={`t-box${opts[kk] ? ' on' : ''}`}>{opts[kk] && <Check size={10} strokeWidth={3} />}</div>{label}</button>
  )
  // [TradingView icon, aria-label, has sub-menu chevron]; null = extra 13px gap (real layout: 28px icons, 38px pitch)
  const TOOLS: ([string, string, boolean] | null)[] = [['Cross', 'Cursors', true], ['Trend Line', 'Trend line tools', true], ['Fib Retracement', 'Gann and Fibonacci tools', true], ['XABCD Pattern', 'Patterns', true], ['Long Position', 'Forecasting and measurement tools', true], ['Brush', 'Geometric shapes', true], ['Text', 'Annotation tools', true], ['Icon', 'Icons', true], null, ['Measure', 'Measure', false], ['Zoom In', 'Zoom In', false], null, ['Magnet Mode snaps drawings pla', 'Magnets', true], ['Keep drawing', 'Stay in drawing mode', false], ['Lock all drawings', 'Lock all drawings', false], ['Hide all drawings', 'Hide options', true], ['Remove drawings', 'Remove options', true], ['Show Object Tree', 'Show Object Tree', false]]

  return (
    <section ref={rootEl} className={`panel t-chart${fs ? ' fs' : ''}${tier ? (tier > 1 ? ' c-sm c-xs' : ' c-sm') : ''}`}>
      {loading.chart && (
        <div className="t-chartload" role="status" aria-busy="true" aria-label="Loading chart">
          <div className="t-skh"><i className="skel" style={{ width: 30 }} /><i className="skel" style={{ width: 30 }} /><i className="skel" style={{ width: 30 }} /><i className="skel" style={{ width: 30 }} /><i className="skel" style={{ width: 74, marginLeft: 12 }} /><span style={{ flex: 1 }} /><i className="skel" style={{ width: 80 }} /><i className="skel" style={{ width: 130 }} /></div>
          <div className="t-skb2">
            <div className="cs">{SK_C.map((h, i) => <span key={i} className="c"><b className="animate-pulse" style={{ height: `${h[0]}%`, animationDelay: `${(i % 9) * 90}ms` }} /><u style={{ height: `${h[1]}%` }} /></span>)}</div>
            <div className="ax">{[0, 1, 2, 3, 4, 5].map(i => <i key={i} className="skel" />)}</div>
          </div>
          <div className="t-skf"><i className="skel" style={{ width: 24 }} /><i className="skel" style={{ width: 24 }} /><i className="skel" style={{ width: 24 }} /><i className="skel" style={{ width: 24 }} /><span style={{ flex: 1 }} /><i className="skel" style={{ width: 90 }} /></div>
        </div>
      )}
      <div className="t-ch-hd">
        {TFS.map(t => <button key={t} className={`t-tf${t === tf ? ' on' : ''}`} onClick={() => { set({ tf: t }); setOff(0) }}>{t}</button>)}
        <div style={{ position: 'relative' }}>
          <button className={`t-tf${MORE.includes(tf) ? ' on' : ''}`} onClick={() => { setMoreOpen(o => !o); setIndOpen(false) }}>{MORE.includes(tf) ? tf : <TvIcon name="Chart interval" size={8} className={`chv${moreOpen ? ' o' : ''}`} />}</button>
          {prMore.mounted && (<>{moreOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMoreOpen(false)} />}<div className="t-pop pop-in" data-state={prMore.state} style={{ left: 0, top: 32, width: 110, ['--pop-origin' as string]: 'top left' }}>{MORE.map(t => <button key={t} className={`it${t === tf ? ' on' : ''}`} onClick={() => { set({ tf: t }); setMoreOpen(false); setOff(0) }}>{t}</button>)}</div></>)}
        </div>
        <div style={{ position: 'relative' }}>
          <button className="t-ind" aria-label="Indicators" title="Indicators" onClick={() => { setIndOpen(o => !o); setMoreOpen(false) }}><TvIcon name="Indicators & Strategies" size={28} />Indicators</button>
          {prInd.mounted && (<>{indOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setIndOpen(false)} />}<div className="t-pop pop-in" data-state={prInd.state} style={{ left: 0, top: 32, width: 200, ['--pop-origin' as string]: 'top left' }}>
            {INDS.map(i => <button key={i} className={`it${inds.includes(i) ? ' on' : ''}`} onClick={() => setInds(l => (l.includes(i) ? l.filter(x => x !== i) : [...l, i]))}>{i}{inds.includes(i) && <Check className="ck" size={16} strokeWidth={2} />}</button>)}
          </div></>)}
        </div>
        <span className="t-sp" />
        <button className={`t-cmp${cmpOn ? ' on' : ''}`} onClick={() => openDialog('compare')} aria-label="Compare markets" aria-pressed={v2 ? cmpOn : undefined} title={cmpOn ? `Comparing with ${cmp.join(', ')}` : 'Compare markets'}><GitCompareArrows size={14} />Compare</button>
        <div className="t-seg">
          {(['Last Price', 'Mark Price'] as const).map(p => <button key={p} className={chartPrice === p ? 'on' : ''} aria-pressed={chartPrice === p} aria-label={p} onClick={() => set({ chartPrice: p })}><span className="f">{p}</span><span className="s">{p.split(' ')[0]}</span></button>)}
        </div>
        <div style={{ position: 'relative', marginLeft: 2 }}>
          <button className={`t-ib${gear ? ' on' : ''}`} onClick={() => setGear(o => !o)} aria-label="Chart settings" title="Chart settings"><Settings size={16} /></button>
        </div>
        <button className="t-ib" onClick={() => setFs(f => !f)} aria-label={fs ? 'Exit fullscreen' : 'Expand chart fullscreen'} title={fs ? 'Exit fullscreen (Esc)' : 'Fullscreen'} style={{ marginLeft: 1 }}>{fs ? <Minimize2 size={14} /> : <Expand size={14} />}</button>
        {prGear.mounted && (<>{gear && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setGear(false)} />}<div className="t-pop t-cset pop-in" data-state={prGear.state} style={{ ['--pop-origin' as string]: 'top right' }}>
          <div className="g">{ck({ k: 'act', label: 'Trading Activity' })}{ck({ k: 'marks', label: 'Buy/Sell Marks', sub: true })}{ck({ k: 'orders', label: 'Open Limit Orders', sub: true })}</div>
          <div className="g">{ck({ k: 'form', label: 'Order Form' })}{ck({ k: 'formLimit', label: 'Limit Price', sub: true })}{ck({ k: 'formLiq', label: 'Est. Liquidation Price', sub: true })}{ck({ k: 'formEntry', label: 'Est. Entry Price', sub: true })}{ck({ k: 'formTpsl', label: 'Take Profit / Stop Loss', sub: true })}</div>
          <div className="g">{ck({ k: 'pos', label: 'Position' })}{ck({ k: 'posEntry', label: 'Entry Price', sub: true })}{ck({ k: 'posLiq', label: 'Liquidation Price', sub: true })}{ck({ k: 'posTpsl', label: 'Take Profit / Stop Loss', sub: true })}</div>
        </div></>)}
      </div>
      <div className="t-ch-bd">
        <div className="t-tools">
          {TOOLS.map((T, i) => T ? <div key={i} className="tw"><button className={tool === i ? 'on' : ''} onClick={() => pickTool(i, T[1])} aria-label={T[1]} title={i === 0 || T[1] === 'Zoom In' ? T[1] : `${T[1]} (not in this demo)`}><TvIcon name={T[0]} size={28} /></button>{T[2] && <span className="sub"><TvIcon name="Cursors" size={4} /></span>}</div> : <span key={i} className="gap" />)}
        </div>
        <div className="t-plot" ref={plot} onWheel={onWheel} onMouseDown={onDown} onMouseMove={onMove} onMouseLeave={() => { setHover(null); drag.current = null }} onMouseUp={() => { drag.current = null }} style={{ cursor: tool === 0 ? 'crosshair' : 'default' }}>
          <canvas ref={cv} />
          {v2 && signedIn && form.tpsl && <>{pill('tp')}{pill('sl')}</>}
          <div className="t-leg num" style={legOn ? undefined : { display: 'none' }}>
            <div><span className="o">O</span><span className={col}>{fp(k.o, dec)}</span> <span className="o">H</span><span className={col}>{fp(k.h, dec)}</span> <span className="o">L</span><span className={col}>{fp(k.l, dec)}</span> <span className="o">C</span><span className={col}>{fp(k.c, dec)}</span> <span className={col}>{dv >= 0 ? '+' : '−'}{fp(Math.abs(dv), dec)} ({dv >= 0 ? '+' : '−'}{Math.abs((dv / prev.c) * 100).toFixed(2)}%)</span><TvIcon name="i38" size={18} className="dots" /></div>
            {inds.includes('Volume') && <div className="vol"><span className="o">Volume (USDC) </span><span className={col}>{k.v.toLocaleString('en-US')}</span><TvIcon name="i38" size={18} className="dots" /></div>}
          </div>
          {cmpOn && <div className="t-cmpleg" onMouseDown={e => e.stopPropagation()}>{cmp.map((c2, ci) => {
            const pv = cmpPct(c2)
            return <span key={c2} className="t-cmpchip" style={{ ['--cc' as string]: cmpCss(ci) }}><i />vs {c2}<b className="num">{pv >= 0 ? '+' : ''}{pv.toFixed(2)}%</b><button aria-label={`Stop comparing with ${c2}`} title="Remove" onClick={() => set({ compare: compare.filter(x => x !== c2) })}><X size={12} /></button></span>
          })}</div>}
          <button className="t-collapse" aria-label={legOn ? 'Hide indicator legend' : 'Show indicator legend'} aria-pressed={!legOn} onClick={() => setLegOn(o => !o)} onMouseDown={e => e.stopPropagation()}><TvIcon name="Hide indicator legend" size={15} style={{ transform: legOn ? 'rotate(180deg)' : 'none' }} /></button>
          <div className="t-tv" aria-hidden="true"><svg width="23" height="12.5" viewBox="0 0 35 19" fill="#fff"><path d="M0 0H17.5V7.5H14.5V19H8.6V7.5H0Z" /><circle cx="21.5" cy="4" r="2.8" /><path d="M19.5 19L26.6 0H34.5L27.9 19Z" /></svg></div>
        </div>
      </div>
      <div className="t-ch-ft">
        {RANGES.map(([r, n]) => <button key={r} className={`t-rng${rng === r ? ' on' : ''}`} onClick={() => { setRng(r); setVis(n); setOff(0) }}>{r}</button>)}
        <div style={{ position: 'relative', display: 'flex' }}>
          <button className={`t-ib${goOpen ? ' on' : ''}`} aria-label="Go to" title="Go to" aria-haspopup="menu" aria-expanded={goOpen} onClick={() => setGoOpen(o => !o)}><TvIcon name="Go to" size={28} /></button>
          {prGo.mounted && (<>{goOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setGoOpen(false)} />}<div className="t-pop pop-in" data-state={prGo.state} style={{ left: 0, bottom: 34, width: 150, ['--pop-origin' as string]: 'bottom left' }}>
            <button className="it" onClick={() => goTo('latest')}>Latest candle</button><button className="it" onClick={() => goTo('mid')}>Middle of range</button><button className="it" onClick={() => goTo('old')}>Oldest loaded</button>
          </div></>)}
        </div>
        <span className="t-sp" />
        <span className="t-clk num">{pad2(now.getUTCHours())}:{pad2(now.getUTCMinutes())}:{pad2(now.getUTCSeconds())} UTC</span>
        <button className={`t-tg${pctOn ? ' on' : ''}`} disabled={cmpOn} onClick={() => { setPctm(x => !x); if (!pctm) setLogm(false) }} aria-pressed={pctOn} title={cmpOn ? 'Percent scale is on while comparing' : 'Show the price axis in percent'} aria-label="Toggle Percentage"><TvIcon name="Toggle Percentage" size={14} /></button>
        <button className={`t-tg${logOn ? ' on' : ''}`} disabled={cmpOn} onClick={() => { setLogm(x => !x); if (!logm) setPctm(false) }} aria-pressed={logOn} title={cmpOn ? 'Log scale is off while comparing' : 'Logarithmic price scale'}>log</button>
        <button className={`t-tg${auto ? ' on' : ''}`} onClick={() => { if (auto) manual.current = { lo: ymap.current.lo, hi: ymap.current.hi }; else manual.current = null; setAuto(x => !x) }} aria-pressed={auto} title="Auto-fit the price scale to the visible candles">auto</button>
      </div>
    </section>
  )
}

'use client'
import { setBookFill } from '@/lib/bookFill'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, ChevronDown } from 'lucide-react'
import { BookLayoutIcon, TriDown, TriUp } from '@/components/icons/Phx'
import { E } from '@/lib/sim'
import { fmt } from '@/lib/data'
import { useApp } from '@/lib/store'
import { usePresence, useEscape } from '@/lib/presence'
import './book-intel.css'

// deterministic hash -> 0..1
function h(a: number, b: number, c = 0) { let x = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; x = (x ^ (x >>> 13)) * 1274126177; return (((x ^ (x >>> 16)) >>> 0) % 10000) / 10000 }
const symSeed = (s: string) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973
type Lvl = { p: number; size: number; total: number; ts?: number; tt?: number }
const t2 = (n: number) => String(n).padStart(2, '0')

// A calm, persistent book like the live one: levels keep their size and change a little, in batches every ~1.5-3s (no per-tick jitter).
type Snap = { anchor: number; key: string; at: number; next: number; sizes: Map<number, number>; asks: Lvl[]; bids: Lvl[]; spread: number; bn: number }
// v2: the top of the book is not always one tick wide; batch n opens a 1-3 tick gap (deterministic per market + batch, so the spread history is repeatable)
const gapAt = (seed: number, bn: number) => { const r = h(seed, Math.floor(bn / 4), 3); /* a gap holds for ~4 batches, like a real top of book */ return r < 0.55 ? 1 : r < 0.86 ? 2 : 3 }
function buildBook(prev: Snap | null, sym: string, mark: number, tick: number, n: number, fast = false): Snap {
  const seed = symSeed(sym), now = Date.now(), key = sym + '|' + tick + '|' + n
  const same = prev && prev.key === key
  const sizes = same ? prev!.sizes : new Map<number, number>()
  // v2: the ladder stays put until the mark has drifted two ticks away, so prices don't crawl on every tick
  const anchor = fast && same && Math.abs(mark - prev!.anchor) < tick * 2 ? prev!.anchor : mark
  const bn = same ? prev!.bn + 1 : 1000, gap = fast ? gapAt(seed, bn) : 1
  const bestBid = (Math.floor(anchor / tick + 1e-9) - Math.floor((gap - 1) / 2)) * tick, bestAsk = bestBid + gap * tick
  const base = (k: number, i: number) => Math.exp(7.2 + h(seed, k) * 5.3) * (i === 0 ? 0.4 : 1) * (tick >= 0.1 ? 1.6 : 1)
  const side = (dir: 1 | -1, start: number) => {
    const out: Lvl[] = []; let tot = 0
    for (let i = 0; i < n; i++) {
      const p = +(start + dir * i * tick).toFixed(8), k = Math.round(p / tick)
      let sz = sizes.get(k)
      if (sz === undefined) sz = base(k, i)
      else if (Math.random() < (fast ? 0.22 : 0.3)) sz = Math.min(base(k, i) * 1.8, Math.max(base(k, i) * 0.45, sz * (fast ? 0.93 + Math.random() * 0.14 : 0.9 + Math.random() * 0.22)))
      sizes.set(k, sz); const r = Math.round(sz); tot += r; out.push({ p, size: r, total: tot })
    }
    return out
  }
  return { anchor, key, at: now, next: now + (fast ? 2500 + Math.random() * 2500 : 1500 + Math.random() * 1700), sizes, asks: side(1, bestAsk), bids: side(-1, bestBid), spread: bestAsk - bestBid, bn }
}

// v2 intelligence layer, F: what the order form's size would do to the book as it stands now (a fact about the visible levels, not a forecast)
type Pv = { long: boolean; eat: number[]; filled: number; avg: number; levels: number; bps: number; best: number; over: number; rest: number; restPx: number; restIdx: number; restAway: number }
function calcPreview(S: Snap, long: boolean, market: boolean, base: number, limit: number, tick: number): Pv | null {
  const opp = long ? S.asks : S.bids, own = long ? S.bids : S.asks
  if (!opp.length || !(base > 0)) return null
  const best = opp[0].p, crosses = (p: number) => market || (long ? p <= limit + 1e-9 : p >= limit - 1e-9)
  let rem = base, cost = 0, levels = 0; const eat: number[] = []
  for (const l of opp) {
    if (rem <= 1e-12 || !crosses(l.p)) { eat.push(0); continue }
    const q = l.size / l.p, take = Math.min(rem, q) // level sizes are USDC notional; the order is in base units
    rem -= take; cost += take * l.p; levels++; eat.push(take / q)
  }
  const filled = base - rem, avg = filled > 0 ? cost / filled : 0
  const pv: Pv = { long, eat, filled, avg, levels, bps: filled > 0 ? (Math.abs(avg - best) / best) * 1e4 : 0, best, over: 0, rest: 0, restPx: 0, restIdx: -1, restAway: 0 }
  if (rem <= 1e-9) return pv
  if (market) { pv.over = rem; return pv }
  // a limit order's unfilled part rests at its price on its own side
  const bucket = (long ? Math.floor(limit / tick + 1e-9) : Math.ceil(limit / tick - 1e-9)) * tick
  pv.rest = rem; pv.restPx = limit; pv.restIdx = own.findIndex(l => Math.abs(l.p - bucket) < tick / 2)
  pv.restAway = own[0] ? Math.round((long ? own[0].p - bucket : bucket - own[0].p) / tick) : 0
  return pv
}
const SPARK_W = 52, SPARK_H = 16

export default function BookPanel({ mode = 'tabs' }: { mode?: 'tabs' | 'stack' | 'side' | 'trades' }) {
  const { sym, market, mark, rightTab, set, setForm, form, tickN, loading, v2, acct, ghost } = useApp()
  const [, setFrame] = useState(0), moving = useRef(true)
  const dec = market.dec, t0 = 10 ** -dec
  const aggOpts = [t0, t0 * 5, t0 * 10, t0 * 100].map(v => +v.toFixed(Math.max(dec, 0) + 2))
  const [agg, setAgg] = useState(0), [unit, setUnit] = useState<'USDC' | 'BASE'>('USDC'), [aggOpen, setAggOpen] = useState(false), [lay, setLay] = useState<'both' | 'bids' | 'asks'>('both'), [layOpen, setLayOpen] = useState(false)
  const prAgg = usePresence(aggOpen), prLay = usePresence(layOpen)
  useEscape(aggOpen, () => setAggOpen(false)); useEscape(layOpen, () => setLayOpen(false))
  const seenT = useRef(new Map<string, number>()), snap = useRef<Snap | null>(null)
  const lad = useRef<HTMLDivElement>(null), [rows, setRows] = useState(10), [rh, setRh] = useState(24)
  useEffect(() => { setAgg(0) }, [sym])
  useEffect(() => {
    const el = lad.current; if (!el) return
    const f = () => { if (v2) { setRows(40); setRh(22); return } const side = lay === 'both' ? (el.clientHeight - 28) / 2 : el.clientHeight; const n = lay === 'both' ? (mode === 'stack' ? 6 : 10) : Math.max(4, Math.floor(side / 23.8)); setRows(n); setRh(side / n) }
    const ro = new ResizeObserver(f); ro.observe(el); f(); return () => ro.disconnect()
  }, [lay, rightTab, mode, v2])
  const live = v2 && (mode !== 'tabs' || rightTab === 'book') && mode !== 'trades'
  useEffect(() => { if (!live) return; let id = 0; const f = () => { /* only render a frame while sizes are still easing or a fresh batch is due (an idle book costs nothing) */ if (moving.current || Date.now() >= (snap.current?.next ?? 0)) setFrame(x => (x + 1) | 0); id = requestAnimationFrame(f) }; id = requestAnimationFrame(f); return () => cancelAnimationFrame(id) }, [live])
  // v2 (Backpack-style ladder): one scrollable list, the mid row sticks to the top/bottom edge when you scroll away and offers Recenter
  const [off, setOff] = useState(false), centred = useRef(true), pm = useRef(mark), dir = useRef<'up' | 'down'>('up')
  if (mark !== pm.current) { dir.current = mark > pm.current ? 'up' : 'down'; pm.current = mark }
  const RH = 22, sprH = useRef(28)
  const nRows = rows
  const targetTop = () => { const el = lad.current; if (!el) return 0; const asksH = lay === 'bids' ? 0 : nRows * RH; if (lay === 'asks') return Math.max(0, el.scrollHeight - el.clientHeight); if (lay === 'bids') return 0; return Math.max(0, asksH + sprH.current / 2 - el.clientHeight / 2) }
  const usr = useRef(false), [dirUp, setDirUp] = useState(false)
  // the user's own scrolling (wheel, touch, drag) takes over for good: nothing snaps back until Recenter is pressed
  const tok = useRef(0)
  const touch = () => { usr.current = true; centred.current = false; tok.current++ }
  const onScroll = () => { const el = lad.current; if (!v2 || !el || !usr.current) return; /* manual mode: from the first wheel/touch until Recenter */ const t = targetTop(), far = Math.abs(el.scrollTop - t) > RH * 2; setOff(far); setDirUp(el.scrollTop > t) }
  // glide to the centre; only re-arm auto-centring once the glide has finished (and the user has not grabbed the list again), so the effect never snaps it
  const recenter = () => { const el = lad.current; if (!el) return; usr.current = false; centred.current = false; setOff(false); const my = ++tok.current; el.scrollTo({ top: targetTop(), behavior: 'smooth' }); setTimeout(() => { if (tok.current === my) centred.current = true }, 900) }
  useEffect(() => { centred.current = true; setOff(false) }, [sym, lay, agg])
  useEffect(() => {
    if (!v2) return; const el = lad.current; if (!el) return; const t = targetTop()
    if (centred.current) { if (Math.abs(el.scrollTop - t) > 0.5) el.scrollTop = t; return }
    // manual mode: keep the Recenter pill and its arrow in step with the list on every frame, without relying on scroll events
    if (usr.current) { const far = Math.abs(el.scrollTop - t) > RH * 2; setOff(o => (o === far ? o : far)); setDirUp(d => (d === el.scrollTop > t ? d : el.scrollTop > t)) }
  })
  type TipK = 'spread' | 'lean' | 'spark' | 'bps'
  const secRef = useRef<HTMLElement>(null), [tip, setTip] = useState<{ x: number; y: number; up: boolean; k: TipK; w: number } | null>(null)
  // tooltips are placed in viewport coordinates (position: fixed) right at the hovered label, so no ancestor transform or scroll can push them elsewhere
  const tipOn = (k: TipK) => (e: { currentTarget: Element }) => { const r = e.currentTarget.getBoundingClientRect(); const up = r.top > 220; setTip({ x: r.left + r.width / 2, y: up ? r.top : r.bottom, up, k, w: window.innerWidth }) }
  const tipProps = (k: TipK) => ({ tabIndex: 0, onMouseEnter: tipOn(k), onMouseLeave: () => setTip(null), onFocus: tipOn(k), onBlur: () => setTip(null) })
  const tick = aggOpts[agg] ?? t0
  const kk = sym + '|' + tick + '|' + rows
  if (!snap.current || snap.current.key !== kk || Date.now() >= snap.current.next) snap.current = buildBook(snap.current, sym, mark, tick, rows, v2)
  const { spread } = snap.current
  // ---- v2 intelligence layer. Everything here is read from the book's target sizes, so it moves only when a calm batch lands (or the form changes), never per frame.
  const intel = useRef({ at: -1, key: '', hist: [] as number[], imb: 0, heavy: 50 })
  if (v2 && intel.current.at !== snap.current.at) {
    const S = snap.current, I = intel.current, mid = ((S.asks[0]?.p ?? mark) + (S.bids[0]?.p ?? mark)) / 2
    // G2: spread history in bps, one point per batch (the earlier batches of this market are replayed from the same deterministic gap rule)
    if (I.key !== S.key) I.hist = Array.from({ length: 39 }, (_, i) => ((gapAt(symSeed(sym), S.bn - 39 + i) * tick) / mid) * 1e4)
    I.key = S.key; I.at = S.at; I.hist = [...I.hist, (S.spread / mid) * 1e4].slice(-40)
    // G1: pressure = resting size of the top ten levels on each side, in base units
    const top = (lv: Lvl[]) => lv.slice(0, 10).reduce((a, l) => a + l.size / l.p, 0), sb = top(S.bids), sa = top(S.asks)
    I.imb = sb + sa > 0 ? (sb - sa) / (sb + sa) : 0; I.heavy = Math.round((Math.max(sb, sa) / (sb + sa || 1)) * 100)
  }
  const pos = acct.positions.find(p => p.sym === sym)
  const pvKey = [snap.current.at, form.side, form.kind, form.unit, form.size, form.limit, form.reduce, pos?.side, pos?.size, lay, ghost, loading.book].join('|')
  const pvRef = useRef<{ k: string; v: Pv | null }>({ k: '', v: null })
  if (pvRef.current.k !== pvKey) {
    let v: Pv | null = null
    const long = form.side === 'Long', mkt = form.kind === 'Market', lim = parseFloat(form.limit)
    if (v2 && !ghost && !loading.book && (mkt || (form.kind === 'Limit' && lim > 0))) {
      // same conversion as the order form: a USD size is divided by the limit price for limits, else by the mark; Reduce Only caps it at the opposing position
      const val = parseFloat(form.size) || 0, ref = mkt ? mark : lim, baseIn = form.unit === 'usd' ? (ref ? val / ref : 0) : val
      const opposing = !!pos && (pos.side === 'Long') !== long, b = form.reduce ? (opposing ? Math.min(baseIn, pos!.size) : 0) : baseIn
      v = calcPreview(snap.current, long, mkt, b, lim, tick)
      // single-side layouts: only preview on a side that is on screen
      if (v) { const oppShown = long ? lay !== 'bids' : lay !== 'asks', ownShown = long ? lay !== 'asks' : lay !== 'bids'; if (v.filled > 0 ? !oppShown : !ownShown) v = null }
    }
    pvRef.current = { k: pvKey, v }
  }
  const pv = pvRef.current.v
  const fillPct = pv && pv.filled > 0 && form.kind === 'Market' ? pv.bps / 100 : null
  const fillAvg = pv && fillPct !== null ? pv.avg : 0, fillLong = !!pv?.long
  const fillFull = !!pv && pv.over === 0
  useEffect(() => { setBookFill(fillPct === null ? null : { sym, pct: fillPct, avg: fillAvg, long: fillLong, full: fillFull }) }, [fillPct, fillAvg, fillLong, fillFull, sym])
  useEffect(() => () => setBookFill(null), [])
  const pvTwo = !!pv && (pv.over > 0 || (pv.rest > 0 && pv.filled > 0))
  sprH.current = v2 && pvTwo ? 42 : 28
  // v2: every level eases toward its latest size on each animation frame (60fps) instead of snapping in batches
  const disp = useRef(new Map<string, number>()), lastT = useRef(0)
  const nowT = typeof performance !== 'undefined' ? performance.now() : 0, dtF = lastT.current ? Math.min(64, nowT - lastT.current) : 16; lastT.current = nowT
  const kF = 1 - Math.exp(-dtF / 800)
  moving.current = false
  const ease = (lv: Lvl[], tag: string) => { if (!v2) return lv; let tot = 0; return lv.map(l => { const key = tag + l.p.toFixed(8); const cur = disp.current.get(key); const d = cur === undefined ? l.size : cur + (l.size - cur) * kF; if (Math.abs(l.size - d) > 0.4) moving.current = true; disp.current.set(key, d); tot += d; return { p: l.p, size: d, total: tot, ts: l.size, tt: l.total } }) }
  if (disp.current.size > 600) disp.current.clear()
  const asks = ease(snap.current.asks, tick + 'a'), bids = ease(snap.current.bids, tick + 'b')
  // the footer status dot pings when a fresh batch arrives
  void tickN
  const mx = Math.max(...asks.map(l => l.size), ...bids.map(l => l.size), 1), mxT = Math.max(asks[asks.length - 1]?.total ?? 1, bids[bids.length - 1]?.total ?? 1, 1)
  const bidT = bids[bids.length - 1]?.total ?? 0, askT = asks[asks.length - 1]?.total ?? 0, bidPct = bidT + askT > 0 ? Math.min(99, Math.max(1, Math.round((bidT / (bidT + askT)) * 100))) : 50
  const dp = tick >= 1 ? 0 : Math.max(dec, String(tick).split('.')[1]?.length ?? 0)
  const conv = (usdc: number, p: number) => (unit === 'USDC' ? usdc : usdc / p)
  const fv = (n: number) => fmt(n, unit === 'USDC' ? 0 : n < 100 ? 2 : 0)
  const click = (p: number) => { if (form.kind === 'Limit') setForm({ limit: p.toFixed(dec) }) }
  const baseSym = unit === 'USDC' ? 'USDC' : sym
  const trades = E.trades[sym] ?? []
  { const ids = trades.slice(0, 24).map(t => `${t.t}-${t.p}-${t.s}`), first = seenT.current.size === 0, now = Date.now(); ids.forEach(i => { if (!seenT.current.has(i)) seenT.current.set(i, first ? 0 : now) }); if (seenT.current.size > 400) { const keep = new Map<string, number>(); ids.forEach(i => keep.set(i, seenT.current.get(i) ?? 0)); seenT.current = keep } }

  const row = (l: Lvl, k: 'a' | 'b', i: number, f = 0, own = false) => (
    <div key={k + i} className={`t-row num ${k}${own ? ' bk-own' : ''}`} onClick={() => click(l.p)}>
      <i className="bt" style={{ clipPath: `inset(0 ${100 - Math.max(2, (l.total / mxT) * 100)}% 0 0 round 0 3px 3px 0)` }} />
      <i className="bs" style={{ clipPath: `inset(0 ${100 - Math.max(2, (l.size / mx) * 100)}% 0 0 round 0 3px 3px 0)` }} />
      {v2 && <i className={`bk-eat${f > 0 ? ' on' : ''}`} aria-hidden><i style={{ transform: `scaleX(${Math.min(1, f)})` }} /></i>}
      <span>{fmt(l.p, dp)}</span><span>{fv(conv(l.ts ?? l.size, l.p))}</span><span>{fv(conv(l.tt ?? l.total, l.p))}</span>
    </div>
  )

  const ctl = (
      <div className="t-bctl">
        <div style={{ position: 'relative' }}>
          <button className="t-agg" onClick={() => setAggOpen(o => !o)}>{aggOpts[agg]}<ChevronDown size={12} className={`chv${aggOpen ? ' o' : ''}`} /></button>
          {prAgg.mounted && (<>{aggOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setAggOpen(false)} />}
            <div className="t-pop pop-in" data-state={prAgg.state} style={{ left: 0, top: 28, width: 90, ['--pop-origin' as string]: 'top left' }}>{aggOpts.map((o, i) => <button key={i} className={`it${i === agg ? ' on' : ''}`} onClick={() => { setAgg(i); setAggOpen(false) }}>{o}</button>)}</div></>)}
        </div>
        <button className="t-un" onClick={() => setUnit(u => (u === 'USDC' ? 'BASE' : 'USDC'))}>{baseSym}<ArrowLeftRight size={16} /></button>
        {v2 ? <button className="t-agg t-laycyc" style={{ width: 24, padding: 0, justifyContent: 'center' }} onClick={() => setLay(l => (l === 'both' ? 'bids' : l === 'bids' ? 'asks' : 'both'))} aria-label={lay === 'both' ? 'Showing bids and asks. Click for bids only' : lay === 'bids' ? 'Showing bids only. Click for asks only' : 'Showing asks only. Click for both'} title={lay === 'both' ? 'Bids and asks' : lay === 'bids' ? 'Bids only' : 'Asks only'}>
          <svg width="16" height="16" viewBox="0 0 19 18" fill="none" aria-hidden>
            <rect x="0.96" y="2.03" width="4.66" height="4.66" rx="1.38" fill={lay === 'bids' ? 'hsl(var(--buy))' : 'hsl(var(--sell))'} /><path d="M7.93 2.98H17.44M7.93 5.75H17.44" stroke="currentColor" strokeLinecap="round" />
            <rect x="0.96" y="11.31" width="4.66" height="4.66" rx="1.38" fill={lay === 'asks' ? 'hsl(var(--sell))' : 'hsl(var(--buy))'} /><path d="M7.93 12.25H17.44M7.93 15.02H17.44" stroke="currentColor" strokeLinecap="round" />
          </svg></button>
        : <div style={{ position: 'relative' }}>
          <button className="t-agg" style={{ width: 24, padding: 0, justifyContent: 'center' }} onClick={() => setLayOpen(o => !o)} aria-label="Order book layout">
            <BookLayoutIcon size={16} />
          </button>
          {prLay.mounted && (<>{layOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setLayOpen(false)} />}
            <div className="t-pop pop-in" data-state={prLay.state} style={{ right: 0, top: 28, width: 130, ['--pop-origin' as string]: 'top right' }}>{(['both', 'bids', 'asks'] as const).map(o => <button key={o} className={`it${o === lay ? ' on' : ''}`} onClick={() => { setLay(o); setLayOpen(false) }}>{o === 'both' ? 'Both' : o === 'bids' ? 'Bids' : 'Asks'}</button>)}</div></>)}
        </div>}
      </div>
  )
  const I = intel.current, hist = I.hist
  const pfx = (n: number) => '$' + fmt(n, dec)
  const qty = (n: number) => fmt(n, n >= 100 ? 0 : 2)
  const sNow = hist[hist.length - 1] ?? 0, wider = hist.length > 1 ? Math.round((hist.slice(0, -1).filter(v => v > sNow + 1e-9).length / (hist.length - 1)) * 100) : 0
  const sMx = Math.max(...hist, 0), sMn = Math.min(...hist, sMx)
  const sPts = hist.map((v, i) => `${((i * (SPARK_W - 3)) / Math.max(1, hist.length - 1) + 1.5).toFixed(1)},${(SPARK_H - 2 - ((v - sMn) / (sMx - sMn || 1)) * (SPARK_H - 4) - (sMx === sMn ? (SPARK_H - 4) / 2 : 0)).toFixed(1)}`)
  const lastPt = sPts[sPts.length - 1]?.split(',') ?? ['0', '0']
  const leanX = 11 - Math.max(-1, Math.min(1, I.imb * 2.5)) * 11 // bids heavier leans left, toward the green end
  const leanTxt = Math.abs(I.imb) < 0.02 ? `Balanced, ${I.heavy}% of top-10 size on each side` : `${I.imb > 0 ? 'Bids' : 'Asks'} heavier, ${I.heavy}% of top-10 size`
  const midRow = pv ? (
    <div className={`t-spr stk v2 num bk-mid pv${pvTwo ? ' two' : ''}`} aria-live="polite">
      {pv.filled > 0 ? <span className="bk-l1"><em>Your fill<s>·</s></em>avg <b>{pfx(pv.avg)}</b><s>·</s>{pv.levels} {pv.levels === 1 ? 'level' : 'levels'}<s>·</s><b className="bk-tipc" {...tipProps('bps')}>{pv.bps.toFixed(1)} bps</b></span>
      : <span className="bk-l1"><em>Your order<s>·</s></em>rests at <b>{pfx(pv.restPx)}</b><s>·</s>{pv.restAway < 0 ? `new best ${pv.long ? 'bid' : 'ask'}` : pv.restAway === 0 ? `joins best ${pv.long ? 'bid' : 'ask'}` : `${pv.restAway} ${pv.restAway === 1 ? 'level' : 'levels'} ${pv.long ? 'below best bid' : 'above best ask'}`}</span>}
      {pv.over > 0 && <span className="bk-l2 warn">{qty(pv.over)} {sym} more than the visible book</span>}
      {pv.over === 0 && pv.rest > 0 && pv.filled > 0 && <span className="bk-l2">then {qty(pv.rest)} {sym} rests at {pfx(pv.restPx)}</span>}
    </div>
  ) : (
    <div className="t-spr stk v2 num bk-mid">
      <span className="bk-sp"><span className="sp-l" {...tipProps('spread')}>Spread</span><span className="sp-v"><b>{fmt(spread, dp)}</b><i>{((spread / mark) * 100).toFixed(3)}%</i></span></span>
    </div>
  )
  const tipBody = (k: TipK) => k === 'lean' ? <><b>{leanTxt}.</b> Compares the resting size of the ten best bid levels with the ten best ask levels in the book right now. It describes the book, it does not predict the price. Updates when the book refreshes.</>
    : k === 'spark' ? <><b>Spread now {sNow.toFixed(1)} bps</b>, {wider > 0 ? `tighter than ${wider}% of the last few minutes` : sNow <= sMn + 1e-9 ? 'as tight as it has been in the last few minutes' : 'wider than at any point in the last few minutes'}. One point per book refresh, last {hist.length}.</>
    : k === 'bps' && pv ? <><b>{pv.bps.toFixed(1)} bps</b> is how far your average fill ({pfx(pv.avg)}) sits from the best {pv.long ? 'ask' : 'bid'} ({pfx(pv.best)}). 1 bps = 0.01%. Worked out from the levels on the book now; the real fill can differ if the book moves before your order lands.</>
    : <><b>Spread</b> is the gap between the best bid (the highest price someone will pay) and the best ask (the lowest price someone will sell for). Here it is {fmt(spread, dp)} {sym === 'USDC' ? '' : 'USDC'}, which is {((spread / mark) * 100).toFixed(3)}% of the price. The smaller it is, the cheaper it is to buy or sell right now.</>
  const bookBody = (<>
        <div className="t-bhd"><span>Price</span><span>Size {baseSym}</span><span>Total {baseSym}</span></div>
        <div className={`t-lad${v2 ? ' sc' : ''}`} ref={lad} onScroll={onScroll} onWheel={touch} onTouchMove={touch} onPointerDown={touch} style={{ ['--rh' as string]: rh + 'px' }}>
          {loading.book ? Array.from({ length: 21 }, (_, i) => <div key={i} className="t-skrow"><div className="animate-pulse t-skb" style={{ width: 64 }} /><div className="animate-pulse t-skb" style={{ width: 48, justifySelf: 'end' }} /><div className="animate-pulse t-skb" style={{ width: 56, justifySelf: 'end' }} /></div>) : <>
          {lay !== 'bids' && <div className="t-side asks">{[...asks].reverse().map((l, i) => { const j = asks.length - 1 - i; return row(l, 'a', i, pv?.long ? pv.eat[j] : 0, !!pv && !pv.long && pv.restIdx === j) })}</div>}
          {v2 ? midRow
          : <div className="t-spr num"><span>{aggOpts[agg]}</span><span>Spread</span><span>{((spread / mark) * 100).toFixed(3)}%</span></div>}
          {lay !== 'asks' && <div className="t-side bids">{bids.map((l, i) => row(l, 'b', i, pv && !pv.long ? pv.eat[i] : 0, !!pv && pv.long && pv.restIdx === i))}</div>}
          {v2 && <div className="t-rcw"><button className={`t-rc${off ? ' show' : ''}`} onClick={recenter} tabIndex={off ? 0 : -1} aria-hidden={!off}>{dirUp ? <TriUp size={10} /> : <TriDown size={10} />}Recenter</button></div>}
        </>}
        </div>
        {v2 && !loading.book && <div className="t-ratio num" aria-label={`Bids ${bidPct}%, asks ${100 - bidPct}%`}><span className="b" style={{ flex: bidPct }}>{bidPct}%</span><span className="a" style={{ flex: 100 - bidPct }}>{100 - bidPct}%</span></div>}
  </>)
  const tradesBody = (<>
        <div className="t-bhd"><span>Price</span><span>Size {baseSym}</span><span>Time</span></div>
        <div className="t-tl">
          {loading.book && Array.from({ length: 18 }, (_, i) => <div key={i} className="t-skrow" style={{ maxHeight: 24 }}><div className="animate-pulse t-skb" style={{ width: 52 }} /><div className="animate-pulse t-skb" style={{ width: 44, justifySelf: 'end' }} /><div className="animate-pulse t-skb" style={{ width: 54, justifySelf: 'end' }} /></div>)}
          {!loading.book && trades.slice(0, mode === 'trades' ? 60 : 24).map((t, i) => {
            const d = new Date(t.t), id = `${t.t}-${t.p}-${t.s}`
            return <div key={id} className={`t-trow num${(seenT.current.get(id) ?? 0) > 0 && Date.now() - (seenT.current.get(id) ?? 0) < 350 ? ' animate-slide-up' : ''}`}><span className={t.side === 'buy' ? 'buy' : 'sell'}>{fmt(t.p, dec)}</span><span>{fv(unit === 'USDC' ? t.p * t.s : t.s)}</span><span style={{ color: 'hsl(var(--muted-foreground))' }}>{t2(d.getHours())}:{t2(d.getMinutes())}:{t2(d.getSeconds())}</span></div>
          })}
          {!loading.book && trades.length === 0 && <div className="empty">Waiting for trades…</div>}
        </div>
  </>)
  const secB = (<div className="t-sec"><div className="t-sect">Order Book</div>{ctl}{bookBody}</div>)
  const secT = (<div className="t-sec t"><div className="t-sect">Trade List</div>{mode === 'side' && <div className="t-spc" />}{tradesBody}</div>)
  return (
    <section ref={secRef} className={`panel t-book m-${mode}`} style={mode === 'side' ? { ['--rh' as string]: rh + 'px' } : undefined}>
      {mode === 'tabs' && <>
      <div className="t-btabs">
        <button className={rightTab === 'book' ? 'on' : ''} onClick={() => set({ rightTab: 'book' })}>Order Book</button>
        <button className={rightTab === 'trades' ? 'on' : ''} onClick={() => set({ rightTab: 'trades' })}>Trade List</button>
      </div>
        {ctl}
        {rightTab === 'book' ? bookBody : tradesBody}
      </>}
      {mode === 'stack' && <>{secB}{secT}</>}
      {mode === 'side' && <div className="t-sidebs">{secB}{secT}</div>}
      {mode === 'trades' && secT}
      {v2 && tip && <div className={`t-sptip${tip.up ? ' up' : ''}`} role="tooltip" style={{ position: 'fixed', left: Math.min(Math.max(tip.x, 120), tip.w - 120), top: tip.y }}>{tipBody(tip.k)}</div>}
    </section>
  )
}

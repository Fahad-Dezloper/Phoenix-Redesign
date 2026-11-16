'use client'
import LevBar from './LevBar'
import Tip from '../Tip'
import { useBookFill } from '@/lib/bookFill'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeftRight, Calculator, Check, ChevronDown, FlaskConical, Lock, LockKeyholeOpen, Pencil, X } from 'lucide-react'
import { E, MAINT, TAKER, MAKER } from '@/lib/sim'
import RollNum from '@/components/RollNum'
import { bySym, fmt, price as fp, usd } from '@/lib/data'
import { useApp } from '@/lib/store'
import { usePresence, useEscape } from '@/lib/presence'

// Shared order maths: the form, the confirm dialog and the chart lines all read the same numbers.
export function useOrderCalc() {
  const { sym, form, mark, acct, signedIn, ghost, market, v2 } = useApp()
  const L = v2 ? Math.min(form.lev, market.lev || 10) : 10
  const long = form.side === 'Long'
  const val = parseFloat(form.size) || 0
  const limitPx = parseFloat(form.limit)
  const rawPx = form.kind === 'Limit' && limitPx > 0 ? limitPx : mark
  const baseIn = form.unit === 'usd' ? (rawPx ? val / rawPx : 0) : val
  const pos = acct.positions.find(p => p.sym === sym)
  const signed = pos ? (pos.side === 'Long' ? pos.size : -pos.size) : 0
  const opposing = !!pos && (pos.side === 'Long') !== long
  const base = form.reduce ? (opposing ? Math.min(baseIn, pos!.size) : 0) : baseIn
  const value0 = base * rawPx
  const slipEst = form.kind === 'Market' && base > 0 ? Math.min(form.slippage, 0.004 + value0 / 2e6 * 100) : 0
  const bf = useBookFill()
  // v2: a market order's expected price is the order book's own walk (same number the book shows), not a formula
  const bookAvg = v2 && form.kind === 'Market' && base > 0 && bf && bf.sym === sym && bf.long === long && bf.avg > 0 ? bf.avg : 0
  const px = bookAvg || (form.kind === 'Market' ? mark * (1 + (long ? 1 : -1) * (base > 0 ? slipEst / 100 : 0.0001)) : rawPx)
  const value = base * px
  const newSigned = signed + (long ? base : -base)
  const margin = Math.max(0, Math.abs(newSigned) - Math.abs(signed)) * px / L
  const feePct = (form.kind === 'Limit' || form.kind === 'Scale' ? MAKER : TAKER) * 100
  const fee = value * feePct / 100
  const avail = signedIn || ghost ? acct.available : 0
  const maxBase = form.reduce ? (opposing ? pos!.size : 0) : ((opposing ? pos!.size : 0) + (avail * L) / (px || 1)) * 0.995
  const bd = px >= 1000 ? 5 : px >= 10 ? 3 : px >= 1 ? 2 : 0
  let liq: number | null = null
  const isolated = form.margin === 'Isolated'
  if (base > 0 && Math.abs(newSigned) > 1e-9 && isolated) {
    // Isolated: the position can only lose its own margin (notional / leverage), so liquidation sits 1/lev - maintenance from the entry price.
    // Same distance the leverage risk tiers use (levDist). The rest of the balance adds no room.
    const d = Math.max(0, 1 / L - MAINT)
    liq = Math.max(0, newSigned > 0 ? px * (1 - d) : px * (1 + d))
  } else if (base > 0 && Math.abs(newSigned) > 1e-9) {
    // Cross: the whole account's equity backs the position
    const other = acct.maintMargin - Math.abs(signed) * mark * MAINT
    const room = acct.equity - fee - (other + Math.abs(newSigned) * mark * MAINT)
    liq = Math.max(0, newSigned > 0 ? mark - room / newSigned : mark + room / Math.abs(newSigned))
  }
  const levAfter = acct.equity > 0 ? ((acct.exposure - Math.abs(signed) * mark) + Math.abs(newSigned) * mark) / acct.equity : 0
  const over = signedIn && !ghost && margin > avail + 1e-9
  return { L, sym, long, base, px, value, margin, fee, feePct, slipEst, avail, maxBase, bd, liq, levAfter, over, pos, signed, newSigned, market, rawPx, isolated }
}


// Take profit / stop loss maths shared by the form sheet and the draggable pills on the chart.
export function useTpsl() {
  const { form, setForm, tpEdit, acct } = useApp()
  const c0 = useOrderCalc()
  // while a position's TP/SL is being edited, every number is relative to that position (its entry price, side, size and liquidation price), not to the order form
  const ep = tpEdit ? acct.positions.find(p => p.sym === tpEdit) : undefined
  const c = ep ? { ...c0, px: ep.entry, long: ep.side === 'Long', base: ep.size, value: ep.size * ep.entry, liq: ep.liq > 0 ? ep.liq : null, market: bySym(ep.sym) } : c0
  const ref = c.px, sgn = c.long ? 1 : -1, dec = c.market.dec
  const hasLiq = c.base > 0 && c.liq != null && c.liq > 0
  const clampTp = (p: number) => (sgn > 0 ? Math.max(p, ref * 1.001) : Math.min(p, ref * 0.999))
  const clampSl = (p: number) => { let q = sgn > 0 ? Math.min(p, ref * 0.999) : Math.max(p, ref * 1.001); if (hasLiq) q = sgn > 0 ? Math.max(q, c.liq! * 1.001) : Math.min(q, c.liq! * 0.999); return q }
  const setTpPrice = (p: number) => { const q = clampTp(p); setForm({ tpPx: q.toFixed(dec), tpGain: (((q - ref) / ref) * 100 * sgn).toFixed(2) }) }
  const setSlPrice = (p: number) => { const q = clampSl(p); setForm({ slPx: q.toFixed(dec), slLoss: (((ref - q) / ref) * 100 * sgn).toFixed(2) }) }
  const setTpPct = (pct: number) => setTpPrice(ref * (1 + (sgn * pct) / 100))
  const setSlPct = (pct: number) => setSlPrice(ref * (1 - (sgn * pct) / 100))
  const slMax = hasLiq ? Math.min(20, Math.max(0.5, (Math.abs(ref - c.liq!) / ref) * 100 - 0.2)) : 20
  return { c, form, ref, sgn, setTpPrice, setSlPrice, setTpPct, setSlPct, slMax, tpMax: 20 }
}

// Leverage risk tier (v2). Distance to liquidation for an isolated position at this leverage: d = 1/lev - maintenance.
// Same maintenance figure as the est. liquidation maths (MAINT in lib/sim). Safe d >= 15%, medium 7-15%, high < 7%.
// The stop circles, the filled track and the badge next to "Leverage" all read this one function, so they never disagree.
const TIER_MM = MAINT
export type Tier = 'ok' | 'mid' | 'bad'
export const levDist = (lev: number) => 1 / lev - TIER_MM
export const levTier = (lev: number): Tier => { const d = levDist(lev) + 1e-9; return d >= 0.10 ? 'ok' : d >= 0.03 ? 'mid' : 'bad' }
const TIER_NAME: Record<Tier, string> = { ok: 'Low risk', mid: 'Medium risk', bad: 'High risk' }
// Hold-to-confirm was tried and removed at the user's request: Place Order is always one click (the confirm dialog setting still applies).
export const holdMs = (_lev: number) => 0
// Lucide "lock" geometry (stroke 2), inlined so the shackle can close with a transform.
type Pend = { sym: string; side: 'Long' | 'Short'; exp: number; before: number; t0: number; toastId: number; dec: number; bd: number }
type PlRes = { head: string; sub: string; delta: string; k: 'good' | 'bad' | 'eq' }

const trim = (n: number, d: number) => (n > 0 ? String(+n.toFixed(d)) : '')

export default function OrderForm() {
  const app = useApp()
  const { form, setForm, signedIn, ghost, acct, sym, openDialog, loading, settings, v2 } = app
  const c = useOrderCalc()
  const bookFill = useBookFill() // v2: show the same slippage the order book preview shows
  const slipShow = v2 && bookFill && bookFill.sym === c.sym ? bookFill.pct : c.slipEst
  // Guaranteed price is only offered when it can be honoured: a market order the visible book can fill in full. It is sent as an
  // immediate-or-cancel order with the quoted price as its limit, so it fills at that price or better, or not at all.
  // price protection: the worst price this order may fill at = expected price moved by the user's max slippage (an immediate-or-cancel limit)
  const protPx = c.px * (1 + (c.long ? 1 : -1) * (form.slippage || 0) / 100)
  const gpOK = v2 && form.kind === 'Market' && c.base > 0 && !!bookFill && bookFill.sym === c.sym && bookFill.long === c.long && bookFill.full
  const root = useRef<HTMLElement>(null), slipRow = useRef<HTMLDivElement>(null), slider = useRef<HTMLDivElement>(null)
  const [crossOpen, setCrossOpen] = useState(false), [advOpen, setAdvOpen] = useState(false), [slipOpen, setSlipOpen] = useState(false), [slipB, setSlipB] = useState(60)
  const prX = usePresence(crossOpen), prA = usePresence(advOpen), prS = usePresence(slipOpen)
  useEscape(crossOpen, () => setCrossOpen(false)); useEscape(advOpen, () => setAdvOpen(false)); useEscape(slipOpen, () => setSlipOpen(false))
  const [foc, setFoc] = useState(false), [gMode, setGMode] = useState<'%' | '$'>('%'), [lMode, setLMode] = useState<'%' | '$'>('%')
  const live = signedIn || !!ghost
  const T = useTpsl()
  const [tpOpen, setTpOpen] = useState(false), fsRef = useRef<HTMLDivElement>(null)
  const editing = app.tpEdit ? acct.positions.find(p => p.sym === app.tpEdit) : undefined
  // Save / Done applies; Esc, Cancel and the dimmed background discard a position edit
  const closeTp = (save = true) => { setTpOpen(false); if (app.tpEdit) app.endTpEdit(save); else setTimeout(() => fsRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 80) }
  const prTp = usePresence(tpOpen && v2 && !ghost)
  useEscape(tpOpen, () => closeTp(false))
  useEffect(() => { if (app.tpEdit && v2) setTpOpen(true) }, [app.tpEdit]) // eslint-disable-line react-hooks/exhaustive-deps
  // focus mode: while the sheet is open, the rest of the screen (except the chart, the book and the position being edited) is dimmed and disabled
  const focusOn = tpOpen && v2 && !ghost
  useEffect(() => { if (app.tpFocus !== focusOn) app.set({ tpFocus: focusOn }) }, [focusOn]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { app.set({ tpFocus: false }) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const enableTpsl = () => { setForm({ tpsl: true }); if (!form.tpPx) T.setTpPct(5); if (!form.slPx) T.setSlPct(Math.min(2.5, T.slMax)); setTpOpen(true) }
  const disableTpsl = () => { setForm({ tpsl: false }); setTpOpen(false); if (app.tpEdit) app.endTpEdit(false) }
  const tglTpsl = () => { if (ghost) return; if (form.tpsl) disableTpsl(); else if (v2) enableTpsl(); else setForm({ tpsl: true }) }
  const bookLoading = loading.acct && live
  const baseSym = sym

  const setBase = (b: number) => setForm({ size: form.unit === 'usd' ? trim(b * c.px, 2) : trim(b, c.bd) })
  const frac = c.maxBase > 0 ? Math.min(1, c.base / c.maxBase) : 0
  const fromPointer = (e: React.PointerEvent) => {
    const r = slider.current!.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    setBase(f < 0.02 ? 0 : f * c.maxBase)
  }
  const swapUnit = () => {
    if (form.unit === 'base') setForm({ unit: 'usd', size: trim((parseFloat(form.size) || 0) * c.rawPx, 2) })
    else setForm({ unit: 'base', size: trim((parseFloat(form.size) || 0) / (c.rawPx || 1), c.bd) })
  }
  const num = (s: string) => /^\d*\.?\d*$/.test(s)

  // TP / SL <-> gain / loss (percent of price move from the expected entry, or dollars on the order value)
  const ref = T.ref, sgn = T.sgn // entry price and side of the position being edited, else of the order
  const cv = editing ? { base: editing.size, value: editing.size * editing.entry } : { base: c.base, value: c.value } // $ amounts follow the position being edited, else the order
  const onTpPx = (v: string) => { if (!num(v)) return; const p = parseFloat(v); setForm({ tpPx: v, tpGain: p && ref ? ((p - ref) / ref * 100 * sgn).toFixed(2) : '' }) }
  const onTpG = (v: string) => { if (!num(v)) return; const pct = gMode === '%' ? parseFloat(v) : (parseFloat(v) / (cv.value || 1)) * 100; setForm({ tpGain: gMode === '%' ? v : (pct ? pct.toFixed(2) : ''), tpPx: pct ? (ref * (1 + (sgn * pct) / 100)).toFixed(T.c.market.dec) : '' }) }
  const onSlPx = (v: string) => { if (!num(v)) return; const p = parseFloat(v); setForm({ slPx: v, slLoss: p && ref ? (((ref - p) / ref) * 100 * sgn).toFixed(2) : '' }) }
  const onSlL = (v: string) => { if (!num(v)) return; const pct = lMode === '%' ? parseFloat(v) : (parseFloat(v) / (cv.value || 1)) * 100; setForm({ slLoss: lMode === '%' ? v : (pct ? pct.toFixed(2) : ''), slPx: pct ? (ref * (1 - (sgn * pct) / 100)).toFixed(T.c.market.dec) : '' }) }
  const gShow = gMode === '%' ? form.tpGain : form.tpGain ? ((parseFloat(form.tpGain) / 100) * cv.value).toFixed(2) : ''
  const lShow = lMode === '%' ? form.slLoss : form.slLoss ? ((parseFloat(form.slLoss) / 100) * cv.value).toFixed(2) : ''

  const reduceDis = !live || !c.pos
  const kindLabel = form.kind === 'Scale' || form.kind === 'TWAP' ? form.kind : 'Advanced'
  const sizeSub = form.unit === 'base' ? usd(c.base * c.rawPx) : `${fmt(c.base, c.bd)} ${baseSym}`

  // main button
  let btn: { label: string; cls: string; dis: boolean; on?: () => void }
  if (!signedIn && !ghost) btn = { label: 'Start Trading', cls: '', dis: false, on: () => openDialog('login') }
  else if (ghost) btn = { label: 'Ghost Mode', cls: 'ghostb', dis: true }
  else if (c.base <= 0) btn = { label: 'Order Size is Zero', cls: c.long ? 'buy' : 'sell', dis: true }
  else if (c.over) btn = { label: 'Insufficient Margin', cls: 'warn', dis: true }
  else btn = { label: 'Place Order', cls: c.long ? 'buy' : 'sell', dis: false, on: () => (gpOK ? app.place({ guard: protPx, mark: app.mark, exp: c.px }) : v2 ? app.place() : settings.confirmOrders && !v2 ? openDialog('confirm', sym) : app.place()) } // v2: everything is already in the panel, so no confirm modal; market orders carry a guaranteed price

  // ---- v2 price lock: the button shows the expected price; after the fill a line compares it with what you got ----
  // The form arms a pending order when Place Order is pressed. The store's place() (direct, or from the confirm dialog) shows the
  // "Placing Order..." toast; that starts the clock. When that toast is replaced, the new fills for this market are the result.
  const pend = useRef<Pend | null>(null)
  const [placing, setPlacing] = useState(false), [plRes, setPlRes] = useState<PlRes | null>(null)
  const lastPx = useRef(0); if (c.base > 0) lastPx.current = c.px // expected price of the last non-empty order; place() empties the size
  const arm = () => { pend.current = { sym, side: form.side, exp: c.px, before: E.id, t0: 0, toastId: 0, dec: c.market.dec, bd: c.bd }; setPlRes(null) }
  useEffect(() => {
    const p = pend.current; if (!p) return
    const t = app.toast
    if (!p.t0) {
      if (t && t.kind === 'loading' && t.text.startsWith('Placing Order')) { p.t0 = performance.now(); p.toastId = t.id; if (lastPx.current) p.exp = lastPx.current; setPlacing(true) } // lock the price the user saw when they committed (after a confirm dialog, that is the dialog's moment)
      else if (app.dialog !== 'confirm') pend.current = null // confirm dialog cancelled
      return
    }
    if (t && t.id === p.toastId) return // still placing
    const ms = Math.round(performance.now() - p.t0)
    const fills = E.fills.filter(f => f.id >= p.before && f.sym === p.sym)
    pend.current = null; setPlacing(false)
    if (!fills.length) return // resting limit order or an error: nothing filled, no result line
    const size = fills.reduce((a, f) => a + f.size, 0), fill = fills.reduce((a, f) => a + f.price * f.size, 0) / (size || 1)
    const diff = (p.exp - fill) * (p.side === 'Long' ? 1 : -1) * size // > 0: better than expected on the whole order
    const cents = Math.round(diff * 100) / 100
    setPlRes({
      head: `Filled ${fmt(size, p.bd)} ${p.sym} at $${fp(fill, p.dec)}`,
      sub: `Expected $${fp(p.exp, p.dec)} · ${ms} ms`,
      delta: cents === 0 ? 'Exactly as expected' : cents > 0 ? `${usd(cents)} better` : `${usd(-cents)} slippage`,
      k: cents === 0 ? 'eq' : cents > 0 ? 'good' : 'bad',
    })
  }, [app.toast, app.dialog, app.tickN]) // eslint-disable-line react-hooks/exhaustive-deps
  // the result stays until the next order or a new size / side / order type / market
  useEffect(() => { if (form.size !== '') setPlRes(null) }, [form.size]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPlRes(null) }, [form.side, form.kind, sym])

  // ---- v2 hold to confirm above 5x ----
  // Pointer: press and hold; a fill sweeps across (transform scaleX, rAF only while holding); releasing early cancels.
  // Keyboard (Enter / Space, which arrive as a click with detail 0): above 5x always opens the confirm dialog, even if
  // "confirm orders" is off, so the high-leverage order still takes a deliberate second step that works without a pointer.
  const need = v2 ? holdMs(c.L) : 0
  const hf = useRef<HTMLSpanElement>(null), hold = useRef<{ raf: number; to: number } | null>(null)
  const go = () => { arm(); btn.on?.() }
  const holdStop = () => {
    const h = hold.current; if (!h) return
    cancelAnimationFrame(h.raf); clearTimeout(h.to); hold.current = null
    if (hf.current) { hf.current.style.transition = 'transform .2s'; hf.current.style.transform = 'scaleX(0)' }
  }
  const holdStart = (e: React.PointerEvent) => {
    if (!need || btn.dis || e.button !== 0 || hold.current) return
    const t0 = performance.now(); if (hf.current) hf.current.style.transition = 'none'
    // the timer decides completion; rAF only paints the sweep (and stops as soon as the hold ends)
    const step = () => {
      if (!hold.current) return
      if (hf.current) hf.current.style.transform = `scaleX(${Math.min(1, (performance.now() - t0) / need)})`
      hold.current.raf = requestAnimationFrame(step)
    }
    const done = () => {
      const h = hold.current; if (!h) return
      cancelAnimationFrame(h.raf); hold.current = null
      if (hf.current) { hf.current.style.transition = 'transform .25s'; hf.current.style.transform = 'scaleX(0)' }
      go()
    }
    hold.current = { raf: requestAnimationFrame(step), to: window.setTimeout(done, need) }
  }
  useEffect(() => () => { const h = hold.current; if (h) { cancelAnimationFrame(h.raf); clearTimeout(h.to) } }, [])
  const onMain = (e: React.MouseEvent) => {
    if (!need) return go()
    if (e.detail === 0) { arm(); openDialog('confirm', sym) } // keyboard
  }
  const priceLock = v2 && signedIn && !ghost && (placing || (!btn.dis && btn.label === 'Place Order'))

  const openSlip = () => {
    const f = root.current!.getBoundingClientRect(), r = slipRow.current!.getBoundingClientRect()
    setSlipB(f.bottom - r.top + 7); setSlipOpen(o => !o)
  }
  const choose = (k: 'Market' | 'Limit' | 'Scale' | 'TWAP') => { setForm({ kind: k }); setAdvOpen(false) }
  const sk = bookLoading
  const levStops = Array.from(new Set([1, 2, 5, 10, 20, c.market.lev].filter(x => x <= c.market.lev))).sort((a, b) => a - b)

  const levRef = useRef<HTMLDivElement>(null)
  const li = levStops.reduce((bi, x, i) => (Math.abs(x - c.L) < Math.abs(levStops[bi] - c.L) ? i : bi), 0)
  const lpos = (i: number) => (levStops.length > 1 ? (i / (levStops.length - 1)) * 100 : 0)
  const [levDrag, setLevDrag] = useState<number | null>(null) // 0..1 pointer position while dragging the leverage slider
  const levFromPointer = (e: React.PointerEvent) => { { const r0 = levRef.current!.getBoundingClientRect(); setLevDrag(Math.min(1, Math.max(0, (e.clientX - r0.left) / r0.width))) } const r = levRef.current!.getBoundingClientRect(), f = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); const i = Math.round(f * (levStops.length - 1)); if (levStops[i] !== c.L) setForm({ lev: levStops[i] }) }
  const liqDist = c.liq != null && c.base > 0 ? Math.abs(app.mark - c.liq) / app.mark * 100 : null
  const liqSafe = c.liq != null && (c.liq <= 0 || (liqDist ?? 0) >= 95)
  const tpPct = parseFloat(form.tpGain) || 0, slPct = parseFloat(form.slLoss) || 0
  const hasLiq = live && c.liq != null && c.base > 0
  void hasLiq
  // with a size typed, rate the real liquidation distance of this order (cross margin can add room); without one, rate the leverage alone
  const tierK: ReturnType<typeof levTier> = c.base > 0 && liqDist !== null ? (liqSafe ? 'ok' : liqDist >= 10 ? 'ok' : liqDist >= 3 ? 'mid' : 'bad') : levTier(c.L)
  const tier = { n: TIER_NAME[tierK], k: tierK }
  const tierTip = c.isolated
    ? `Isolated: at ${c.L}x, a ${Math.max(0, levDist(c.L) * 100).toFixed(1)}% move against this position uses up its margin (maintenance ${(TIER_MM * 100).toFixed(1)}%) and it is liquidated. The rest of your balance is not used.`
    : `At ${c.L}x, a ${Math.max(0, levDist(c.L) * 100).toFixed(1)}% move against an isolated position uses up its margin (maintenance ${(TIER_MM * 100).toFixed(1)}%). Cross margin (selected) can add room from the rest of your balance.`
  const showLiqLine = v2 && signedIn && !ghost && c.base > 0
  const fpay = c.value * (c.market.fund / 100) * (c.long ? 1 : -1)
  // Until a wallet is connected AND a real size is typed, the order maths is a preview only: show it greyed out so it does not compete with the form.
  const idle = !(signedIn && !ghost) || !(c.base > 0)
  const summary = (
    <div className={`v2-sum${idle ? ' idle' : ''}`}>
      {form.kind === 'Market' && c.base > 0 && slipShow >= 0.05 && <div className="warn">Est. slippage {slipShow.toFixed(3)}% on this size</div>}
      <div className="row num"><span>Entry price</span><b>${fp(c.px, c.market.dec)}</b></div>
      <div className="row num"><span>Margin required</span><b><RollNum value={c.base > 0 ? usd(c.margin) : '$0.00'} /></b></div>
      <div className="row num"><span>Est. liquidation</span><b>{c.base > 0 && c.liq != null && !liqSafe ? <><RollNum value={'$' + fp(c.liq, c.market.dec)} /><em>{(liqDist ?? 0).toFixed(1)}% away</em></> : <em className="free">{c.base > 0 ? 'No liquidation risk' : '—'}</em>}</b></div>
      <div className="row num"><span><Tip label="Fee"><b>Fee</b> is the trading fee Phoenix charges on this order, worked out from its value. You pay it once, when the order fills.</Tip> · <Tip label="Funding / hr"><b>Funding</b> is a small payment exchanged every hour between longs and shorts, to keep the perp price close to the spot price. A minus sign means you pay it on this size; a plus means you receive it.</Tip></span><b>{c.base > 0 ? usd(c.fee) : '$0.00'}<em>·</em><span className={c.base > 0 ? (fpay > 0 ? 'sell' : 'buy') : ''}>{c.base > 0 ? `${fpay >= 0 ? '-' : '+'}${usd(Math.abs(fpay))}` : '—'}</span></b></div>
      <div className="row num" style={v2 ? { display: 'none' } : undefined}><span>Position</span><b>{!live ? '-' : c.base > 0 && signedIn && !ghost ? `${c.pos ? fmt(c.pos.size, c.bd) : 0} → ${fmt(Math.abs(c.newSigned), c.bd)} ${baseSym}` : c.pos ? `${fmt(c.pos.size, 2)} ${baseSym}` : '-'}</b></div>
    </div>
  )
  const levBlock = (
    <div className="v2-lev2" role="group" aria-label="Leverage">
      <div className="hd"><span><Tip label="LEV"><b>Leverage</b> multiplies your position size compared with the margin you put up. 5x means a $100 margin controls a $500 position. Higher leverage also moves your liquidation price closer.</Tip></span><i className={`v2-badge ${tier.k}`} title={tierTip}>{tier.n}</i><b className="num">{c.L}x</b></div>
      {v2 ? <LevBar value={c.L} max={c.market.lev} tierOf={levTier} onChange={l => setForm({ lev: l })} /> : (<>
      <div className={`t-sl act lvt-${tierK}`} ref={levRef} style={{ margin: '0 7px' }}
        onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); levFromPointer(e) }}
        onPointerMove={e => { if (e.buttons === 1) levFromPointer(e) }} onPointerUp={() => setLevDrag(null)} onPointerCancel={() => setLevDrag(null)} onLostPointerCapture={() => setLevDrag(null)}>
        <span className="tr" />
        {/* the filled line is coloured per segment by the risk of the stop it leads to: only 5x→10x turns orange, only 10x→20x and beyond turn red */}
        {levStops.slice(1).map((x, k) => <span key={'sg' + x} className={`fl sg sg-${levTier(x)}`} style={{ left: `${lpos(k)}%`, width: `${k + 1 <= li ? lpos(k + 1) - lpos(k) : 0}%` }} />)}
        {levStops.map((x, i) => {
          // inner dot: full when reached; while dragging it grows as the pointer approaches this stop from the previous one
          const prev = i ? lpos(i - 1) / 100 : 0, here = lpos(i) / 100
          const near = levDrag === null || i === 0 ? 0 : Math.min(1, Math.max(0, (levDrag - prev) / (here - prev || 1)))
          const f = i === 0 ? 1 : levDrag !== null ? 0.34 + 0.66 * near : i <= li ? 1 : 0.34 // while dragging, every stop fills with the pointer; on release it settles to the chosen leverage
          return <span key={x} className={`st lvt-${levTier(x)}${i <= li ? ' on' : ''}`} style={{ left: `${lpos(i)}%`, ['--f' as string]: f.toFixed(3) }}><i /></span>
        })}
        <span className="kn" style={{ left: `${lpos(li)}%` }} />
      </div>
      <div className="tk">{levStops.map((x, i) => <button key={x} type="button" className={x === c.L ? 'on' : ''} style={{ left: `${lpos(i)}%` }} onClick={() => setForm({ lev: x })} aria-label={`Set leverage to ${x}x`}>{x}x</button>)}</div>
      </>)}
      {showLiqLine && <div className="v2-liqs num" aria-live="polite">{c.liq != null && !liqSafe
        ? <>If {c.market.sym} {c.long ? 'falls' : 'rises'} <b>{(liqDist ?? 0).toFixed(1)}%</b> to <b>${fp(c.liq, c.market.dec)}</b>, this position is liquidated.</>
        : <>No liquidation risk at this size.</>}</div>}
      <p>Margin = order value ÷ leverage. {c.market.sym} allows up to {c.market.lev}x.</p>
    </div>
  )
  const lvl = (kind: 'tp' | 'sl') => {
    const isTp = kind === 'tp', px = isTp ? form.tpPx : form.slPx, pct = parseFloat(isTp ? form.tpGain : form.slLoss) || 0, has = !!px
    const max = isTp ? T.tpMax : T.slMax, f = Math.min(1, pct / max)
    const mode = isTp ? gMode : lMode, setMode = isTp ? setGMode : setLMode
    const shown = isTp ? gShow : lShow
    const setPct = (v: number) => (isTp ? T.setTpPct(v) : T.setSlPct(v))
    const fromPtr = (e: React.PointerEvent) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(), x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)); setPct(Math.max(0.1, Math.round(x * max * 10) / 10)) }
    const clear = () => setForm(isTp ? { tpPx: '', tpGain: '' } : { slPx: '', slLoss: '' })
    const money = has && cv.base > 0 ? `${isTp ? '+' : '-'}${usd(cv.value * pct / 100)}` : ''
    return (
      <div className={`lv ${isTp ? 'g' : 'r'}`} key={kind}>
        <div className="top"><span className="dt" /><b>{isTp ? 'Take profit' : 'Stop loss'}</b>
          <em className="num">{has ? <>{money && <>{money} </>}<small>({isTp ? '+' : '-'}{pct.toFixed(1)}%)</small></> : 'Not set'}</em>
          {has && <button className="x" aria-label={`Remove ${isTp ? 'take profit' : 'stop loss'}`} onClick={clear}><X size={12} /></button>}</div>
        <div className="inp">
          <label><span>Price</span><i>$</i><input inputMode="decimal" placeholder="0" value={px} onChange={e => (isTp ? onTpPx(e.target.value) : onSlPx(e.target.value))} /></label>
          <label><span>{isTp ? 'Gain' : 'Loss'}</span><input inputMode="decimal" placeholder="0" value={shown} onChange={e => (isTp ? onTpG(e.target.value) : onSlL(e.target.value))} /><button type="button" onClick={() => setMode(m => (m === '%' ? '$' : '%'))} aria-label="Switch between percent and dollars">{mode}</button></label>
        </div>
        <div className={`t-sl act ${isTp ? 'g' : 'r'}`} onPointerDown={e => { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); fromPtr(e) }} onPointerMove={e => { if (e.buttons === 1) fromPtr(e) }}>
          <span className="tr" /><span className="fl" style={{ width: `${f * 100}%` }} />
          {[0, 0.25, 0.5, 0.75, 1].map(x => <span key={x} className="st" style={{ left: `${x * 100}%` }} />)}
          <span className="kn" style={{ left: `${f * 100}%` }}><i /><i /></span>
        </div>
        <div className="tks">{[0, 1, 2, 3, 4].map(i => { const v = (max * i) / 4; return <button key={i} type="button" style={{ left: `${i * 25}%` }} className={Math.abs(pct - v) < max / 40 ? 'on' : ''} onClick={() => setPct(Math.max(0.1, v))} tabIndex={-1}>{v % 1 === 0 ? v : v.toFixed(1)}%</button> })}</div>
      </div>
    )
  }
  const sheetEl = (
    <div className="v2-tps" role="group" aria-label="Take profit and stop loss">
      {editing ? <>
        <div className="hd"><b>Edit TP / SL</b><span className="eb"><button className="cancel" onClick={() => closeTp(false)}>Cancel</button><button className="done" onClick={() => closeTp(true)}>Save</button></span></div>
        <div className="pinfo num"><span className={`chip ${editing.side === 'Long' ? 'buy' : 'sell'}`}>{editing.side}</span><b>{editing.sym}</b><span>{fmt(editing.size, 2)}</span><i /><span>Entry <b>${fp(editing.entry, c.market.dec)}</b></span><i /><span>Mark <b>${fp(editing.mark, c.market.dec)}</b></span></div>
      </> : <div className="hd"><b>Take profit / Stop loss</b><button className="done" onClick={() => closeTp(true)}>Done</button></div>}
      {lvl('tp')}{lvl('sl')}
    </div>
  )
  const tpSet = !!form.tpPx, slSet = !!form.slPx
  const tpPctN = parseFloat(form.tpGain) || 0, slPctN = parseFloat(form.slLoss) || 0
  const cell = (isTp: boolean) => {
    const px = isTp ? form.tpPx : form.slPx, pct = isTp ? tpPctN : slPctN
    return (
      <div className={`c ${isTp ? 'g' : 'r'}${px ? '' : ' off'}`}>
        <span className="t">{isTp ? 'Take profit' : 'Stop loss'}</span>
        <b className="num">{px ? `$${px}` : '—'}</b>
        <em className="num">{px ? `${isTp ? '+' : '-'}${cv.base > 0 ? usd(cv.value * pct / 100) + ' ' : ''}(${isTp ? '+' : '-'}${pct.toFixed(1)}%)` : 'Not set'}</em>
      </div>
    )
  }
  const tpslRow = v2 && form.tpsl && !ghost && <div className="v2-tpbox">{cell(true)}{cell(false)}</div>
  const tpEdit = v2 && form.tpsl && !ghost && <button className="v2-tpedit" onClick={() => setTpOpen(true)} aria-label="Edit take profit and stop loss" title="Edit take profit and stop loss"><Pencil size={12} /></button>

  const headEl = (<>
        <div className="t-ftabs">
          <button className={form.kind === 'Market' ? 'on' : ''} onClick={() => choose('Market')}>Market</button>
          <button className={form.kind === 'Limit' ? 'on' : ''} onClick={() => choose('Limit')}>Limit</button>
          <button className={form.kind === 'Scale' || form.kind === 'TWAP' ? 'on' : ''} onClick={() => { setAdvOpen(o => !o); setCrossOpen(false) }}>{kindLabel}<ChevronDown size={12} className={`chv${advOpen ? ' o' : ''}`} /></button>
        </div>
        <div className="t-side2">
          <i className="pill" style={{ left: form.side === 'Long' ? 0 : 'calc(50% + 4px)', background: form.side === 'Long' ? 'hsl(var(--buy))' : 'hsl(var(--sell))' }} />
          <button className={form.side === 'Long' ? 'on' : ''} onClick={() => setForm({ side: 'Long' })}>Long/Buy</button>
          <button className={form.side === 'Short' ? 'on s' : ''} onClick={() => setForm({ side: 'Short' })}>Short/Sell</button>
        </div>
  </>)
  const bottomEl = (<>
        <div className="t-fbtn">
          {priceLock
            ? <div className="plwrap">{gpOK && !placing && <span className={`gpt num ${c.long ? 'buy' : 'sell'}`}><Tip label={<>Protected {c.long ? 'up to' : 'down to'} <RollNum value={'$' + fp(protPx, c.market.dec)} /></>}><b>Price protection.</b> This market order is sent with {c.long ? 'a maximum' : 'a minimum'} price of ${fp(protPx, c.market.dec)}: your expected price ${fp(c.px, c.market.dec)} plus your max slippage ({form.slippage}%). It fills at that price or better, never worse. If the market moves past it before the order lands, it is cancelled instead of filling badly.</Tip></span>}<button className={`cta pl ${placing ? (form.side === 'Long' ? 'buy' : 'sell') : btn.cls}${placing ? ' locked' : ''}`} aria-disabled={placing} aria-busy={placing}
                onClick={e => { if (!placing) onMain(e) }} onPointerDown={e => { if (!placing) holdStart(e) }} onPointerUp={holdStop} onPointerLeave={holdStop} onPointerCancel={holdStop}
                aria-label={placing ? 'Placing order' : need ? `Hold to place order at ${c.L}x leverage, expected price $${fp(c.px, c.market.dec)}` : `Place order, expected price $${fp(c.px, c.market.dec)}`}>
                <span className="hf" ref={hf} aria-hidden />
                <span className="pll">{placing ? 'Placing…' : need ? `Hold to place · ${c.L}x` : 'Place Order'}</span>
              </button></div>
            : <button className={`cta ${btn.cls || 'go'}`} disabled={btn.dis} onClick={btn.on}>{btn.label}</button>}
        </div>

        <div className={`t-sum num${v2 && idle ? ' idle' : ''}`}>
          <div className="r" style={v2 ? { display: 'none' } : undefined}><span>Est. Liquidation Price</span><b>{c.liq != null ? `$${fp(c.liq, c.market.dec)}` : '—'}</b></div>
          <div className="r" style={v2 ? { display: 'none' } : undefined}><span>Expected Price</span><b>${fp(c.px, c.market.dec)}</b></div>
          <div className="r"><span>Order Value</span><b>{usd(c.value)}</b></div>
          <div className="r" style={v2 ? { display: 'none' } : undefined}><span>Margin Required</span><b>{usd(c.margin)}</b></div>
          <div className="r" ref={slipRow}><span><Tip label="Slippage"><b>Est.</b> is how far your average fill is expected to be from the best price, read from the order book. <b>Max</b> is your limit: if the price would move further than this before your order lands, it is not filled. Tap the pencil to change it.</Tip></span><b>Est: {form.kind === 'Market' && c.base > 0 ? slipShow.toFixed(3) + '%' : '-'} / Max: {form.slippage}%<button className="ed" onClick={openSlip} aria-label="Edit Slippage"><Pencil size={14} /></button></b></div>
          <div className="r" style={v2 ? { display: 'none' } : undefined}><span>Fees</span><b>{v2 ? <>{c.base > 0 ? usd(c.fee) : '$0.00'} <em className="mu">({c.feePct.toFixed(3)}%)</em></> : signedIn ? <><s>{c.feePct.toFixed(3)}%</s>{(c.feePct * 0.9).toFixed(4)}%</> : `${c.feePct.toFixed(3)}%`}</b></div>
        </div>
  </>)
  return (
    <section className="panel t-form" ref={root}>
      <button className={`t-cross${ghost ? ' ghost' : ''}`} disabled={!!ghost} onClick={() => { setCrossOpen(o => !o); setAdvOpen(false) }}>
        {ghost && <Lock size={14} />}{form.margin}{!ghost && <ChevronDown size={16} className={`chv${crossOpen ? ' o' : ''}`} />}
      </button>
      {v2 && <div className="t-fhead">{headEl}</div>}
      <div className="t-fscroll" ref={fsRef}>
        <>
        {!v2 && headEl}
        <div className="t-kv"><span>Available to Trade</span>{sk ? <span className="skel" style={{ width: 70, height: 14 }} /> : <b className={`num${live ? '' : ' dim'}`}>{live ? usd(c.avail) : '-'}</b>}</div>
        <div className="t-kv"><span>{v2 ? <Tip label="Current Position"><b>Current position</b> is what you hold in this market now. Once you type a size, it shows what it becomes after this order (now → after).</Tip> : 'Position'}</span>{sk ? <span className="skel" style={{ width: 90, height: 14 }} /> : (
          <b className={`num ${c.pos ? (c.pos.side === 'Long' ? 'buy' : 'sell') : (!live || c.base <= 0 ? 'dim' : '')}`}>
            {!live ? '-' : signedIn && !ghost && c.base > 0 ? <span style={{ color: 'hsl(var(--foreground))' }}>{c.pos ? fmt(c.pos.size, c.bd) : 0} → {fmt(Math.abs(c.newSigned), c.bd)} {baseSym}</span> : c.pos ? `${fmt(c.pos.size, 2)} ${baseSym}` : '-'}
          </b>)}
        </div>

        {form.kind === 'Limit' && (v2 ? (
          <label className="v2-lim"><span>Limit price</span><span className="in"><i>$</i><input inputMode="decimal" placeholder={fp(c.market.px, c.market.dec)} value={form.limit} onChange={e => num(e.target.value) && setForm({ limit: e.target.value })} /></span><button type="button" onClick={() => setForm({ limit: app.mark.toFixed(c.market.dec) })} title="Use the current price">Mid</button></label>
        ) : (
          <div className="t-osz" style={{ marginTop: 12 }}><div className="hd"><span className="tlb" style={{ marginTop: 6 }}>Limit Price</span><span className="num" style={{ display: 'flex', alignItems: 'center' }}><input style={{ font: '400 20px/32px var(--font)' }} placeholder={fp(c.market.px, c.market.dec)} value={form.limit} onChange={e => num(e.target.value) && setForm({ limit: e.target.value })} /></span></div></div>
        ))}
        {form.kind === 'Scale' && (
          <div className="t-tpsl" style={{ gridTemplateColumns: '1fr 1fr 70px' }}>
            <label className="t-tpf"><span>Start</span><input placeholder="0" value={form.lo} onChange={e => num(e.target.value) && setForm({ lo: e.target.value })} /></label>
            <label className="t-tpf"><span>End</span><input placeholder="0" value={form.hi} onChange={e => num(e.target.value) && setForm({ hi: e.target.value })} /></label>
            <label className="t-tpf"><span>#</span><input placeholder="5" value={form.n} onChange={e => num(e.target.value) && setForm({ n: e.target.value })} /></label>
          </div>
        )}
        {form.kind === 'TWAP' && (
          <div className="t-tpsl" style={{ gridTemplateColumns: '1fr' }}>
            <label className="t-tpf"><span>Duration (min)</span><input placeholder="5" value={form.twapMin} onChange={e => num(e.target.value) && setForm({ twapMin: e.target.value })} /></label>
          </div>
        )}

        <div className={`t-osz${foc ? ' foc' : ''}`}>
          <div className="hd">
            <div>
              <div className="tlb">Order Size<div aria-label="You can preview order execution" role="img" style={{ display: 'inline-flex' }}><FlaskConical size={12} /></div></div>
              <button className="t-unit" onClick={swapUnit}>{form.unit === 'base' ? baseSym : 'USDC'}<ArrowLeftRight size={12} /></button>
            </div>
            <div className="rt">
              <input inputMode="decimal" placeholder="0" value={form.size} onFocus={() => setFoc(true)} onBlur={() => setFoc(false)} onChange={e => num(e.target.value) && setForm({ size: e.target.value })} />
              <div className="sub num">{sizeSub}</div>
            </div>
          </div>
          {!v2 && <div className="t-slrow">
            <div className={`t-sl${frac > 0 ? ' act' : ''}${c.maxBase <= 0 ? ' dis' : ''}`} ref={slider}
              onPointerDown={e => { if (c.maxBase <= 0) return; (e.target as HTMLElement).setPointerCapture?.(e.pointerId); fromPointer(e) }}
              onPointerMove={e => { if (e.buttons === 1 && c.maxBase > 0) fromPointer(e) }}>
              <span className="tr" /><span className="fl" style={{ width: `${frac * 100}%` }} />
              {[0, 0.25, 0.5, 0.75, 1].map(s => <span key={s} className="st" style={{ left: `${s * 100}%` }} />)}
              <span className="kn" style={{ left: `${frac * 100}%` }} />
            </div>
            {!v2 && <button className={`t-max${c.maxBase > 0 ? ' on' : ''}`} disabled={c.maxBase <= 0} onClick={() => setBase(c.maxBase)}>MAX<LockKeyholeOpen size={12} /></button>}
          </div>}
        </div>
        {v2 && <div className="v2-pct">{[25, 50, 75, 100].map(p => <button key={p} disabled={c.maxBase <= 0} className={c.maxBase > 0 && Math.abs(frac * 100 - p) < 0.6 ? 'on' : ''} onClick={() => setBase((c.maxBase * p) / 100)}>{p === 100 ? 'Max' : `${p}%`}</button>)}</div>}
        {v2 && !ghost && levBlock}

        {v2 && !ghost && !idle && summary} {/* nothing until a wallet is connected and a size is typed */}
        <div className="t-lev" style={v2 && !ghost ? { display: 'none' } : undefined}>
          <div className="l">{ghost ? 'Position Leverage' : 'Order Leverage'}<Calculator size={12} /></div>
          <span className={`v num${ghost && c.pos ? ' or' : ''}${!(ghost ? c.pos : signedIn && c.base > 0) ? ' dim' : ''}`}>{ghost ? (c.pos ? `${c.pos.lev.toFixed(1)}x` : '-') : signedIn && c.base > 0 ? `${c.levAfter.toFixed(1)}x` : '-'}</span>
        </div>

        <div className="v2-chks">
        <button className={`t-chk muted${reduceDis ? ' dis' : ''}`} onClick={() => !reduceDis && setForm({ reduce: !form.reduce })}><span className={`t-box${form.reduce ? ' on' : ''}`}>{form.reduce && <Check size={10} strokeWidth={3} />}</span>Reduce Only</button>
        <button className={`t-chk${ghost ? ' dis' : ''}`} onClick={tglTpsl} aria-disabled={ghost ? true : undefined} title={ghost ? 'Read-only while watching another trader' : undefined}><span className={`t-box${form.tpsl ? ' on' : ''}`}>{form.tpsl && <Check size={10} strokeWidth={3} />}</span>Take Profit / Stop Loss</button>
        {tpEdit}
        </div>
        {form.tpsl && !v2 && (
          <div className="t-tpsl">
            <label className="t-tpf"><span>TP Price</span><span style={{ display: 'flex', flex: 1 }}><span>$</span><input placeholder="0" value={form.tpPx} onChange={e => onTpPx(e.target.value)} /></span></label>
            <label className="t-tpf"><span>Gain</span><span style={{ display: 'flex', flex: 1, alignItems: 'center' }}><input placeholder="0" value={gShow} onChange={e => onTpG(e.target.value)} /><span>{gMode}</span></span><button onClick={() => setGMode(m => (m === '%' ? '$' : '%'))}><ArrowLeftRight size={13} /></button></label>
            <label className="t-tpf"><span>SL Price</span><span style={{ display: 'flex', flex: 1 }}><span>$</span><input placeholder="0" value={form.slPx} onChange={e => onSlPx(e.target.value)} /></span></label>
            <label className="t-tpf"><span>Loss</span><span style={{ display: 'flex', flex: 1, alignItems: 'center' }}><input placeholder="0" value={lShow} onChange={e => onSlL(e.target.value)} /><span>{lMode}</span></span><button onClick={() => setLMode(m => (m === '%' ? '$' : '%'))}><ArrowLeftRight size={13} /></button></label>
          </div>
        )}

        {tpslRow}
        {!v2 && bottomEl}
        </>
      </div>
      {v2 && <div className="t-ffoot">{bottomEl}</div>}

      {prTp.mounted && v2 && !ghost && (<>
        <div className="v2-scrim" data-state={prTp.state} onClick={() => closeTp(!!app.tpEdit ? false : true)} />
        <div className="v2-tpsheet" data-state={prTp.state}>{sheetEl}</div></>)}
      {prX.mounted && !ghost && (<>{crossOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setCrossOpen(false)} />}
        <div className="t-xpop pop-in" data-state={prX.state}>
          {(['Cross', 'Isolated'] as const).map(m => (
            <button key={m} className={`t-xopt${form.margin === m ? ' on' : ''}`} onClick={() => { setForm({ margin: m }); setCrossOpen(false) }}>
              <span className="rd" /><b>{m}</b>
              <p>{m === 'Cross' ? 'Your entire account balance backs all open positions. Losses on one position can draw from your available margin across the account to prevent liquidation.' : 'Only the margin assigned to a specific position is at risk. Losses are limited to that position’s margin, protecting the rest of your balance.'}</p>
              {v2 && <p className="num" style={{ marginTop: 4 }}>{m === 'Cross' ? 'Est. liquidation uses your whole account balance.' : `Est. liquidation at ${c.L}x: about ${Math.max(0, levDist(c.L) * 100).toFixed(1)}% from entry.`}</p>}
            </button>
          ))}
        </div></>)}
      {prA.mounted && (<>{advOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setAdvOpen(false)} />}
        <div className="t-pop t-advm pop-in" data-state={prA.state} style={{ ['--pop-origin' as string]: 'top right' }}>
          <button className={`it${form.kind === 'Scale' ? ' on' : ''}`} onClick={() => choose('Scale')}>Scale</button>
          <button className={`it${form.kind === 'TWAP' ? ' on' : ''}`} onClick={() => choose('TWAP')}>TWAP</button>
        </div></>)}
      {prS.mounted && (<>{slipOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setSlipOpen(false)} />}
        <div className="t-slip pop-in" data-state={prS.state} style={{ bottom: slipB, ['--pop-origin' as string]: 'bottom right', ['--e-y' as string]: '.5rem', ['--x-y' as string]: '.5rem' }}>
          <div className="ps">
            {[0.05, 0.1, 0.5].map(p => <button key={p} className={form.slippage === p ? 'on' : ''} onClick={() => { setForm({ slippage: p }); setSlipOpen(false) }}>{p}%</button>)}
            <label className={[0.05, 0.1, 0.5].includes(form.slippage) ? '' : 'on'}><input defaultValue={[0.05, 0.1, 0.5].includes(form.slippage) ? '' : form.slippage} placeholder="" onChange={e => { const v = parseFloat(e.target.value); if (v > 0 && v <= 50) setForm({ slippage: v }) }} /><span>%</span></label>
          </div>
          <p>A higher max slippage value increases the likelihood of order execution but at potentially less favorable prices.</p>
        </div></>)}
    </section>
  )
}

function RiskPreview({ c, live }: { c: ReturnType<typeof useOrderCalc>; live: boolean }) {
  const { mark } = useApp()
  const now = new Date(), secs = 3600 - (now.getMinutes() * 60 + now.getSeconds())
  const mm = String(Math.floor(secs / 60)).padStart(2, '0'), ss = String(secs % 60).padStart(2, '0')
  const has = live && c.liq != null && c.base > 0
  const safe = has && ((c.liq as number) <= 0 || Math.abs(mark - (c.liq as number)) / mark >= 0.95)
  const dist = has ? Math.abs(mark - (c.liq as number)) / mark * 100 : 0
  const tier = !has ? null : safe || dist >= 20 ? { n: 'Low Risk', k: 'ok' } : dist >= 10 ? { n: 'At Risk', k: 'mid' } : { n: 'High Risk', k: 'bad' }
  const pay = c.value * (c.market.fund / 100) * (c.long ? 1 : -1)
  return (
    <div className="v2-risk">
      <div className="hd"><span>Risk after this order</span>{tier ? <b className={tier.k}>{tier.n}</b> : <b className="mu">—</b>}</div>
      <div className="bar" aria-hidden><i className={tier?.k ?? ''} style={{ width: `${has ? (safe ? 100 : Math.min(100, dist * 2)) : 0}%` }} /></div>
      <div className="ft num"><span>{safe ? 'No liquidation risk at this size' : has ? `Liquidation is ${dist.toFixed(1)}% away` : 'Enter a size to see how far liquidation is'}</span>{has && !safe && <span>${c.liq!.toFixed(c.market.dec)}</span>}</div>
      <div className="fund num"><span>Funding next hour <em className="mu">in {mm}:{ss}</em></span><b className={pay > 0 ? 'sell' : 'buy'}>{c.base > 0 ? (pay >= 0 ? '-' : '+') + usd(Math.abs(pay)) : '—'}</b></div>
    </div>
  )
}

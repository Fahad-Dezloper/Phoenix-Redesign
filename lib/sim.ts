// Mock exchange engine. Everything the UI shows (prices, candles, trades, positions, orders, funding)
// comes from here so screens behave like the live app: prices walk, candles form, limit orders rest
// until price crosses, TP/SL trigger, positions can be liquidated, funding accrues.
import { MARKETS } from './data'
import { buildCandles, type Candle } from './candles'

export type Side = 'Long' | 'Short'
export type Pos = { id: number; sym: string; side: Side; size: number; entry: number; t: number; tp?: number; sl?: number; funding: number }
export type Ord = { id: number; sym: string; side: Side; kind: 'Limit' | 'Scale'; price: number; size: number; reduce: boolean; t: number }
export type Twap = { id: number; sym: string; side: Side; total: number; n: number; done: number; next: number; t0: number }
export type FillKind = 'Open Long' | 'Close Long' | 'Open Short' | 'Close Short'
export type Fill = { id: number; sym: string; size: number; price: number; kind: FillKind; pnl?: number; roi?: number; fee: number; t: number }
export type Hist = { id: number; sym: string; side: Side; kind: string; price: number; size: number; status: 'Filled' | 'Cancelled' | 'Triggered' | 'Liquidated'; t: number }
export type Fund = { sym: string; side: Side; amount: number; rate: number; t: number; pos?: number }
export type Note = { id: number; title: string; text: string; t: number }
export type Trade = { p: number; s: number; side: 'buy' | 'sell'; t: number }

// seconds a candle stays open in the demo (real life would be minutes); keeps the chart visibly alive
const PERIOD: Record<string, number> = { '1m': 4, '5m': 6, '15m': 8, '1h': 12, '4h': 16 }
const VOLF: Record<string, number> = { '1m': 0.5, '5m': 0.8, '15m': 1, '1h': 1.6, '4h': 2.4 }
const SIGMA: Record<string, number> = { BTC: 0.6, ETH: 0.8, SOL: 1 }
const FUND_RATE: Record<string, number> = { BTC: 0.0012, SOL: 0.0015, ETH: 0.0009 }
export const TAKER = 0.00035, MAKER = 0.00005, MAINT = 0.05
const seedOf = (s: string) => [...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 9973
const r = (n: number, d = 3) => +n.toFixed(d)
const dec = (sym: string) => (MARKETS.find(m => m.sym === sym) ?? MARKETS[0]).dec

type Series = { c: Candle[]; t0: number }
export const E = {
  marks: Object.fromEntries(MARKETS.map(m => [m.sym, m.px])) as Record<string, number>,
  drift: {} as Record<string, number>,
  series: new Map<string, Series>(),
  trades: {} as Record<string, Trade[]>,
  positions: [] as Pos[], orders: [] as Ord[], twaps: [] as Twap[],
  fills: [] as Fill[], hist: [] as Hist[], funding: [] as Fund[], notes: [] as Note[],
  eq: [] as { t: number; v: number }[],
  collateral: 2.39, realized: 0, fees: 0, deposited: 2.39, withdrawn: 0, traded: 0, unread: 0, dw: [{ t: Date.now() - 6 * 36e5, kind: 'Deposit', amount: 2.39 }] as { t: number; kind: 'Deposit' | 'Withdrawal'; amount: number }[],
  tickN: 0, id: 1, lastFund: Date.now(), lastEq: 0,
  onEvent: null as null | ((text: string, kind?: 'ok' | 'err') => void),

  reset() {
    Object.assign(E, { positions: [], orders: [], twaps: [], fills: [], hist: [], funding: [], notes: [], eq: [], collateral: 2.39, realized: 0, fees: 0, deposited: 2.39, withdrawn: 0, traded: 0, unread: 0, dw: [{ t: Date.now() - 6 * 36e5, kind: 'Deposit', amount: 2.39 }] })
  },

  // Empty account with a deposit (?fresh, used by the demo videos): no positions, orders or history.
  fresh(usd: number) { E.reset(); E.collateral = usd; E.deposited = usd; E.dw = [{ t: Date.now(), kind: 'Deposit', amount: usd }] },

  // Demo account for the redesign (?v2): positions, resting orders, fills, order history, funding and a deposit trail.
  seedDemo() {
    E.reset()
    const H = 36e5, now = Date.now(), mk = (s: string) => E.marks[s] ?? 1
    let s = 11; const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
    const sz = (sym: string, usd: number) => r(usd / mk(sym), mk(sym) >= 1000 ? 4 : mk(sym) >= 100 ? 2 : 1)
    E.collateral = 4820.4; E.deposited = 4500; E.withdrawn = 0; E.realized = 612.18; E.fees = 41.7; E.traded = 118400
    E.dw = [{ t: now - 19 * 24 * H, kind: 'Deposit', amount: 3000 }, { t: now - 11 * 24 * H, kind: 'Deposit', amount: 1500 }, { t: now - 5 * 24 * H, kind: 'Withdrawal', amount: -250 }, { t: now - 2 * 24 * H, kind: 'Deposit', amount: 250 }]
    E.deposited = 4750; E.withdrawn = 250
    const open = (sym: string, side: Side, usd: number, edge: number, ago: number, tp?: number, sl?: number) => { const size = sz(sym, usd), entry = r(mk(sym) * (1 + edge), mk(sym) < 10 ? 4 : 2); E.positions.push({ id: E.id++, sym, side, size, entry, t: now - ago * H, tp, sl, funding: r(-(usd * 0.00004 * ago * (side === 'Long' ? 1 : -1)), 2) }) }
    open('SOL', 'Long', 3800, -0.021, 31, r(mk('SOL') * 1.08, 2), r(mk('SOL') * 0.94, 2))
    open('ETH', 'Short', 5200, 0.012, 14)
    open('NVDA', 'Long', 2600, -0.034, 52, undefined, r(mk('NVDA') * 0.9, 2))
    for (const p of E.positions) E.fills.unshift({ id: E.id++, sym: p.sym, size: p.size, price: p.entry, kind: p.side === 'Long' ? 'Open Long' : 'Open Short', fee: p.size * p.entry * TAKER, t: p.t })
    E.orders.push({ id: E.id++, sym: 'SOL', side: 'Long', kind: 'Limit', price: r(mk('SOL') * 0.95, 2), size: sz('SOL', 1500), reduce: false, t: now - 3 * H })
    E.orders.push({ id: E.id++, sym: 'BTC', side: 'Short', kind: 'Limit', price: r(mk('BTC') * 1.04, 0), size: sz('BTC', 2000), reduce: false, t: now - 9 * H })
    E.orders.push({ id: E.id++, sym: 'HYPE', side: 'Long', kind: 'Limit', price: r(mk('HYPE') * 0.93, 2), size: sz('HYPE', 900), reduce: false, t: now - 26 * H })
    const past: [string, Side, number, number, number, number][] = [['BTC', 'Long', 4000, 0.031, 62, 188.4], ['SOL', 'Short', 1800, 0.021, 80, 41.2], ['HYPE', 'Long', 1500, -0.018, 96, -27.5], ['ETH', 'Long', 2200, 0.026, 120, 64.9], ['AMD', 'Long', 1200, 0.044, 150, 52.1], ['SOL', 'Long', 2500, -0.012, 170, -18.3], ['BTC', 'Short', 3000, -0.015, 200, 71.6]]
    for (const [sym, side, usd, mv, ago, pnl] of past) { const size = sz(sym, usd), px = mk(sym) * (1 + mv * 0.4), cpx = px * (1 + mv); E.fills.push({ id: E.id++, sym, size, price: r(px, 2), kind: side === 'Long' ? 'Open Long' : 'Open Short', fee: size * px * TAKER, t: now - (ago + 5) * H }, { id: E.id++, sym, size, price: r(cpx, 2), kind: side === 'Long' ? 'Close Long' : 'Close Short', pnl, roi: (pnl / (usd / 10)) * 100, fee: size * cpx * TAKER, t: now - ago * H }); E.hist.push({ id: E.id++, sym, side, kind: 'Market', price: r(px, 2), size, status: 'Filled', t: now - (ago + 5) * H }, { id: E.id++, sym, side: side === 'Long' ? 'Short' : 'Long', kind: 'Market', price: r(cpx, 2), size, status: 'Filled', t: now - ago * H }) }
    E.fills.sort((a, b) => b.t - a.t)
    E.hist.push({ id: E.id++, sym: 'SOL', side: 'Long', kind: 'Limit', price: r(mk('SOL') * 0.9, 2), size: sz('SOL', 1000), status: 'Cancelled', t: now - 40 * H }, { id: E.id++, sym: 'NVDA', side: 'Long', kind: 'Stop Loss', price: r(mk('NVDA') * 0.9, 2), size: 1, status: 'Cancelled', t: now - 70 * H }, { id: E.id++, sym: 'ETH', side: 'Short', kind: 'Take Profit', price: r(mk('ETH') * 0.9, 2), size: 0.5, status: 'Triggered', t: now - 110 * H })
    E.hist.sort((a, b) => b.t - a.t)
    for (const p of E.positions) for (let i = 1; i <= 12; i++) { const rate = 0.0008 + rnd() * 0.0012, amt = -(p.size * mk(p.sym) * rate / 100) * (p.side === 'Long' ? 1 : -1) * (i % 5 === 0 ? -0.6 : 1); E.funding.push({ sym: p.sym, side: p.side, amount: r(amt, 4), rate, t: now - i * 11 * H, pos: p.side === 'Long' ? p.size : -p.size }) /* demo funding spread over ~5 days so daily views (Rewards) have real variation */ }
    E.funding.sort((a, b) => b.t - a.t)
    let v = 4300; E.eq = Array.from({ length: 168 }, (_, i) => { v += (rnd() - 0.46) * 60; return { t: now - (168 - i) * H, v } })
  },

  // ---- account maths (cross margin, 10x initial, 5% maintenance) ----
  value(p: Pos) { return p.size * E.marks[p.sym] },
  upnl(p: Pos) { return (E.marks[p.sym] - p.entry) * p.size * (p.side === 'Long' ? 1 : -1) },
  totalUpnl() { return E.positions.reduce((a, p) => a + E.upnl(p), 0) },
  equity() { return E.collateral + E.totalUpnl() },
  initMargin() { return E.positions.reduce((a, p) => a + (p.size * p.entry) / 10, 0) },
  maint() { return E.positions.reduce((a, p) => a + E.value(p) * MAINT, 0) },
  available() { return Math.max(0, E.equity() - E.initMargin()) },
  liq(p: Pos) {
    const room = E.equity() - E.maint(), mk = E.marks[p.sym]
    const v = p.side === 'Long' ? mk - room / p.size : mk + room / p.size
    return Math.max(0, v)
  },
  find(sym: string) { return E.positions.find(p => p.sym === sym) },
  signed(sym: string) { const p = E.find(sym); return p ? (p.side === 'Long' ? p.size : -p.size) : 0 },

  candles(sym: string, tf: string): Candle[] {
    const k = sym + '|' + tf; let s = E.series.get(k)
    if (!s) { const mk = E.marks[sym]; s = { c: buildCandles(140, mk, mk * 0.0022 * (VOLF[tf] ?? 1), seedOf(k), sym === 'SOL' ? 0 : 1), t0: Date.now() }; E.series.set(k, s) }
    return s.c
  },
  countdown(sym: string, tf: string) { const s = E.series.get(sym + '|' + tf); if (!s) return 0; return Math.max(0, Math.ceil(((PERIOD[tf] ?? 8) * 1000 - (Date.now() - s.t0)) / 1000)) },

  note(title: string, text: string) { E.notes.unshift({ id: E.id++, title, text, t: Date.now() }); E.unread++ },
  say(text: string, kind: 'ok' | 'err' = 'ok') { E.onEvent?.(text, kind) },

  // ---- execution ----
  apply(sym: string, side: Side, size: number, price: number, maker: boolean) {
    size = r(size); if (size <= 0) return
    const fee = size * price * (maker ? MAKER : TAKER); E.collateral -= fee; E.fees += fee; E.traded += size * price
    const p = E.find(sym)
    const push = (kind: FillKind, sz: number, pnl?: number, roi?: number) => E.fills.unshift({ id: E.id++, sym, size: sz, price, kind, pnl, roi, fee: fee * (sz / size), t: Date.now() })
    if (!p) { E.positions.push({ id: E.id++, sym, side, size, entry: price, t: Date.now(), funding: 0 }); push(side === 'Long' ? 'Open Long' : 'Open Short', size) }
    else if (p.side === side) { p.entry = (p.entry * p.size + price * size) / (p.size + size); p.size = r(p.size + size); push(side === 'Long' ? 'Open Long' : 'Open Short', size) }
    else {
      const q = Math.min(p.size, size), pnl = (price - p.entry) * q * (p.side === 'Long' ? 1 : -1)
      E.collateral += pnl; E.realized += pnl
      push(p.side === 'Long' ? 'Close Long' : 'Close Short', q, pnl, (pnl / ((q * p.entry) / 10)) * 100)
      p.size = r(p.size - q)
      const rem = r(size - q)
      if (p.size <= 0) { E.positions = E.positions.filter(x => x !== p); if (rem > 0) { E.positions.push({ id: E.id++, sym, side, size: rem, entry: price, t: Date.now(), funding: 0 }); push(side === 'Long' ? 'Open Long' : 'Open Short', rem) } }
    }
  },
  // guard = guaranteed price (v2): the order is sent with that price as its limit, so it fills at that price or better, never worse.
  // quoteMark = the mark when the price was quoted; the fill follows the market's move since then, clamped at the guard.
  market(sym: string, side: Side, size: number, reduce = false, guard?: number, quoteMark?: number, exp?: number): { ok: boolean; err?: string; price?: number } {
    const p = E.find(sym)
    if (reduce) { if (!p || p.side === side) return { ok: false, err: 'Reduce-only order would increase position' }; size = Math.min(size, p.size) }
    const mk = E.marks[sym], slip = (Math.random() * 0.0004) * (side === 'Long' ? 1 : -1)
    let fill = r(mk * (1 + slip), dec(sym) + 1)
    if (guard && quoteMark) { const moved = (exp ?? guard) * (mk / quoteMark); fill = r(side === 'Long' ? Math.min(moved, guard) : Math.max(moved, guard), dec(sym) + 1) }
    E.apply(sym, side, size, fill, false)
    E.hist.unshift({ id: E.id++, sym, side, kind: 'Market', price: guard ? fill : mk, size, status: 'Filled', t: Date.now() })
    return { ok: true, price: fill }
  },
  limit(sym: string, side: Side, price: number, size: number, reduce: boolean, kind: 'Limit' | 'Scale' = 'Limit') {
    const mk = E.marks[sym]
    if ((side === 'Long' && price >= mk) || (side === 'Short' && price <= mk)) { E.apply(sym, side, size, mk, false); E.hist.unshift({ id: E.id++, sym, side, kind, price, size, status: 'Filled', t: Date.now() }); return }
    E.orders.push({ id: E.id++, sym, side, kind, price, size, reduce, t: Date.now() })
  },
  scale(sym: string, side: Side, lo: number, hi: number, n: number, total: number, ad: number) {
    const w = Array.from({ length: n }, (_, i) => 1 + ad * (n === 1 ? 0 : (i / (n - 1) - 0.5) * 1.8)), sw = w.reduce((a, b) => a + b, 0)
    for (let i = 0; i < n; i++) E.limit(sym, side, r(lo + ((hi - lo) * i) / Math.max(1, n - 1), dec(sym)), r((total * w[i]) / sw), false, 'Scale')
  },
  twap(sym: string, side: Side, total: number, n: number) { E.twaps.push({ id: E.id++, sym, side, total, n, done: 0, next: Date.now() + 800, t0: Date.now() }) },
  close(sym: string, frac = 1) {
    const p = E.find(sym); if (!p) return
    const q = frac >= 0.999 ? p.size : r(p.size * frac)
    E.apply(sym, p.side === 'Long' ? 'Short' : 'Long', q, E.marks[sym], false)
    E.hist.unshift({ id: E.id++, sym, side: p.side === 'Long' ? 'Short' : 'Long', kind: 'Market', price: E.marks[sym], size: q, status: 'Filled', t: Date.now() })
  },
  cancel(id: number) {
    const o = E.orders.find(x => x.id === id); if (!o) return
    E.orders = E.orders.filter(x => x !== o)
    E.hist.unshift({ id: E.id++, sym: o.sym, side: o.side, kind: o.kind, price: o.price, size: o.size, status: 'Cancelled', t: Date.now() })
  },
  setTpsl(sym: string, tp?: number, sl?: number) { const p = E.find(sym); if (p) { p.tp = tp; p.sl = sl } },

  // Static trade tape for the frozen video stage (?freeze never ticks, so the Trade List would stay empty).
  seedTrades() {
    for (const m of MARKETS) {
      const base = E.marks[m.sym] ?? m.px, s = m.px * 0.00045 * (SIGMA[m.sym] ?? 1.1), now = Date.now(), arr: Trade[] = []
      for (let i = 0; i < 40; i++) { const buy = Math.random() < 0.55; arr.push({ p: r(base + (Math.random() - 0.5) * s * 2, m.dec), s: r(Math.exp(3 + Math.random() * 4.5), 2), side: buy ? 'buy' : 'sell', t: now - i * 1700 }) }
      E.trades[m.sym] = arr
    }
  },

  // ---- clock ----
  tick() {
    E.tickN++
    for (const m of MARKETS) {
      const s = m.px * 0.00045 * (SIGMA[m.sym] ?? 1.1), prev = E.marks[m.sym]
      const d = (E.drift[m.sym] = (E.drift[m.sym] ?? 0) * 0.9 + (Math.random() - 0.5) * s * 0.5)
      const next = r(prev + d + (Math.random() - 0.5) * 2 * s + (m.px - prev) * 0.004, m.dec)
      E.marks[m.sym] = next
      const arr = (E.trades[m.sym] ??= [])
      for (let i = 0, n = Math.random() < 0.7 ? 1 + Math.floor(Math.random() * 2) : 0; i < n; i++) {
        const buy = next >= prev ? Math.random() < 0.75 : Math.random() < 0.25
        arr.unshift({ p: r(next + (Math.random() - 0.5) * s * 0.4, m.dec), s: r(Math.exp(3 + Math.random() * 4.5), 2), side: buy ? 'buy' : 'sell', t: Date.now() })
      }
      if (arr.length > 40) arr.length = 40
    }
    const now = Date.now()
    for (const [k, s] of E.series) {
      const sym = k.split('|')[0], tf = k.split('|')[1], mk = E.marks[sym], last = s.c[s.c.length - 1]
      last.c = mk; last.h = Math.max(last.h, mk); last.l = Math.min(last.l, mk); last.v += Math.round(Math.random() * 900)
      if (now - s.t0 >= (PERIOD[tf] ?? 8) * 1000) { s.c.push({ o: mk, c: mk, h: mk, l: mk, v: 0 }); s.c.shift(); s.t0 = now }
    }
    // resting limit / scale orders
    for (const o of [...E.orders]) {
      const mk = E.marks[o.sym]
      if ((o.side === 'Long' && mk <= o.price) || (o.side === 'Short' && mk >= o.price)) {
        E.orders = E.orders.filter(x => x !== o)
        let sz = o.size; if (o.reduce) { const p = E.find(o.sym); if (!p || p.side === o.side) continue; sz = Math.min(sz, p.size) }
        E.apply(o.sym, o.side, sz, o.price, true)
        E.hist.unshift({ id: E.id++, sym: o.sym, side: o.side, kind: o.kind, price: o.price, size: sz, status: 'Filled', t: now })
        E.note(`${o.kind} Order Filled`, `${o.side} ${sz} ${o.sym} @ $${o.price.toFixed(dec(o.sym))}`); E.say(`${o.kind} Order Filled`)
      }
    }
    // take profit / stop loss
    for (const p of [...E.positions]) {
      const mk = E.marks[p.sym], L = p.side === 'Long'
      const hitTp = p.tp != null && (L ? mk >= p.tp : mk <= p.tp), hitSl = p.sl != null && (L ? mk <= p.sl : mk >= p.sl)
      if (hitTp || hitSl) {
        const pnl = E.upnl(p); E.close(p.sym)
        E.hist.unshift({ id: E.id++, sym: p.sym, side: L ? 'Short' : 'Long', kind: hitTp ? 'Take Profit' : 'Stop Loss', price: mk, size: p.size, status: 'Triggered', t: now })
        E.note(hitTp ? 'Take Profit Triggered' : 'Stop Loss Triggered', `${p.sym} closed ${pnl >= 0 ? '+' : '-'}$${Math.abs(pnl).toFixed(2)}`); E.say(hitTp ? 'Take Profit Triggered' : 'Stop Loss Triggered')
      }
    }
    // TWAP slices
    for (const t of [...E.twaps]) if (now >= t.next) {
      E.apply(t.sym, t.side, r(t.total / t.n), E.marks[t.sym], false); t.done++; t.next = now + 1000
      if (t.done >= t.n) { E.twaps = E.twaps.filter(x => x !== t); E.hist.unshift({ id: E.id++, sym: t.sym, side: t.side, kind: 'TWAP', price: E.marks[t.sym], size: t.total, status: 'Filled', t: now }); E.note('TWAP Completed', `${t.side} ${t.total} ${t.sym}`); E.say('TWAP Order Completed') }
    }
    // funding: longs pay when the rate is positive (accelerated so it is visible)
    if (E.positions.length && now - E.lastFund > 20000) {
      E.lastFund = now
      for (const p of E.positions) {
        const rate = (FUND_RATE[p.sym] ?? 0.002) / 100 * 20, amt = -(p.side === 'Long' ? 1 : -1) * E.value(p) * rate
        E.collateral += amt; p.funding += amt; E.funding.unshift({ sym: p.sym, side: p.side, amount: amt, rate: rate * 100, t: now, pos: p.side === 'Long' ? p.size : -p.size })
      }
    }
    // liquidation
    if (E.positions.length && E.equity() <= E.maint()) {
      for (const p of [...E.positions]) E.hist.unshift({ id: E.id++, sym: p.sym, side: p.side, kind: 'Liquidation', price: E.marks[p.sym], size: p.size, status: 'Liquidated', t: now })
      E.collateral = Math.max(0, E.equity()); E.positions = []; E.orders = []
      E.note('Position Liquidated', 'Your equity fell below maintenance margin.'); E.say('Position Liquidated', 'err')
    }
    if (now - E.lastEq > 2000) { E.lastEq = now; E.eq.push({ t: now, v: E.equity() }); if (E.eq.length > 90) E.eq.shift() }
  },
}

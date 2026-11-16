// One account shape for the UI, built either from the live mock engine (the user) or from a static "ghost" trader.
import { E, MAINT, type Fill, type Hist, type Fund, type Ord, type Twap } from './sim'
import { bySym } from './data'

export type PosRow = { sym: string; side: 'Long' | 'Short'; size: number; value: number; entry: number; mark: number; liq: number; upnl: number; roi: number; margin: number; funding: number; lev: number; tp?: number; sl?: number }
export type DW = { t: number; kind: 'Deposit' | 'Withdrawal'; amount: number }
export type Account = {
  ghost: boolean; addr: string
  equity: number; available: number; collateral: number; isolated: number; exposure: number
  upnl: number; initMargin: number; maintMargin: number; realized: number; funding: number; fees: number
  deposited: number; withdrawn: number; traded: number; health: number
  positions: PosRow[]; orders: Ord[]; twaps: Twap[]; fills: Fill[]; hist: Hist[]; fund: Fund[]; dw: DW[]
  eq: { t: number; v: number }[]
}

export function userAccount(): Account {
  const equity = E.equity(), maint = E.maint(), init = E.initMargin()
  const positions: PosRow[] = E.positions.map(p => {
    const value = E.value(p), upnl = E.upnl(p), margin = (p.size * p.entry) / 10
    return { sym: p.sym, side: p.side, size: p.size, value, entry: p.entry, mark: E.marks[p.sym], liq: E.liq(p), upnl, roi: margin ? (upnl / margin) * 100 : 0, margin, funding: p.funding, lev: equity > 0 ? value / equity : 0, tp: p.tp, sl: p.sl }
  })
  const exposure = positions.reduce((a, p) => a + p.value, 0)
  return {
    ghost: false, addr: '7xKX…9aQp', equity, available: E.available(), collateral: E.collateral, isolated: 0, exposure,
    upnl: E.totalUpnl(), initMargin: init, maintMargin: maint, realized: E.realized, funding: E.funding.reduce((a, f) => a + f.amount, 0), fees: -E.fees,
    deposited: E.deposited, withdrawn: E.withdrawn, traded: E.traded, health: equity > 0 ? Math.max(0, Math.min(100, 100 - (maint / equity) * 100)) : 100,
    positions, orders: E.orders, twaps: E.twaps, fills: E.fills, hist: E.hist, fund: E.funding, dw: E.dw, eq: E.eq,
  }
}

// ---- ghost traders (public leaderboard accounts, values from the live site on 10 Nov 2026) ----
const H = 36e5, now = () => Date.now()
function ghostEq(base: number, seedn: number, spike = false) {
  let s = seedn, v = base * 0.97; const out: { t: number; v: number }[] = []
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296)
  for (let i = 0; i < 168; i++) { v += (rnd() - 0.5) * base * 0.012; if (spike && i === 60) v += base * 0.3; if (spike && i === 90) v -= base * 0.3; out.push({ t: now() - (168 - i) * H, v }) }
  return out
}
const fund = (n: number, sym: string, pos: number): Fund[] => Array.from({ length: n }, (_, i) => ({ sym, side: 'Short' as const, amount: 7.7 * (i % 7 === 1 ? 0.9 : 1), rate: 0.0013, t: now() - (i + 1) * H, pos } as Fund))

function build(addr: string, p: Partial<Account>): Account {
  return { ghost: true, addr, equity: 0, available: 0, collateral: 0, isolated: 0, exposure: 0, upnl: 0, initMargin: 0, maintMargin: 0, realized: 0, funding: 0, fees: 0, deposited: 0, withdrawn: 0, traded: 0, health: 100, positions: [], orders: [], twaps: [], fills: [], hist: [], fund: [], dw: [], eq: [], ...p }
}
const row = (sym: string, side: 'Long' | 'Short', size: number, entry: number, lev: number, collat: number, funding: number): PosRow => {
  const mark = bySym(sym).px, value = size * mark, upnl = (mark - entry) * size * (side === 'Long' ? 1 : -1)
  return { sym, side, size, value, entry, mark, liq: entry * 1.0, upnl, roi: (upnl / collat) * 100, margin: collat, funding, lev }
}
// ghost accounts are static public data: build each once so switching to one is free and its object stays referentially stable
const gcache = new Map<string, Account>()
export function ghostAccount(addr: string): Account {
  let a = gcache.get(addr); if (!a) { a = buildGhost(addr); gcache.set(addr, a) }
  return a
}
function buildGhost(addr: string): Account {
  if (addr.startsWith('3ctH')) {
    const p = row('SOL', 'Short', 7157.97, 99.65, 5.9, 24786.62, 8346.32); p.liq = 99.16
    return build(addr, {
      equity: 104455.66, available: 79462.18, collateral: 10555.8, exposure: p.value, upnl: p.upnl, initMargin: 24786.62, maintMargin: 12393.31, realized: 87929.95, funding: 8614.8, fees: -3555.89,
      deposited: 715209.24, withdrawn: 800003.71, traded: 11288451.11, health: 88, positions: [p], eq: ghostEq(104000, 41, true),
      dw: [{ t: Date.parse('2026-11-09T14:44:00'), kind: 'Deposit', amount: 10236.38 }, { t: Date.parse('2026-11-09T12:49:00'), kind: 'Withdrawal', amount: -10343.32 }],
    })
  }
  if (addr.startsWith('EfMw')) {
    const p = row('SOL', 'Short', 6998.56, 99.4, 5.8, 24200, 7.69 * 40); p.liq = 98.9
    const fills = [
      { id: 1, sym: 'SOL', size: 2.27, price: 87.58, kind: 'Open Short' as const, fee: 0.06, t: Date.parse('2026-11-09T08:50:00') },
      { id: 2, sym: 'SOL', size: 2.27, price: 87.57, kind: 'Open Short' as const, fee: 0.06, t: Date.parse('2026-11-09T08:49:00') },
      { id: 3, sym: 'SOL', size: 2.27, price: 87.53, kind: 'Open Short' as const, fee: 0.06, t: Date.parse('2026-11-09T08:49:00') },
      { id: 4, sym: 'SOL', size: 2.3, price: 86.72, kind: 'Open Short' as const, fee: 0.06, t: Date.parse('2026-11-09T03:24:00') },
      { id: 5, sym: 'SOL', size: 2.29, price: 86.74, kind: 'Open Short' as const, fee: 0.06, t: Date.parse('2026-11-09T03:24:00') },
      { id: 6, sym: 'SOL', size: 2.27, price: 87.62, kind: 'Close Short' as const, pnl: 26.16, roi: 290.55, fee: 0.06, t: Date.parse('2026-11-09T03:21:00') },
    ]
    const hist = fills.map(f => ({ id: f.id, sym: 'SOL', side: 'Short' as const, kind: 'Market', price: f.price, size: f.size, status: 'Filled' as const, t: f.t }))
    return build(addr, {
      equity: 105190.6, available: 80969.98, collateral: 10600, exposure: p.value, upnl: p.upnl, initMargin: 24200, maintMargin: 12100, realized: 40210.4, funding: 6120.2, fees: -2210.4,
      deposited: 500000, withdrawn: 460000, traded: 8120000, health: 86, positions: [p], eq: ghostEq(105000, 7), fills, hist, fund: fund(24, 'SOL', -6998.56),
      dw: [{ t: Date.parse('2026-11-08T10:20:00'), kind: 'Deposit', amount: 5000 }],
    })
  }
  // generic ghost: a modest long position and some history
  const p = row('SOL', 'Long', 120.5, 84.2, 3.2, 3400, 12.4)
  return build(addr, {
    equity: 25000, available: 18000, collateral: 21000, exposure: p.value, upnl: p.upnl, initMargin: 3400, maintMargin: 520, realized: 3200, funding: 12, fees: -140,
    deposited: 20000, withdrawn: 0, traded: 410000, health: 94, positions: [p], eq: ghostEq(25000, 99),
  })
}
export { MAINT }

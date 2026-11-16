'use client'
// App state for the Phoenix web replica: session, selected market, order form, dialogs, toasts, and the mock exchange clock.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react'
import { MARKETS, bySym, setFormats, type Market } from './data'
import { E, type Side } from './sim'
import { userAccount, ghostAccount, type Account } from './account'

export type Dialog = null | 'login' | 'settings' | 'deposit' | 'withdraw' | 'compare' | 'confirm' | 'close' | 'closeall' | 'share' | 'tpsl'
export type OrderKind = 'Market' | 'Limit' | 'Scale' | 'TWAP'
export type Toast = { id: number; text: string; kind: 'loading' | 'ok' | 'err' | 'info' } | null
export type Settings = { language: string; numberFormat: string; dateFormat: string; explorer: string; notifySecs: number; publicBoard: boolean; confirmOrders: boolean; soundOn: boolean; chartPrice: 'Last Price' | 'Mark Price'; showPositionLines: boolean; resetForm: boolean; chartOpts: ChartOpts }
// chart overlay switches, shared by the chart's own settings popover and Settings > Chart
export type ChartOpts = Record<'act' | 'marks' | 'orders' | 'form' | 'formLimit' | 'formLiq' | 'formEntry' | 'formTpsl' | 'pos' | 'posEntry' | 'posLiq' | 'posTpsl', boolean>
export const CHART_OPTS: ChartOpts = { act: true, marks: true, orders: true, form: true, formLimit: true, formLiq: true, formEntry: true, formTpsl: true, pos: true, posEntry: true, posLiq: true, posTpsl: true }
export type Form = { side: Side; kind: OrderKind; unit: 'base' | 'usd'; size: string; limit: string; lo: string; hi: string; n: string; twapMin: string; reduce: boolean; tpsl: boolean; tpPx: string; tpGain: string; slPx: string; slLoss: string; slippage: number; margin: 'Cross' | 'Isolated'; lev: number }

type S = {
  v2: boolean; view: 'default' | 'all' | 'depth' | 'chart' | 'trades'; tkLanes: ['active' | 'movers' | 'favs', 'active' | 'movers' | 'favs' | null]; tkDisp: ['pct' | 'abs' | 'px', 'pct' | 'abs' | 'px']; tkSplit: number; signedIn: boolean; ghost: string | null; sym: string; tf: string; chartPrice: 'Last Price' | 'Mark Price'
  dialog: Dialog; dialogArg: string; settingsTab: 'General' | 'Trading' | 'Chart'
  form: Form; rightTab: 'book' | 'trades'; bottomTab: string; filterMarket: string; filterSide: 'Both' | 'Long' | 'Short'
  favs: string[]; toast: Toast; settings: Settings; loginStep: 'choose' | 'connecting'
  loading: { chart: boolean; book: boolean; acct: boolean }
  watch: string[] // traders being watched in Ghost Mode (max 3); `ghost` is the one currently shown
  compare: string[] // v2 chart: markets overlaid as % change lines (max 2)
  tpEdit: string | null; tpFocus: boolean // editing the TP/SL of an open position; focus mode (everything but the sheet, chart and book is dimmed)
}
const initForm: Form = { side: 'Long', kind: 'Market', unit: 'base', size: '', limit: '', lo: '', hi: '', n: '5', twapMin: '5', reduce: false, tpsl: false, tpPx: '', tpGain: '', slPx: '', slLoss: '', slippage: 1, margin: 'Cross', lev: 5 }
const initSettings: Settings = { language: 'English', numberFormat: '1,234.56', dateFormat: 'MM/DD/YY', explorer: 'Solscan', notifySecs: 6, publicBoard: true, confirmOrders: true, soundOn: false, chartPrice: 'Last Price', showPositionLines: true, resetForm: true, chartOpts: CHART_OPTS }
const init: S = {
  v2: true, view: 'default', tkLanes: ['active', null], tkDisp: ['pct', 'pct'], tkSplit: 0.5, signedIn: false, ghost: null, sym: 'SOL', tf: '1h', chartPrice: 'Last Price', dialog: null, dialogArg: '', settingsTab: 'General',
  form: initForm, rightTab: 'book', bottomTab: 'Positions', filterMarket: 'All', filterSide: 'Both', favs: [], toast: null, settings: initSettings, loginStep: 'choose',
  loading: { chart: true, book: true, acct: false }, tpEdit: null, tpFocus: false, watch: [], compare: [],
}
type Ctx = S & {
  set: (p: Partial<S>) => void; setForm: (p: Partial<Form>) => void; openDialog: (d: Dialog, arg?: string) => void; closeDialog: () => void
  market: Market; mark: number; chg: number; acct: Account; tickN: number; unread: number
  signIn: (method: 'google' | 'wallet' | 'email') => void; signOut: () => void; enterGhost: (addr: string) => void; exitGhost: () => void; watchAdd: (addr: string, activate?: boolean) => boolean; watchRemove: (addr: string) => void
  place: (q?: { guard: number; mark: number; exp?: number }) => void; closePos: (sym: string, frac?: number) => void; closeAll: () => void; cancel: (id: number) => void; cancelAll: () => void
  startTpEdit: (sym: string) => void; endTpEdit: (save: boolean) => void
  setTpsl: (sym: string, tp?: number, sl?: number) => void; deposit: (n: number) => void; withdraw: (n: number) => void; toggleFav: (sym: string) => void
  say: (text: string, kind?: 'loading' | 'ok' | 'err' | 'info', ms?: number) => void
}
const C = createContext<Ctx>(null as never)
export const useApp = () => useContext(C)
const wait = (a = 900, b = 1700) => a + Math.random() * (b - a)

export function Provider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<S>(init)
  const ref = useRef(s); ref.current = s
  const [tickN, bump] = useReducer((x: number) => x + 1, 0)
  const timers = useRef<number[]>([])
  const tpBak = useRef<Partial<Form> | null>(null) // the order form's own TP/SL values, restored when a position edit ends
  const later = (f: () => void, ms: number) => { timers.current.push(window.setTimeout(f, ms)) }
  const set = useCallback((p: Partial<S>) => {
    // closing a dialog keeps it mounted for 150ms (html[data-closing]) so the exit animation can play
    if ('dialog' in p && p.dialog === null && ref.current.dialog) {
      const { dialog: _d, ...rest } = p; void _d
      document.documentElement.dataset.closing = '1'
      setS(x => ({ ...x, ...rest }))
      window.setTimeout(() => { delete document.documentElement.dataset.closing; setS(x => ({ ...x, dialog: null })) }, 150)
      return
    }
    setS(x => ({ ...x, ...p }))
  }, [])
  const setForm = useCallback((p: Partial<Form>) => setS(x => ({ ...x, form: { ...x.form, ...p } })), [])
  const tid = useRef(1)
  const say = useCallback((text: string, kind: 'loading' | 'ok' | 'err' | 'info' = 'ok', ms = 0) => {
    const id = tid.current++
    setS(x => ({ ...x, toast: { id, text, kind } }))
    const life = ms || (kind === 'loading' ? 0 : ref.current.settings.notifySecs * 1000)
    if (life) window.setTimeout(() => setS(x => (x.toast?.id === id ? { ...x, toast: null } : x)), life)
  }, [])

  // restore the session after a reload so the demo behaves like the real app
  useEffect(() => {
    const q = new URLSearchParams(location.search)
    if (q.has('v1')) setS(x => ({ ...x, v2: false })) // the redesign (v2) is the default; ?v1 opens the original replica
    if ((!q.has('v1') || q.has('seed')) && q.has('in')) E.seedDemo() // ?seed gives the old layout the same demo account, for side-by-side comparisons
    if (q.has('in')) setS(x => ({ ...x, signedIn: true }))
    if (q.get('ghost')) setS(x => ({ ...x, ghost: q.get('ghost'), watch: !q.has('v1') && !x.watch.includes(q.get('ghost') as string) ? [...x.watch, q.get('ghost') as string].slice(0, 3) : x.watch }))
    if (q.has('dialog')) setS(x => ({ ...x, dialog: q.get('dialog') as Dialog, dialogArg: q.get('arg') ?? '' }))
    if (q.get('watch')) setS(x => ({ ...x, watch: (q.get('watch') as string).split(',').filter(Boolean).slice(0, 3) })) // demo switch: ?watch=addrA,addrB,addrC
    if (q.get('tab')) setS(x => ({ ...x, bottomTab: q.get('tab') as string }))
    if (q.get('size')) setS(x => ({ ...x, form: { ...x.form, size: q.get('size') as string } }))
    if (q.get('margin') === 'isolated') setS(x => ({ ...x, form: { ...x.form, margin: 'Isolated' } })) // demo switch: liquidation then follows the leverage
    if (q.get('tpedit')) window.setTimeout(() => apiRef.current?.startTpEdit(q.get('tpedit') as string), 2600) // demo switch: open the TP/SL editor for a position
    try { const w = JSON.parse(localStorage.getItem('phx-watch') || '[]'); if (Array.isArray(w) && w.length) setS(x => ({ ...x, watch: [...new Set([...w, ...x.watch])].slice(0, 3) })) } catch { /* ignore */ }
    try { const v = JSON.parse(localStorage.getItem('phx-web') || '{}'); if (v.signedIn) setS(x => ({ ...x, signedIn: true, favs: v.favs ?? [], settings: { ...x.settings, ...(v.settings ?? {}), chartOpts: { ...CHART_OPTS, ...(v.settings?.chartOpts ?? {}) } } })); else if (v.favs) setS(x => ({ ...x, favs: v.favs })) } catch { /* ignore */ }
  }, [])
  useEffect(() => { try { localStorage.setItem('phx-watch', JSON.stringify(s.watch)) } catch { /* ignore */ } }, [s.watch])
  useEffect(() => { try { localStorage.setItem('phx-web', JSON.stringify({ signedIn: s.signedIn, favs: s.favs, settings: s.settings })) } catch { /* ignore */ } }, [s.signedIn, s.favs, s.settings])
  useEffect(() => { E.onEvent = (t, k) => say(t, k ?? 'ok'); return () => { E.onEvent = null } }, [say])
  useEffect(() => { if (new URLSearchParams(location.search).has('freeze')) { E.seedTrades(); bump(); return } /* video stage: static, deterministic */ const id = setInterval(() => { E.tick(); bump() }, 500); return () => clearInterval(id) }, [])
  // load skeletons, timed like the real page: book skeleton ~0.9s after boot, chart spinner ~2.1s; on market/timeframe change both ~0.65s
  useEffect(() => {
    const a = setTimeout(() => setS(x => ({ ...x, loading: { ...x.loading, book: false } })), 900)
    const b = setTimeout(() => setS(x => ({ ...x, loading: { ...x.loading, chart: false } })), 2100)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [])
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setS(x => ({ ...x, loading: { ...x.loading, chart: true, book: true } }))
    const t = setTimeout(() => setS(x => ({ ...x, loading: { ...x.loading, chart: false, book: false } })), 650)
    return () => clearTimeout(t)
  }, [s.sym, s.tf])
  // skeleton for account data after sign-in or entering ghost mode
  // Only a genuine sign-in (or the first Ghost entry in the classic layout) shows it, and briefly. Switching between "You" and watched traders is instant: the data is already local.
  const firstGhost = useRef(false)
  useEffect(() => {
    if (!s.signedIn) return
    setS(x => ({ ...x, loading: { ...x.loading, acct: true } })); const t = setTimeout(() => setS(x => ({ ...x, loading: { ...x.loading, acct: false } })), 450); return () => clearTimeout(t)
  }, [s.signedIn])
  useEffect(() => {
    if (!s.ghost || firstGhost.current || s.signedIn) return
    firstGhost.current = true
    setS(x => ({ ...x, loading: { ...x.loading, acct: true } })); const t = setTimeout(() => setS(x => ({ ...x, loading: { ...x.loading, acct: false } })), 450); return () => clearTimeout(t)
  }, [s.ghost, s.signedIn])

  setFormats(s.settings.numberFormat, s.settings.dateFormat) // the shared formatters (lib/data) read these during this render
  const market = bySym(s.sym)
  const mark = E.marks[s.sym] ?? market.px
  const chg = market.chg + ((mark - market.px) / market.px) * 100
  const acct = useMemo(() => (s.ghost ? ghostAccount(s.ghost) : userAccount()), [s.ghost, s.ghost ? 0 : tickN, s.signedIn]) // eslint-disable-line react-hooks/exhaustive-deps

  const apiRef = useRef<Ctx | null>(null)
  const api: Ctx = {
    ...s, set, setForm, market, mark, chg, acct, tickN, unread: E.unread, say,
    openDialog: (d, arg = '') => set({ dialog: d, dialogArg: arg }), closeDialog: () => set({ dialog: null }),
    toggleFav: sym => set({ favs: ref.current.favs.includes(sym) ? ref.current.favs.filter(x => x !== sym) : [...ref.current.favs, sym] }),
    signIn: () => {
      set({ loginStep: 'connecting' })
      later(() => { if (ref.current.v2) { if (new URLSearchParams(location.search).has('fresh')) E.fresh(5000); else E.seedDemo() } else E.reset(); set({ signedIn: true, dialog: null, loginStep: 'choose' }); say('Signed in', 'ok', 2400) }, wait(1100, 1700))
    },
    signOut: () => { E.reset(); set({ signedIn: false, ghost: null, dialog: null }) },
    // v2: Ghost Mode is a small set of watched traders you can switch between instantly (max 3)
    enterGhost: addr => { if (ref.current.v2) api.watchAdd(addr); else set({ ghost: addr, bottomTab: 'Positions' }) },
    watchAdd: (addr, activate = true) => {
      const w = ref.current.watch
      if (!w.includes(addr) && w.length >= 3) { say('You can watch up to 3 traders at once. Remove one to add another.', 'err'); return false }
      setS(x => ({ ...x, watch: x.watch.includes(addr) ? x.watch : [...x.watch, addr], ...(activate ? { ghost: addr, bottomTab: 'Positions' } : {}) })); return true
    },
    watchRemove: addr => setS(x => ({ ...x, watch: x.watch.filter(a => a !== addr), ghost: x.ghost === addr ? null : x.ghost })),
    exitGhost: () => set({ ghost: null }),

    place: q => {
      const x = ref.current, f = x.form, sym = x.sym, side = f.side, px = E.marks[sym]
      const base = f.unit === 'usd' ? (parseFloat(f.size) || 0) / px : parseFloat(f.size) || 0
      const size = base || 0.04
      set({ dialog: null, form: { ...f, size: x.settings.resetForm ? '' : f.size, tpPx: '', tpGain: '', slPx: '', slLoss: '' } }) // Settings > Trading: turn "Reset order form" off to keep the size for the next order
      say('Placing Order...', 'loading')
      const t0 = performance.now()
      later(() => {
        if (f.kind === 'Market') {
          const res = E.market(sym, side, size, f.reduce, q?.guard, q?.mark, q?.exp)
          if (!res.ok) { say(res.err!, 'err'); return }
          const p = E.find(sym)
          if (p && f.tpsl && (parseFloat(f.tpPx) || parseFloat(f.slPx))) E.setTpsl(sym, parseFloat(f.tpPx) || undefined, parseFloat(f.slPx) || undefined)
          if (!q) say('Market Order', 'ok')
          else { // v2 guaranteed price: one line, how fast, and what was saved if the market moved your way while the order travelled
            const ms = Math.round(performance.now() - t0), fill = res.price ?? q.guard
            const ref = q.exp ?? q.guard, saved = Math.round((side === 'Long' ? ref - fill : fill - ref) * size * 100) / 100
            const qty = (+size.toFixed(size >= 100 ? 2 : 4)).toLocaleString('en-US', { maximumFractionDigits: 4 })
            say(`Filled ${qty} ${sym} in ${ms} ms` + (saved >= 0.01 ? ` · saved $${saved.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''), 'ok')
          }
        } else if (f.kind === 'Limit') { E.limit(sym, side, parseFloat(f.limit) || px, size, f.reduce); say('Limit Order Placed'); set({ bottomTab: 'Open Orders' }) }
        else if (f.kind === 'Scale') { E.scale(sym, side, parseFloat(f.lo) || px * 0.97, parseFloat(f.hi) || px * 0.99, parseInt(f.n) || 5, size, 0); say('Scale Orders Placed'); set({ bottomTab: 'Open Orders' }) }
        else { E.twap(sym, side, size, 12); say('TWAP Order Started'); set({ bottomTab: 'TWAP' }) }
        bump()
      }, q && f.kind === 'Market' ? wait(260, 640) : wait())
    },
    closePos: (sym, frac = 1) => { set({ dialog: null }); say('Closing Position...', 'loading'); later(() => { E.close(sym, frac); say(frac >= 0.999 ? 'Position Closed' : 'Position Reduced'); bump() }, wait()) },
    closeAll: () => { set({ dialog: null }); say('Closing Positions...', 'loading'); later(() => { [...E.positions].forEach(p => E.close(p.sym)); say('All Positions Closed'); bump() }, wait()) },
    cancel: id => { say('Cancelling Order...', 'loading'); later(() => { E.cancel(id); say('Order Cancelled'); bump() }, wait(500, 900)) },
    cancelAll: () => { say('Cancelling Orders...', 'loading'); later(() => { [...E.orders].forEach(o => E.cancel(o.id)); say('All Orders Cancelled'); bump() }, wait(600, 1000)) },
    startTpEdit: sym => {
      const x = ref.current, p = (x.ghost ? ghostAccount(x.ghost) : userAccount()).positions.find(q => q.sym === sym); if (!p || x.ghost) return
      const dec = bySym(sym).dec, sg = p.side === 'Long' ? 1 : -1, f = x.form, mk = E.marks[sym] ?? p.mark
      tpBak.current = { tpsl: f.tpsl, tpPx: f.tpPx, tpGain: f.tpGain, slPx: f.slPx, slLoss: f.slLoss }
      // a side that is not set yet starts at a sensible spot (TP 5% and SL 2.5% from the mark, SL kept clear of liquidation) so there is a pill on the chart to drag; remove it with the x
      const tp = p.tp ?? mk * (1 + sg * 0.05)
      let sl = p.sl ?? mk * (1 - sg * 0.025); if (!p.sl && p.liq > 0) sl = sg > 0 ? Math.max(sl, p.liq * 1.001) : Math.min(sl, p.liq * 0.999)
      setS(y => ({ ...y, tpEdit: sym, sym, form: { ...y.form, tpsl: true, tpPx: tp.toFixed(dec), tpGain: (((tp - p.entry) / p.entry) * 100 * sg).toFixed(2), slPx: sl.toFixed(dec), slLoss: (((p.entry - sl) / p.entry) * 100 * sg).toFixed(2) } }))
    },
    endTpEdit: save => {
      const x = ref.current, sym = x.tpEdit; if (!sym) return
      if (save) { const tp = parseFloat(x.form.tpPx) || undefined, sl = parseFloat(x.form.slPx) || undefined; E.setTpsl(sym, tp, sl); bump(); say(tp || sl ? 'TP/SL Updated' : 'TP/SL Removed') }
      const bak = tpBak.current ?? { tpsl: false, tpPx: '', tpGain: '', slPx: '', slLoss: '' }; tpBak.current = null
      setS(y => ({ ...y, tpEdit: null, tpFocus: false, form: { ...y.form, ...bak } }))
    },
    setTpsl: (sym, tp, sl) => { E.setTpsl(sym, tp, sl); bump(); say(tp || sl ? 'TP/SL Updated' : 'TP/SL Removed') },
    deposit: n => { set({ dialog: null }); say('Depositing...', 'loading'); later(() => { E.collateral += n; E.deposited += n; E.dw.unshift({ t: Date.now(), kind: 'Deposit', amount: n }); E.note('Deposit Confirmed', `$${n.toFixed(2)} USDC added to your account`); say('Deposit Confirmed'); bump() }, wait(1400, 2200)) },
    withdraw: n => { set({ dialog: null }); say('Withdrawing...', 'loading'); later(() => { E.collateral -= n; E.withdrawn += n; E.dw.unshift({ t: Date.now(), kind: 'Withdrawal', amount: -n }); E.note('Withdrawal Complete', `$${(n - 0.5).toFixed(2)} USDC sent to your wallet`); say('Withdrawal Complete'); bump() }, wait(1400, 2200)) },
  }
  apiRef.current = api
  void MARKETS
  // The value only changes when state, the clock tick or the account changes: parent re-renders that bring nothing new no longer re-render every consumer.
  // (api is rebuilt each render so its closures stay fresh; they only read refs, so reusing the previous object for the same inputs is safe.)
  const memo = useRef<{ k: unknown[]; v: Ctx } | null>(null)
  const k = [s, tickN, acct, E.unread]
  if (!memo.current || memo.current.k.some((x, i) => x !== k[i])) memo.current = { k, v: api }
  return <C.Provider value={memo.current.v}>{children}</C.Provider>
}

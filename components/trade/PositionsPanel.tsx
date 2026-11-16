'use client'
// Bottom tables panel shared by the Trade screen and Portfolio (Positions, Open Orders, Balances, TWAP, histories, deposits).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, ChevronsUpDown, Download, ExternalLink, Pencil, Share2 } from 'lucide-react'
import { BookLayoutIcon, PhoenixMark } from '../icons/Phx'
import { useApp } from '@/lib/store'
import { E } from '@/lib/sim'
import { bySym, fmt, fmtDate, price as px, usd } from '@/lib/data'
import { usePresence, useEscape } from '@/lib/presence'
import '../portfolio/portfolio.css'

const TABS = ['Positions', 'Open Orders', 'Balances', 'TWAP', 'Trade History', 'Order History', 'Funding History']
const dt = fmtDate // follows Settings > Date Format
// Explorer home pages (Settings > General > Blockchain Explorer). Mock fills have no on-chain signature and the codebase holds no verified
// Phoenix market address, so the link opens the explorer itself rather than a made-up transaction.
const EXPLORERS: Record<string, string> = { Solscan: 'https://solscan.io/', 'Solana Explorer': 'https://explorer.solana.com/', SolanaFM: 'https://solana.fm/', Orb: 'https://orb.helius.dev/' }
const csvCell = (v: string | number) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t }
const iso = (t: number) => new Date(t).toISOString()
const SideIcon = () => <BookLayoutIcon size={16} />
const Mark = () => <PhoenixMark size={16} />
const dec = (s: string) => bySym(s).dec
const sideCls = (k: string) => (k.includes('Long') ? 'buy' : 'sell')
const money = (n: number, signed = false, d = 2) => (signed ? (n < 0 ? '-' : '+') : n < 0 ? '-' : '') + '$' + fmt(Math.abs(n), d)

function Select({ label, value, options, onPick, icon, show, optLabel, aria }: { label?: string; value: string; options: string[]; onPick: (v: string) => void; icon?: ReactNode; show?: string; optLabel?: (o: string) => string; aria?: string }) {
  const [open, setOpen] = useState(false)
  const r = useRef<HTMLDivElement>(null), btn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null)
  const pres = usePresence(open)
  useEscape(open, () => { setOpen(false); btn.current?.focus() })
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (r.current && !r.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [open])
  // keyboard: focus the chosen option when the menu opens; arrows move, Home/End jump, Tab closes
  useEffect(() => { if (open) requestAnimationFrame(() => (menu.current?.querySelector<HTMLElement>('button.on') ?? menu.current?.querySelector<HTMLElement>('button'))?.focus()) }, [open])
  const onMenuKey = (e: React.KeyboardEvent) => {
    const bs = Array.from(menu.current?.querySelectorAll<HTMLElement>('button') ?? []), i = bs.indexOf(document.activeElement as HTMLElement)
    const go = (j: number) => { e.preventDefault(); bs[(j + bs.length) % bs.length]?.focus() }
    if (e.key === 'ArrowDown') go(i + 1); else if (e.key === 'ArrowUp') go(i - 1); else if (e.key === 'Home') go(0); else if (e.key === 'End') go(bs.length - 1)
    else if (e.key === 'Tab') setOpen(false)
  }
  const lab = optLabel ?? ((o: string) => o)
  return (
    <div className={'pp-sel' + (open ? ' open' : '')} ref={r}>
      <button ref={btn} className="pp-selbtn" aria-haspopup="listbox" aria-expanded={open} aria-label={aria} onClick={() => setOpen(o => !o)} onKeyDown={e => { if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && !open) { e.preventDefault(); setOpen(true) } }}>{icon}{show ? <span className="pp-show">{show}</span> : <>{label && <span className="muted">{label}</span>}<b>{value}</b></>}<ChevronDown size={12} className="muted pp-chev" /></button>
      {pres.mounted && <div ref={menu} className="pp-selmenu pop-in" data-state={pres.state} role="listbox" aria-label={aria} onKeyDown={onMenuKey}>{options.map(o => <button key={o} role="option" aria-selected={o === value} className={o === value ? 'on' : ''} onClick={() => { onPick(o); setOpen(false); btn.current?.focus() }}>{lab(o)}</button>)}</div>}
    </div>
  )
}

// numeric value that flashes green/red (price-increase / price-decrease, 500ms) whenever it ticks up or down
function Tick({ v, children }: { v: number; children: ReactNode }) {
  const prev = useRef(v)
  const [f, setF] = useState<{ d: 'up' | 'down'; n: number } | null>(null)
  useEffect(() => {
    if (v === prev.current) return
    const d = v > prev.current ? 'up' : 'down'; prev.current = v
    setF(o => ({ d, n: (o?.n ?? 0) + 1 }))
  }, [v])
  return <span key={f?.n ?? 0} className={f ? (f.d === 'up' ? 'animate-price-up' : 'animate-price-down') : undefined}>{children}</span>
}

// table row: flashes (table-flash 500ms) when newly inserted into an already-rendered table, or when its data signature changes
function FRow({ sig, fresh, children }: { sig: string; fresh?: boolean; children: ReactNode }) {
  const prev = useRef(sig)
  const [on, setOn] = useState(!!fresh)
  useEffect(() => { if (!on) return; const t = setTimeout(() => setOn(false), 520); return () => clearTimeout(t) }, [on])
  useEffect(() => {
    if (prev.current === sig) return
    prev.current = sig; setOn(false); const id = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(id)
  }, [sig])
  return <tr className={'hov' + (on ? ' animate-table-flash' : '')}>{children}</tr>
}
function useFresh(key: string, ids: (string | number)[], ready: boolean) {
  const prev = useRef<{ key: string; ids: Set<string | number> } | null>(null)
  const fresh = new Set<string | number>()
  if (ready && prev.current && prev.current.key === key) ids.forEach(i => { if (!prev.current!.ids.has(i)) fresh.add(i) })
  useEffect(() => { prev.current = ready ? { key, ids: new Set(ids) } : null })
  return fresh
}

const Th = ({ children, sort, cls, after, onSort }: { children?: ReactNode; sort?: 'none' | 'down' | 'up'; cls?: string; after?: boolean; onSort?: () => void }) => {
  const ic = sort === 'none' ? <ChevronsUpDown size={12} /> : sort === 'down' ? <ChevronDown size={12} className="pp-sorted" /> : sort === 'up' ? <ChevronUp size={12} className="pp-sorted" /> : null
  return <th className={cls} onClick={onSort} aria-sort={sort === 'down' ? 'descending' : sort === 'up' ? 'ascending' : undefined} style={onSort ? { cursor: 'pointer', userSelect: 'none' } : undefined}><span className="pp-th">{!after && ic}{children}{after && ic}</span></th>
}

export default function PositionsPanel({ extraTabs = [] as string[] }: { extraTabs?: string[] }) {
  const { acct, signedIn, ghost, loading, bottomTab, filterMarket, filterSide, set, openDialog, closePos, cancel, cancelAll, say, v2, mark: liveMarks, startTpEdit, tpEdit, tpFocus, sym: curSym, settings } = useApp()
  const explorer = EXPLORERS[settings.explorer] ? settings.explorer : 'Solscan'
  void liveMarks
  const router = useRouter()
  // v2: editing a position's TP/SL happens in the order panel's sheet, with the rest of the screen dimmed
  const startTp = (s: string) => { if (ghost) { say('Ghost mode is read-only', 'err'); return } startTpEdit(s); if (s !== curSym) router.push('/' + s) }
  const active = signedIn || !!ghost
  const tabs = [...TABS, ...extraTabs]
  const tab = active && tabs.includes(bottomTab) ? bottomTab : 'Positions' // signed-out, the real app keeps Positions selected
  const [assetF, setAssetF] = useState('All')
  const [sel, setSel] = useState<number[]>([])
  // sortable column headers (classic tables): click to sort, click again to reverse
  const [srt, setSrt] = useState<Record<string, { k: string; d: 1 | -1 }>>({ Positions: { k: 'value', d: -1 } })
  const sh = (tabName: string, k: string) => { const c = srt[tabName]; return { sort: (c?.k === k ? (c.d === -1 ? 'down' : 'up') : 'none') as 'none' | 'down' | 'up', onSort: () => setSrt(o => ({ ...o, [tabName]: o[tabName]?.k === k ? { k, d: (-o[tabName].d) as 1 | -1 } : { k, d: k === 'sym' ? 1 : -1 } })) } }
  const sorted = <T,>(tabName: string, rows: T[], val: Record<string, (r: T) => number | string>) => { const c = srt[tabName]; if (!c || !val[c.k]) return rows; const f = val[c.k]; return [...rows].sort((a, b) => { const x = f(a), y = f(b); return (typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number)) * c.d }) }
  const ro = (f: () => void) => () => { if (ghost) say('Ghost mode is read-only', 'err'); else f() }

  const posn = acct.positions, ords = acct.orders
  const label = (t: string) => (t === 'Positions' ? `Positions (${active ? posn.length : 0})` : t === 'Open Orders' ? `Open Orders (${active ? ords.length : 0})` : t === 'TWAP' ? `TWAP (${active ? acct.twaps.length : 0})` : t)
  const mOk = (s: string) => filterMarket === 'All' || s === filterMarket
  const sOk = (side: string) => filterSide === 'Both' || side === filterSide
  const markets = ['All', ...Array.from(new Set([...posn.map(p => p.sym), ...ords.map(o => o.sym), ...acct.fills.map(f => f.sym), ...acct.hist.map(h => h.sym)]))]
  // v2: the market filter always offers the market on screen first, then every market the account has touched
  const marketsV2 = ['All', ...Array.from(new Set([curSym, ...markets.slice(1), ...acct.fund.map(f => f.sym), filterMarket].filter(m => m && m !== 'All')))]
  const filtered = filterMarket !== 'All' || filterSide !== 'Both'
  // v2 empty state names the filters that hid everything, e.g. "No short positions in SOL"
  const noneMsg = (fallback: string) => {
    if (!v2 || !filtered) return fallback
    const ord = tab === 'Open Orders' || tab === 'Order History'
    const sideW = filterSide === 'Both' ? '' : (ord ? (filterSide === 'Long' ? 'buy ' : 'sell ') : filterSide.toLowerCase() + ' ')
    const noun = ({ Positions: 'positions', 'Open Orders': 'open orders', 'Trade History': 'trades', 'Order History': 'orders', 'Funding History': 'funding payments' } as Record<string, string>)[tab] ?? 'rows'
    return `No ${sideW}${noun}${filterMarket !== 'All' ? ' in ' + filterMarket : ''}`
  }
  const showFilters = ['Positions', 'Open Orders', 'Trade History', 'Order History', 'Funding History'].includes(tab)
  const download = ['Trade History', 'Order History', 'Funding History', 'Deposits & Withdrawals'].includes(tab)

  // Export CSV: the rows the table shows right now (same filters), raw numbers, ISO times
  const exportCsv = () => {
    let head: string[] = [], rows: (string | number)[][] = []
    if (tab === 'Trade History') { head = ['Time', 'Market', 'Action', 'Size', 'Price', 'Trade Value', 'Closed PnL', 'Fee']; rows = acct.fills.filter(f => mOk(f.sym) && sOk(f.kind.includes('Long') ? 'Long' : 'Short')).map(f => [iso(f.t), f.sym, f.kind, f.size, f.price, +(f.size * f.price).toFixed(2), f.pnl == null ? '' : +f.pnl.toFixed(2), +f.fee.toFixed(4)]) }
    else if (tab === 'Order History') { head = ['Time', 'Market', 'Side', 'Type', 'Status', 'Size', 'Price']; rows = acct.hist.filter(h => mOk(h.sym) && sOk(h.side)).map(h => [iso(h.t), h.sym, h.side, h.kind, h.status, h.size, h.price]) }
    else if (tab === 'Funding History') { head = ['Time', 'Market', 'Side', 'Position', 'Funding Rate %', 'Payment']; rows = acct.fund.filter(f => mOk(f.sym) && sOk(f.side)).map(f => [iso(f.t), f.sym, f.side, f.pos ?? '', f.rate, f.amount]) }
    else if (tab === 'Deposits & Withdrawals') { head = ['Time', 'Asset', 'Type', 'Amount']; rows = acct.dw.filter(() => assetF === 'All' || assetF === 'USDC').sort((a, b) => b.t - a.t).map(d => [iso(d.t), 'USDC', d.kind, d.amount]) }
    if (!rows.length) { say('Nothing to export', 'info', 2400); return }
    const text = [head, ...rows].map(r => r.map(csvCell).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })), a = document.createElement('a')
    a.href = url; a.download = `phoenix-${tab.toLowerCase().replace(/[^a-z]+/g, '-')}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000)
    say(`Exported ${rows.length} row${rows.length === 1 ? '' : 's'}`, 'ok', 2400)
  }
  const curIds = tab === 'Positions' ? posn.map(p => p.sym) : tab === 'Open Orders' ? ords.map(o => o.id) : tab === 'Trade History' ? acct.fills.map(f => f.id) : tab === 'Order History' ? acct.hist.map(h => h.id) : []
  const fresh = useFresh(tab + acct.addr, curIds, active && !loading.acct)

  const body = () => {
    if (!active) return <div className="empty pp-empty"><Mark /><button className="lnk" onClick={() => openDialog('login')}>Connect a wallet to view open positions</button></div>
    if (loading.acct) return <div className="t-pskel" role="status" aria-busy="true" aria-label="Loading positions">{[0, 1, 2].map(i => <div key={i} className="r" style={{ opacity: 1 - i * 0.22 }}><i className="skel" style={{ width: 96 }} /><i className="skel" style={{ width: 70 }} /><i className="skel" style={{ width: 64 }} /><i className="skel" style={{ width: 84 }} /><i className="skel c" style={{ width: 60 }} /><i className="skel c" style={{ width: 56 }} /></div>)}</div>
    const none = (text: string) => <div className="empty"><Mark /><span>{noneMsg(text)}</span>{v2 && filtered && showFilters && <button className="pv-link pp-clearf" onClick={() => set({ filterMarket: 'All', filterSide: 'Both' })}>Clear filters</button>}</div>

    // ---------- v2: Positions, Open Orders, Balances redesigned for reading at a glance ----------
    if (v2 && tab === 'Positions') {
      const rows = posn.filter(p => mOk(p.sym) && sOk(p.side))
      if (!rows.length) return none('No positions')
      return (
        <div className="pv" role="table">
          <div className="pv-h pv-pos" role="row"><span>Position</span><span>Entry · Mark</span><span>PnL</span><span>Liquidation</span><span>Margin</span><span>TP / SL</span><span className="r"><button className="pv-link" onClick={ro(() => openDialog('closeall'))}>Close all</button></span></div>
          {rows.map(p => {
            const d = dec(p.sym), c = p.side === 'Long' ? 'buy' : 'sell'
            const dist = p.liq > 0 && p.mark > 0 ? (Math.abs(p.mark - p.liq) / p.mark) * 100 : null
            const tier = dist == null ? 'ok' : dist >= 20 ? 'ok' : dist >= 10 ? 'mid' : 'bad'
            return (
              <div key={p.sym} className={'pv-r pv-pos' + (fresh.has(p.sym) ? ' animate-table-flash' : '') + (tpEdit === p.sym ? ' pv-edit' : '')} role="row">
                <div className="pv-c"><span className="pv-top"><a className="pv-sym" onClick={ro(() => openDialog('close', p.sym))}>{p.sym}</a><span className={'pv-pill ' + c}>{p.side}</span><span className="pv-lev">{p.lev.toFixed(1)}x</span></span><span className="pv-sub num">{fmt(p.size, 2)} {p.sym} · {usd(p.value)}</span></div>
                <div className="pv-c num"><span className="pv-top"><i>Entry</i>{usd(p.entry, d)}</span><span className="pv-top"><i>Mark</i>{usd(p.mark, d)}</span></div>
                <div className={'pv-c num ' + (p.upnl < 0 ? 'sell' : 'buy')} title={`Funding ${money(p.funding, true)}`}><span className="pv-big">{money(p.upnl, true)}</span><span className="pv-sub">{p.roi >= 0 ? '+' : ''}{p.roi.toFixed(2)}%</span></div>
                <div className="pv-c num"><span className="pv-top">{p.liq > 0 ? usd(p.liq, d) : '—'}</span>{dist == null ? <span className="pv-sub">No liquidation risk</span> : <span className={'pv-risk ' + tier}><b><i style={{ width: Math.min(100, dist * 2) + '%' }} /></b>{dist.toFixed(0)}% away</span>}</div>
                <div className="pv-c num"><span className="pv-top">{usd(p.margin)}</span><span className="pv-sub">Cross</span></div>
                <div className="pv-c num">{p.tp || p.sl ? <><span className="pv-top buy"><i>TP</i>{p.tp ? px(p.tp, d) : '—'}</span><span className="pv-top sell"><i>SL</i>{p.sl ? px(p.sl, d) : '—'}</span></> : <button className="pv-add" onClick={() => startTp(p.sym)}>+ Add</button>}</div>
                <div className="pv-c pv-end">{(p.tp || p.sl) && <button className="pv-ib" aria-label="Edit TP/SL" onClick={() => startTp(p.sym)}><Pencil size={12} /></button>}<button className="pv-ib" aria-label="Share" onClick={() => openDialog('share', p.sym)}><Share2 size={12} /></button><button className="pv-close" onClick={ro(() => openDialog('close', p.sym))}>Close</button></div>
              </div>
            )
          })}
        </div>
      )
    }
    if (v2 && tab === 'Open Orders') {
      const rows = ords.filter(o => mOk(o.sym) && sOk(o.side))
      if (!rows.length) return none('No open orders')
      return (
        <div className="pv" role="table">
          <div className="pv-h pv-ord" role="row"><span><input type="checkbox" className="pp-cb" aria-label="Select all" checked={sel.length === rows.length} onChange={e => setSel(e.target.checked ? rows.map(r => r.id) : [])} /></span><span>Order</span><span>Size</span><span>Price</span><span>Filled</span><span className="r"><button className="pv-link" onClick={ro(() => (filtered ? rows.forEach(r => cancel(r.id)) : cancelAll()))}>{filtered ? 'Cancel shown' : 'Cancel all'}</button></span></div>
          {rows.map(o => {
            const c = o.side === 'Long' ? 'buy' : 'sell', mk = E.marks[o.sym], away = mk ? ((o.price - mk) / mk) * 100 : null
            return (
              <div key={o.id} className={'pv-r pv-ord' + (fresh.has(o.id) ? ' animate-table-flash' : '')} role="row">
                <div className="pv-c"><input type="checkbox" className="pp-cb" checked={sel.includes(o.id)} onChange={e => setSel(x => (e.target.checked ? [...x, o.id] : x.filter(y => y !== o.id)))} /></div>
                <div className="pv-c"><span className="pv-top"><span className="pv-sym">{o.sym}</span><span className={'pv-pill ' + c}>{o.side === 'Long' ? 'Buy' : 'Sell'}</span></span><span className="pv-sub">{o.kind}{o.reduce ? ' · Reduce only' : ''}</span></div>
                <div className="pv-c num"><span className={'pv-top ' + c}>{fmt(o.size, 3)} {o.sym}</span><span className="pv-sub">{usd(o.size * o.price)}</span></div>
                <div className="pv-c num"><span className="pv-top">{usd(o.price, dec(o.sym))}</span><span className="pv-sub">{away == null ? '' : `${away >= 0 ? '+' : ''}${away.toFixed(2)}% vs mark`}</span></div>
                <div className="pv-c num"><span className="pv-prog"><i style={{ width: '0%' }} /></span><span className="pv-sub">0% filled</span></div>
                <div className="pv-c pv-end"><button className="pv-close" onClick={ro(() => cancel(o.id))}>Cancel</button></div>
              </div>
            )
          })}
        </div>
      )
    }
    if (v2 && tab === 'Balances') {
      const tiles: [string, string, string?][] = [['Account value', usd(acct.equity)], ['Available to trade', usd(acct.available)], ['Margin in use', usd(acct.initMargin)], ['Unrealised PnL', money(acct.upnl, true), acct.upnl < 0 ? 'sell' : acct.upnl > 0 ? 'buy' : '']]
      return (
        <div className="pv pv-bal">
          <div className="pv-tiles">{tiles.map(([k, v, cl]) => <div key={k} className="pv-tile"><span className="pv-sub">{k}</span><b className={'num ' + (cl ?? '')}>{v}</b></div>)}</div>
          <div className="pv-r pv-asset" role="row">
            <div className="pv-c"><span className="pv-top"><span className="pp-usdc">$</span><span className="pv-sym">USDC</span></span><span className="pv-sub">Cross account</span></div>
            <div className="pv-c num"><span className="pv-top">{fmt(acct.collateral)}</span><span className="pv-sub">{usd(acct.collateral)}</span></div>
            <div className="pv-c pv-end"><button className="pv-close" disabled={!!ghost} onClick={() => openDialog('deposit')}>Deposit</button><button className="pv-close" disabled={!!ghost} onClick={() => openDialog('withdraw')}>Withdraw</button></div>
          </div>
        </div>
      )
    }

    if (tab === 'Positions') {
      const rows = sorted('Positions', posn.filter(p => mOk(p.sym) && sOk(p.side)), { sym: p => p.sym, size: p => p.size, value: p => p.value, upnl: p => p.upnl, margin: p => p.margin, funding: p => p.funding })
      if (!rows.length) return none('No positions')
      return (
        <table className="tbl pp-tbl"><thead><tr>
          <Th {...sh('Positions', 'sym')} after>Market</Th><Th {...sh('Positions', 'size')}>Size</Th><Th {...sh('Positions', 'value')}>Position Value</Th><Th>Entry Price</Th><Th>Mark Price</Th><Th>Liq Price</Th><Th {...sh('Positions', 'upnl')}>uPnL</Th><Th {...sh('Positions', 'margin')}>Margin</Th><Th {...sh('Positions', 'funding')}>Funding</Th>
          <Th cls="c"><span className="tip">TP/SL</span></Th>
          <th><button className="pp-closeall" onClick={ro(() => openDialog('closeall'))}>Close All</button></th>
        </tr></thead><tbody>
          {rows.map(p => {
            const d = dec(p.sym), c = p.side === 'Long' ? 'buy' : 'sell'
            return (
              <FRow key={p.sym} fresh={fresh.has(p.sym)} sig={[p.size, p.entry, p.margin, p.tp, p.sl].join('|')}>
                <td><span className="pp-mk"><a className={'pp-sym ' + c} onClick={ro(() => openDialog('close', p.sym))}>{p.sym}</a><span className={'chip ' + c}>{p.side}</span><span className="chip pp-lev">{p.lev.toFixed(1)}x</span></span></td>
                <td className={c}>{fmt(p.size, 2)} {p.sym}</td>
                <td>{usd(p.value)}</td><td>{usd(p.entry, d)}</td><td><Tick v={p.mark}>{usd(p.mark, d)}</Tick></td><td>{p.liq > 0 ? usd(p.liq, d) : '—'}</td>
                <td className={p.upnl < 0 ? 'sell' : 'buy'}><div className="pp-two"><Tick v={p.upnl}>{money(p.upnl)}</Tick><span>({p.roi.toFixed(2)}%)</span></div></td>
                <td><div className="pp-two">{usd(p.margin)}<span className="muted">Cross</span></div></td>
                <td className={p.funding < 0 ? 'sell' : 'buy'}>{money(p.funding, true)}</td>
                <td className="c"><span className="pp-tpsl"><span className="pp-tp"><span>- TP</span><span>- SL</span></span>
                  <button className="pp-ib" aria-label="Edit TP/SL" onClick={ro(() => openDialog('tpsl', p.sym))}><Pencil size={12} /></button></span>
                  {(p.tp || p.sl) && <span className="pp-tpv">{p.tp ? 'TP ' + px(p.tp, d) : ''}{p.tp && p.sl ? ' / ' : ''}{p.sl ? 'SL ' + px(p.sl, d) : ''}</span>}</td>
                <td className="pp-act"><button className="pp-ib" aria-label="Share" onClick={() => openDialog('share', p.sym)}><Share2 size={12} /></button><button className="pp-x" onClick={ro(() => openDialog('close', p.sym))}>Close</button></td>
              </FRow>
            )
          })}
        </tbody></table>
      )
    }
    if (tab === 'Open Orders') {
      const rows = sorted('Open Orders', ords.filter(o => mOk(o.sym) && sOk(o.side)), { sym: o => o.sym, size: o => o.size, price: o => o.price })
      if (!rows.length) return (
        <table className="tbl pp-tbl"><thead><tr><th style={{ width: 28 }}><input type="checkbox" className="pp-cb" disabled /></th><Th sort="none" after>Market</Th><Th>Type</Th><Th sort="none">Size</Th><Th sort="none">Price</Th><Th>Order Value</Th><Th>Filled %</Th><Th>Reduce Only</Th><Th cls="c"><span className="tip">TP/SL</span></Th><th><span className="pp-cancel off">Cancel All</span></th></tr></thead>
          <tbody><tr><td colSpan={10} style={{ padding: 0, height: 0 }} /></tr></tbody></table>
      )
      return (
        <table className="tbl pp-tbl"><thead><tr>
          <th style={{ width: 28 }}><input type="checkbox" className="pp-cb" checked={sel.length === rows.length} onChange={e => setSel(e.target.checked ? rows.map(r => r.id) : [])} /></th>
          <Th {...sh('Open Orders', 'sym')} after>Market</Th><Th>Type</Th><Th {...sh('Open Orders', 'size')}>Size</Th><Th {...sh('Open Orders', 'price')}>Price</Th><Th>Order Value</Th><Th>Filled %</Th><Th>Reduce Only</Th><Th cls="c"><span className="tip">TP/SL</span></Th>
          <th><button className="pp-cancel" onClick={ro(cancelAll)}>Cancel All</button></th>
        </tr></thead><tbody>
          {rows.map(o => (
            <FRow key={o.id} fresh={fresh.has(o.id)} sig={o.price + '|' + o.size}>
              <td style={{ width: 28 }}><input type="checkbox" className="pp-cb" checked={sel.includes(o.id)} onChange={e => setSel(s => (e.target.checked ? [...s, o.id] : s.filter(x => x !== o.id)))} /></td>
              <td><span className="pp-mk"><span className={'pp-sym ' + (o.side === 'Long' ? 'buy' : 'sell')}>{o.sym}</span><span className={'chip ' + (o.side === 'Long' ? 'buy' : 'sell')}>{o.side === 'Long' ? 'Buy' : 'Sell'}</span></span></td>
              <td>{o.kind}</td><td className={o.side === 'Long' ? 'buy' : 'sell'}>{fmt(o.size, 3)} {o.sym}</td><td>{usd(o.price, dec(o.sym))}</td><td>{usd(o.size * o.price)}</td><td>0%</td><td>{o.reduce ? 'Yes' : 'No'}</td><td className="c">- / -</td>
              <td><button className="pp-cancel" onClick={ro(() => cancel(o.id))}>Cancel</button></td>
            </FRow>
          ))}
        </tbody></table>
      )
    }
    if (tab === 'Balances') return (
      <table className="tbl pp-tbl"><thead><tr><Th sort="none">Asset</Th><Th>Amount</Th><Th>Price</Th><Th sort="none">Notional Value</Th><Th sort="none"><span className="tip">Collateral Weight</span></Th><Th sort="none"><span className="tip">Collateral Value</span></Th><Th>Action</Th></tr></thead><tbody>
        <tr className="pp-grp"><td colSpan={7}><span className="pp-mk"><ChevronDown size={12} className="muted" /><b>Cross Account</b></span></td></tr>
        <tr className="hov pp-sub"><td><span className="pp-mk"><span className="pp-tree" /><span className="pp-usdc">$</span>USDC</span></td>
          <td><Tick v={acct.collateral}>{fmt(acct.collateral)}</Tick></td><td>$1.00</td><td>{usd(acct.collateral)}</td><td>100%</td><td>{usd(acct.collateral)}</td>
          <td><span className="pp-btns"><button disabled={!!ghost} onClick={() => openDialog('deposit')}>Deposit</button><button disabled={!!ghost} onClick={() => openDialog('withdraw')}>Withdraw</button><button disabled={!!ghost} onClick={() => say('Swap is not available on devnet', 'err')}>Swap</button></span></td></tr>
      </tbody></table>
    )
    if (tab === 'TWAP') {
      if (!acct.twaps.length) return none('No active TWAP orders')
      return (
        <table className="tbl pp-tbl"><thead><tr><Th>Market</Th><Th>Side</Th><Th>Size</Th><Th>Progress</Th><Th>Executed</Th><Th>Next Slice</Th></tr></thead><tbody>
          {acct.twaps.map(t => {
            const pr = (t.done / t.n) * 100, c = t.side === 'Long' ? 'buy' : 'sell'
            return <tr key={t.id} className="hov"><td><span className="pp-mk"><span className={'pp-sym ' + c}>{t.sym}</span></span></td><td><span className={'chip ' + c}>{t.side === 'Long' ? 'Buy' : 'Sell'}</span></td><td>{fmt(t.total, 3)} {t.sym}</td>
              <td><span className="pp-prog"><i style={{ width: pr + '%' }} /></span></td><td>{t.done}/{t.n} ({pr.toFixed(0)}%)</td><td>{Math.max(0, Math.ceil((t.next - Date.now()) / 1000))}s</td></tr>
          })}
        </tbody></table>
      )
    }
    if (tab === 'Trade History') {
      const rows = acct.fills.filter(f => mOk(f.sym) && sOk(f.kind.includes('Long') ? 'Long' : 'Short'))
      if (!rows.length) return none('No trade history')
      return (
        <table className="tbl pp-tbl"><thead><tr><Th sort="none" after>Time</Th><Th>Market</Th><Th>Action</Th><Th>Type</Th><Th>Size</Th><Th>Price</Th><Th>Trade Value</Th><Th>Closed PnL</Th><Th>Fee</Th></tr></thead><tbody>
          {rows.map(f => (
            <FRow key={f.id} fresh={fresh.has(f.id)} sig=""><td><span className="pp-mk">{dt(f.t)}<a className="pp-ext" href={EXPLORERS[explorer]} target="_blank" rel="noreferrer" title={`Mock fill (no on-chain transaction): opens ${explorer}`} aria-label={`Open ${explorer}`}><ExternalLink size={12} /></a></span></td><td>{f.sym}</td>
              <td className={sideCls(f.kind)}>{f.kind}</td><td><span className="pp-mk">Market<span className="pp-t">T</span></span></td><td>{fmt(f.size, 2)} {f.sym}</td><td>{usd(f.price, dec(f.sym))}</td><td>{usd(f.size * f.price)}</td>
              <td className={f.pnl == null ? '' : f.pnl < 0 ? 'sell' : 'buy'}>{f.pnl == null ? '-' : <span className="pp-mk" style={{ justifyContent: 'flex-end' }}>{money(f.pnl)} ({(f.roi ?? 0).toFixed(2)}%)<span className="pp-share" onClick={() => openDialog('share', f.sym)}><Share2 size={12} /></span></span>}</td>
              <td>{usd(f.fee)}</td></FRow>
          ))}
        </tbody></table>
      )
    }
    if (tab === 'Order History') {
      const rows = acct.hist.filter(h => mOk(h.sym) && sOk(h.side))
      if (!rows.length) return none('No order history')
      return (
        <table className="tbl pp-tbl"><thead><tr><Th sort="none" after>Time</Th><Th>Market</Th><Th>Action</Th><Th>Type</Th><Th>Status</Th><Th>Size</Th><Th>Price</Th><Th>Filled</Th></tr></thead><tbody>
          {rows.map(h => (
            <FRow key={h.id} fresh={fresh.has(h.id)} sig={h.status}><td>{dt(h.t)}</td><td>{h.sym}</td><td className={h.side === 'Long' ? 'buy' : 'sell'}>Open {h.side}</td><td>{h.kind}</td>
              <td className={h.status === 'Filled' ? '' : h.status === 'Liquidated' ? 'sell' : 'muted'}>{h.status}</td><td>{fmt(h.size, 2)} {h.sym}</td><td>{usd(h.price, dec(h.sym))}</td><td>{h.status === 'Filled' ? `${fmt(h.size, 2)} ${h.sym}` : '-'}</td></FRow>
          ))}
        </tbody></table>
      )
    }
    if (tab === 'Funding History') {
      const rows = acct.fund.filter(f => mOk(f.sym) && sOk(f.side))
      if (!rows.length) return none('No funding history')
      return (
        <table className="tbl pp-tbl"><thead><tr><Th sort="none" after>Time</Th><Th>Market</Th><Th>Position</Th><Th>Funding Rate</Th><Th>Payment</Th></tr></thead><tbody>
          {rows.map((f, i) => (
            <tr key={i} className="hov"><td>{dt(f.t)}</td><td><span className="pp-mk">{f.sym}<span className={'chip ' + (f.side === 'Long' ? 'buy' : 'sell')}>{f.side}</span></span></td>
              <td>{f.pos != null ? fmt(f.pos, 2) + ' ' + f.sym : '-'}</td><td>{f.rate.toFixed(4)}%</td><td className={f.amount < 0 ? 'sell' : 'buy'}>{(f.amount < 0 ? '-$' : '$') + Math.abs(f.amount).toFixed(6)}</td></tr>
          ))}
        </tbody></table>
      )
    }
    if (tab === 'Deposits & Withdrawals') {
      const rows = acct.dw.filter(d => assetF === 'All' || assetF === 'USDC')
      if (!rows.length) return none('No deposits or withdrawals')
      return (
        <table className="tbl pp-tbl"><thead><tr><Th sort="none" after>Time</Th><Th cls="l">Asset</Th><Th cls="l">Type</Th><Th>Amount</Th></tr></thead><tbody>
          {[...rows].sort((a, b) => b.t - a.t).map((d, i) => (
            <tr key={i} className="hov"><td>{dt(d.t)}</td><td className="l"><span className="pp-mk"><span className="pp-usdc">$</span>USDC</span></td>
              <td className={'l ' + (d.kind === 'Deposit' ? 'buy' : 'sell')}><span className="pp-mk">{d.kind === 'Deposit' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}{d.kind}</span></td>
              <td className={d.amount < 0 ? 'sell' : 'buy'}>{money(d.amount, true)}</td></tr>
          ))}
        </tbody></table>
      )
    }
    return null
  }
  void E

  return (
    <div className={'panel pp' + (v2 ? ' pv-on' : '') + (v2 && tpFocus ? ' pv-focus' : '')}>
      <div className="pp-hd">
        <div className="utabs pp-tabs">{tabs.map(t => {
          const n = !v2 || !active ? 0 : t === 'Positions' ? posn.length : t === 'Open Orders' ? ords.length : t === 'TWAP' ? acct.twaps.length : 0
          return <button key={t} className={t === tab ? 'on' : ''} onClick={() => set({ bottomTab: t })}>{v2 ? <>{t}{n > 0 && <span className="pv-n">{n}</span>}</> : label(t)}</button>
        })}</div>
        <div className="pp-filters">
          {download && <button className="pp-dl" aria-label="Export CSV" title="Export the rows shown as CSV" onClick={exportCsv}><Download size={14} /></button>}
          {tab === 'Deposits & Withdrawals' && <Select label="Asset" value={assetF} options={['All', 'USDC']} onPick={setAssetF} />}
          {showFilters && <>
            {v2 ? <>
              <Select aria="Filter by market" value={filterMarket} show={`Market: ${filterMarket}`} options={marketsV2} optLabel={o => (o === 'All' ? 'All markets' : o === curSym ? `${o} (this chart)` : o)} onPick={v => set({ filterMarket: v })} />
              <Select aria="Filter by side" value={filterSide} show={filterSide === 'Both' ? 'Side: All' : filterSide} options={['Both', 'Long', 'Short']} optLabel={o => (o === 'Both' ? 'All sides' : o)} onPick={v => set({ filterSide: v as 'Both' })} />
            </> : <>
              <Select label="Market" value={filterMarket} options={markets} onPick={v => set({ filterMarket: v })} />
              <Select value={filterSide} options={['Both', 'Long', 'Short']} onPick={v => set({ filterSide: v as 'Both' })} icon={<SideIcon />} />
            </>}
          </>}
        </div>
      </div>
      <div className="pp-body">{body()}</div>
    </div>
  )
}

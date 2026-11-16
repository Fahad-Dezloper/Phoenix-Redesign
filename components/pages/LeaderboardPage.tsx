'use client'
import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Copy, Eye, Ghost, Info, Search, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Logo } from '../trade/MarketStats'
import { useApp } from '@/lib/store'
import { ALL, usd, fmt, type Trader } from '@/lib/data'
import './pages.css'

const RANGES = [['1 Day', '1D', 1], ['1 Week', '1W', 3.1], ['1 Month', '1M', 8.4], ['All Time', 'All', 21]] as const
type Key = 'rank' | 'pnl' | 'roi' | 'vol' | 'value'
const TOTAL = 17876
const scale = (t: Trader, mul: number): Trader => mul === 1 ? t : ({ ...t, pnl: Math.round(t.pnl * mul * (0.92 + ((t.rank * 13) % 10) / 60)), roi: +(t.roi * (mul > 1 ? mul * 0.55 : 1)).toFixed(2), vol: Math.round(t.vol * mul * (t.vol ? 4.2 : 0)) + (mul > 1 && t.rank % 3 ? Math.round(t.value * mul * 0.8) : 0), value: Math.round(t.value * (1 + (mul - 1) * 0.01)) })
const Badge = ({ n }: { n: number }) => <span className={'lb-rank' + (n <= 3 ? ' r' + n : '')}>{n}</span>

// ---- data: the 100 captured/extended traders, then deterministic filler down to TOTAL so every page of the pager has rows ----
const CH = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const addrFor = (i: number) => { let s = i * 7919 + 13; const g = (n: number) => { let o = ''; for (let k = 0; k < n; k++) { s = (s * 1103515245 + 12345) % 2147483648; o += CH[s % CH.length] } return o }; return g(4) + '…' + g(4) }
let BASE: Trader[] | null = null
const base = (): Trader[] => {
  if (BASE) return BASE
  const out = ALL.slice()
  for (let r = ALL.length + 1; r <= TOTAL; r++) out.push({ rank: r, addr: addrFor(r + 5000), pnl: Math.max(1, Math.round(((TOTAL - r) / TOTAL) * 36 + 4)), roi: +(1 + ((r * 37) % 90) / 10).toFixed(2), vol: (r * 977) % 5 === 0 ? 0 : (r * 4231) % 90000, value: 9000 + ((r * 7717) % 60000) })
  return (BASE = out)
}
const RANKED = new Map<number, Trader[]>() // per period, ranked by PnL
const rankedFor = (mul: number): Trader[] => {
  let r = RANKED.get(mul)
  if (!r) { r = base().map(t => scale(t, mul)).sort((a, b) => b.pnl - a.pnl).map((t, i) => ({ ...t, rank: i + 1 })); RANKED.set(mul, r) }
  return r
}
// how many traders have more PnL than this (ranked is sorted high to low)
const above = (ranked: Trader[], pnl: number) => { let lo = 0, hi = ranked.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ranked[m].pnl > pnl) lo = m + 1; else hi = m } return lo }
const money = (n: number, sign = false) => (n < 0 ? '-' : sign ? '+' : '') + '$' + fmt(Math.abs(n), 0)
const copyText = (t: string) => { try { void navigator.clipboard?.writeText(t) } catch { /* clipboard may be blocked: the toast still confirms the action */ } }

const Acts = memo(function Acts({ a, w, onCopy, onView }: { a: string; w?: boolean; onCopy: (a: string) => void; onView: (a: string) => void }) {
  return <span className="lb2-ac"><button aria-label="Copy address" title="Copy address" onClick={() => onCopy(a)}><Copy size={13} /></button>{w
    ? <button className="v w" aria-label="Watching: this trader is in your Ghost dock" title="Watching · in your Ghost dock" onClick={() => onView(a)}><Eye size={13} /><span className="vt">Watching</span></button>
    : <button className="v" aria-label="View this trader's account, read-only" title="View this trader's account (read-only)" onClick={() => onView(a)}><Eye size={13} /><span className="vt">View</span></button>}</span>
})
// marks a trader that is already in the Ghost dock
const GhostMark = () => <span className="lb2-gh" role="img" aria-label="In your Ghost dock" title="In your Ghost dock"><Ghost size={14} strokeWidth={2} aria-hidden /></span>
const MEDAL = ['gold', 'silver', 'bronze']
const Podium = memo(function Podium({ podium, short, watchKey, onCopy, onView }: { podium: Trader[]; short: string; watchKey: string; onCopy: (a: string) => void; onView: (a: string) => void }) {
  const ws = watchKey ? watchKey.split('|') : []
  return (
    <div className="lb2-pod">
      {podium.map((t, i) => { const w = ws.includes(t.addr); return (
        <div key={t.addr} className={'lb2-pc ' + MEDAL[i]}>
          <div className="h"><span className={'md ' + MEDAL[i]}>{t.rank}</span><b className={'ad' + (w ? ' w' : '')}>{t.addr}</b>{w && <GhostMark />}<Acts a={t.addr} w={w} onCopy={onCopy} onView={onView} /></div>
          <div className="pl"><span>PnL ({short})</span><b className={'num ' + (t.pnl >= 0 ? 'buy' : 'sell')}>{money(t.pnl, true)}</b></div>
          <div className="st num"><div><span>ROI</span><b className={t.roi >= 0 ? 'buy' : 'sell'}>{(t.roi >= 0 ? '+' : '') + t.roi.toFixed(2)}%</b></div><div><span>Volume</span><b>{usd(t.vol, 0)}</b></div><div><span>Account</span><b>{usd(t.value, 0)}</b></div></div>
        </div>
      ) })}
    </div>
  )
})
const PodiumSkel = () => <div className="lb2-pod" aria-hidden>{[0, 1, 2].map(i => <div key={i} className="lb2-pc" style={{ minHeight: 188 }}><div className="h"><span className="skel" style={{ width: 30, height: 30, borderRadius: 15 }} /><span className="skel" style={{ width: 96, height: 16 }} /></div><div className="pl"><span className="skel" style={{ width: 60, height: 12, marginBottom: 6 }} /><span className="skel" style={{ width: 150, height: 30 }} /></div><div className="st"><span className="skel" style={{ height: 30 }} /><span className="skel" style={{ height: 30 }} /><span className="skel" style={{ height: 30 }} /></div></div>)}</div>
const RowSkel = () => <div className="lb2-row" aria-hidden><div className="c0"><span className="skel" style={{ width: 32, height: 32, borderRadius: 16 }} /></div><div className="c1"><span className="skel" style={{ width: 28, height: 28, borderRadius: 14 }} /><span className="skel" style={{ width: 100, height: 14 }} /></div><div className="cn"><span className="skel" style={{ width: 70, height: 16, marginLeft: 'auto' }} /></div><div className="cn"><span className="skel" style={{ width: 52, height: 14, marginLeft: 'auto' }} /></div><div className="cn"><span className="skel" style={{ width: 64, height: 14, marginLeft: 'auto' }} /></div><div className="cn"><span className="skel" style={{ width: 70, height: 14, marginLeft: 'auto' }} /></div></div>
const Row = memo(function Row({ t, maxP, me, w, onCopy, onView }: { t: Trader; maxP: number; me: boolean; w: boolean; onCopy: (a: string) => void; onView: (a: string) => void }) {
  return (
    <div className={'lb2-row' + (me ? ' me' : '')}>
      <div className="c0"><Badge n={t.rank} /></div>
      <div className="c1"><i className="lb2-av" aria-hidden>{t.addr[0]}</i><b className={'ad' + (w ? ' w' : '')}>{t.addr}</b>{w && <GhostMark />}<Acts a={t.addr} w={w} onCopy={onCopy} onView={onView} /></div>
      <div className="cn pn num"><b className={t.pnl >= 0 ? 'buy' : 'sell'}>{money(t.pnl, true)}</b><i style={{ width: Math.max(3, (Math.abs(t.pnl) / maxP) * 100) + '%' }} className={t.pnl >= 0 ? 'buy' : 'sell'} /></div>
      <div className={'cn num ' + (t.roi >= 0 ? 'buy' : 'sell')}>{(t.roi >= 0 ? '+' : '') + t.roi.toFixed(2)}%</div>
      <div className="cn num mu">{usd(t.vol, 0)}</div>
      <div className="cn num mu">{usd(t.value, 0)}</div>
    </div>
  )
})

// page-size menu + pager, shared by the classic and v2 layouts
function Pager({ cls, size, setSize, page, setPage, pages, from, to, total }: { cls: string; size: number; setSize: (n: number) => void; page: number; setPage: (p: number | ((p: number) => number)) => void; pages: number; from: number; to: number; total: number }) {
  const [open, setOpen] = useState(false), box = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  useEffect(() => {
    if (!open) return
    const down = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key) }
  }, [open])
  const jump = () => { const n = parseInt(draft, 10); if (!Number.isNaN(n)) setPage(Math.min(pages, Math.max(1, n))); setDraft('') }
  return (
    <div className={cls}>
      <div className="lb-sz" ref={box}><button className="chip" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(o => !o)}><span className="m">Show</span><b>{size}</b><ChevronDown size={12} /></button>
        {open && <div className="opts" role="listbox" aria-label="Rows per page">{[20, 50, 100].map(n => <button key={n} role="option" aria-selected={n === size} className={n === size ? 'on' : ''} onClick={() => { setSize(n); setOpen(false) }}>{n}</button>)}</div>}</div>
      <span className="of">{total ? `${from.toLocaleString('en-US')}–${to.toLocaleString('en-US')} of ${total.toLocaleString('en-US')}` : '0 of 0'}</span>
      <div className="pgn">
        <button aria-label="First page" title="First page" disabled={page <= 1} onClick={() => setPage(1)}><ChevronsLeft size={12} /></button>
        <button aria-label="Previous page" title="Previous page" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}><ChevronLeft size={12} /></button>
        <span className="pn">Page <input aria-label="Go to page" inputMode="numeric" value={draft} placeholder={String(page)} onChange={e => setDraft(e.target.value.replace(/\D/g, ''))} onKeyDown={e => { if (e.key === 'Enter') jump() }} onBlur={() => draft && jump()} /> of {pages.toLocaleString('en-US')}</span>
        <button aria-label="Next page" title="Next page" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}><ChevronRight size={12} /></button>
        <button aria-label="Last page" title="Last page" disabled={page >= pages} onClick={() => setPage(pages)}><ChevronsRight size={12} /></button>
      </div>
    </div>
  )
}

const stampNow = () => { const d = new Date(); const h = d.getHours(); return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${String(d.getFullYear()).slice(2)} ${String(h % 12 || 12).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}` }

export default function LeaderboardPage() {
  const { signedIn, ghost, enterGhost, exitGhost, say, v2, acct, openDialog, set, watchAdd, watch, settings } = useApp()
  const router = useRouter()
  const [pv] = useState<'live' | 'out' | 'top100' | 'top10' | 'top3'>(() => { const v = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('pv') : null; return v === 'out' || v === 'top100' || v === 'top10' || v === 'top3' ? v : 'live' }) // ?pv= URL switch only (screenshots): preview the standing card in each state; no visible tabs
  const [ri, setRi] = useState(0), [q, setQ] = useState(''), [loading, setLoading] = useState(true), [size, setSize] = useState(20), [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: 'pnl', dir: -1 })
  const dq = useDeferredValue(q)
  useEffect(() => { setPage(1) }, [ri, dq, sort, size])
  // the board reloads when the period changes (it is a different dataset), not on search, sort, paging or account ticks
  useEffect(() => { setLoading(true); const t = setTimeout(() => setLoading(false), 1200); return () => clearTimeout(t) }, [ri])
  const [label, short, mul] = RANGES[ri]
  const ranked = useMemo(() => rankedFor(mul), [mul])
  const rows = useMemo(() => {
    const f = dq.trim().toLowerCase()
    const list = f ? ranked.filter(t => t.addr.toLowerCase().includes(f)) : ranked
    if (sort.k === 'pnl' && sort.dir === -1) return list
    return [...list].sort((a, b) => (a[sort.k] - b[sort.k]) * sort.dir * (sort.k === 'rank' ? -1 : 1))
  }, [ranked, dq, sort])
  const stamp = useMemo(stampNow, []) // eslint-disable-line react-hooks/exhaustive-deps
  // the store hands out new function objects on every price tick; keep the latest in a ref so these callbacks (and the memoised rows that receive them) stay the same
  const fns = useRef({ say, watchAdd, router, set, watch }); fns.current = { say, watchAdd, router, set, watch }
  const onCopy = useCallback((a: string) => { copyText(a); fns.current.say('Address copied') }, [])
  const onView = useCallback((a: string) => {
    // View adds the trader to the Ghost dock and keeps you here to pick more; the third pick opens that trader's trade screen
    const f = fns.current, w = f.watch, short = a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a
    if (w.includes(a)) { f.say(`Already watching ${short}. Switch to them from the Ghost dock.`); return }
    if (w.length >= 2) { if (f.watchAdd(a, true)) f.router.push('/SOL'); return }
    if (f.watchAdd(a, false)) f.say(`Added ${short} to your Ghost dock · ${w.length + 1} of 3`)
  }, [])
  const ghostKey = ghost ? ghost.slice(0, 4) : ''
  const head = (k: Key, text: string, left = false) => {
    const on = sort.k === k
    const ic = on ? (sort.dir === -1 ? <ArrowDown size={12} /> : <ArrowUp size={12} />) : <ArrowUpDown size={12} />
    const nm = text.replace(/ \(.*$/, '')
    return <button aria-label={on ? `Sort by ${nm}, currently ${sort.dir === -1 ? 'descending' : 'ascending'}` : `Sort by ${nm}`} className={'lb-h ' + (left ? 'l ' : '') + (on ? 'on' : '')} onClick={() => setSort(s => ({ k, dir: s.k === k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
      {left && <span>{text}</span>}<i className="ar">{ic}</i>{!left && <span>{text}</span>}</button>
  }
  const gRow = ghost ? ranked.find(t => ghost.startsWith(t.addr.slice(0, 4))) : undefined

  // ---------------------------------------------------------------- v2
  const podium = ranked.slice(0, 3)
  const hideTop = sort.k === 'pnl' && sort.dir === -1 && !dq.trim()
  const off = hideTop ? 3 : 0, N = Math.max(0, rows.length - off)
  const pgs = Math.max(1, Math.ceil(N / size)), pg = Math.min(page, pgs)
  const view = useMemo(() => rows.slice(off + (pg - 1) * size, off + pg * size), [rows, off, pg, size])
  const maxP = useMemo(() => Math.max(1, ...view.map(t => Math.abs(t.pnl))), [view])
  const base10 = useMemo(() => {
    // where the top 10's trading volume goes, per period (mock numbers)
    const shares = ([['SOL', 31], ['BTC', 27], ['ETH', 18], ['HYPE', 12]] as [string, number][]).map(([m, v], i) => [m, Math.max(3, v + ((ri * 3 + i * 2) % 5) - 2)] as [string, number])
    return { shares }
  }, [ranked, ri])
  const goMarket = useCallback((m: string) => { fns.current.set({ sym: m }); fns.current.router.push('/' + m) }, [])

  if (v2) {
    const cut10 = ranked[9], cut100 = ranked[99]
    const mineBase = signedIn && !ghost ? scale({ rank: 0, addr: 'you', pnl: Math.round(acct.realized + acct.upnl), roi: +(((acct.realized + acct.upnl) / Math.max(1, acct.deposited)) * 100).toFixed(2), vol: Math.round(acct.traded), value: Math.round(acct.equity) } as Trader, mul) : null
    // preview states: put the account at a mock PnL that lands in each tier, so every state of the card can be seen
    const pvPnl = { out: Math.round(cut100.pnl * 0.35), top100: Math.round(ranked[25].pnl), top10: Math.round(ranked[6].pnl * 0.99), top3: Math.round((ranked[0].pnl + ranked[1].pnl) / 2) }
    const mine = mineBase && pv !== 'live' ? { ...mineBase, pnl: pvPnl[pv], roi: ranked[{ out: 99, top100: 25, top10: 6, top3: 1 }[pv]].roi } : mineBase
    const myRank = mine ? above(ranked, mine.pnl) + 1 : 0
    return (
      <div className="pagewrap" style={{ padding: 0 }}>
        <div className="lb2">
          <div className="lb2-top">
            <div className="lb2-t"><h1>Leaderboard</h1><span>Ranked by profit and loss, net of fees</span></div>
            <div className="lb-ranges" role="tablist" aria-label="Period">{RANGES.map((r, i) => <button key={r[0]} role="tab" aria-selected={i === ri} className={i === ri ? 'on' : ''} onClick={() => setRi(i)}>{r[0]}</button>)}</div>
            <label className="lb-search"><Search size={16} /><input aria-label="Search trader address" placeholder="Search trader address" value={q} onChange={e => setQ(e.target.value)} />{q && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQ('')}><X size={14} /></button>}</label>
          </div>

          <div className="lb2-grid">
            <div className="lb2-main">
              {hideTop && (loading ? <PodiumSkel /> : <Podium podium={podium} short={short} watchKey={watch.join('|')} onCopy={onCopy} onView={onView} />)}
              <div className="lb2-card">
                <div className="lb2-scroll"><div className="lb2-tbl">
                  <div className="lb2-hd">
                    <div className="c0">{head('rank', 'Rank', true)}</div><div className="c1"><span>Trader</span></div>
                    <div className="cn">{head('pnl', `PnL (${short})`)}</div><div className="cn">{head('roi', `ROI (${short})`)}</div><div className="cn">{head('vol', `Volume (${short})`)}</div><div className="cn">{head('value', 'Account value')}</div>
                  </div>
                  {loading ? Array.from({ length: size }, (_, i) => <RowSkel key={i} />)
                    : view.map(t => <Row key={t.addr + t.rank} t={t} maxP={maxP} me={!!ghostKey && t.addr.startsWith(ghostKey)} w={watch.includes(t.addr)} onCopy={onCopy} onView={onView} />)}
                  {!loading && !view.length && <div className="lb-empty">{dq.trim() ? `No traders match "${dq.trim()}"` : 'No traders found'}</div>}
                </div></div>
                <Pager cls="lb2-pg" size={size} setSize={setSize} page={pg} setPage={setPage} pages={pgs} from={off + (pg - 1) * size + 1} to={Math.min(off + pg * size, rows.length)} total={loading ? 0 : rows.length} />
                <div className="lb2-ft">Minimum account value and trading volume thresholds apply. PnL is realised + unrealised, net of fees. Last updated {stamp}.</div>
              </div>
            </div>

            <aside className="lb2-side">
              <section className="lb2-facts">
                <h2 className="lb2-ht">Top Trading Markets</h2>
                {base10.shares.map(([m, v]) => (
                  <button key={m} className="lb2-mk" onClick={() => goMarket(m)} aria-label={`${m}: ${v}% of the top 10's volume. Open market`}>
                    <Logo sym={m} size={22} /><b>{m}</b><u><i style={{ width: v * 2.4 + '%' }} /></u><span className="num">{v}%</span>
                  </button>
                ))}
              </section>
              <section className="lb2-me">
                {!signedIn && !ghost ? <><span className="eb">Your standing</span><b className="big2">Where would you rank?</b><p>Connect a wallet to see your PnL against the top traders.</p><button className="lb2-cta" onClick={() => openDialog('login')}>Start Trading<ArrowRight size={16} /></button></>
                  : ghost ? <><span className="eb">Viewing</span><b className="big2 ad">{ghost.length > 14 ? ghost.slice(0, 4) + '…' + ghost.slice(-4) : ghost}</b>{gRow && <p>Rank <b>#{gRow.rank}</b> by PnL ({short}).</p>}<button className="lb2-cta sec" onClick={() => exitGhost()}>Back to my account</button></>
                    : mine && <>
                      <span className="eb">Your standing{settings.publicBoard ? '' : ' · private'}</span>
                      <b className="big2">{myRank > 100 ? 'Outside the top 100' : `${settings.publicBoard ? 'About' : 'Would be about'} #${myRank} by PnL`}</b>
                      {!settings.publicBoard && <p>Your account is hidden from the public leaderboard, so other traders do not see it. Only you see this standing. <button className="pv-link" style={{ color: 'hsl(var(--phoenix))' }} onClick={() => { set({ settingsTab: 'General' }); openDialog('settings') }}>Show it</button></p>}
                      <div className="lb2-y3 num">
                        <div><span className="lb2-tip" tabIndex={0} data-tip={`Profit and loss over ${label.toLowerCase()}: what you made or lost, realised plus unrealised, after fees. The leaderboard is ranked by this number.`}>PnL</span><b className={mine.pnl >= 0 ? 'buy' : 'sell'}>{money(mine.pnl, true)}</b></div>
                        <div><span className="lb2-tip" tabIndex={0} data-tip={`Return on investment over ${label.toLowerCase()}: your PnL as a percentage of the money you put in. It shows how efficiently you trade, not how much.`}>ROI</span><b>{mine.roi.toFixed(2)}%</b></div>
                        <div><span className="lb2-tip r" tabIndex={0} data-tip={`Trading volume over ${label.toLowerCase()}: the total value of everything you traded (size times price of each fill), buys and sells together.`}>Volume</span><b>{usd(mine.vol, 0)}</b></div>
                      </div>
                      {(() => {
                        const goal = myRank > 100 ? { n: 'Top 100', c: cut100 } : myRank > 10 ? { n: 'Top 10', c: cut10 } : myRank > 3 ? { n: 'Top 3', c: ranked[2] } : myRank > 1 ? { n: '#1', c: ranked[0] } : null
                        const need = goal ? Math.max(0, goal.c.pnl - mine.pnl) : 0, pctDone = goal ? Math.min(100, Math.max(2, (Math.max(0, mine.pnl) / goal.c.pnl) * 100)) : 100
                        return (
                          <div className="lb2-goal">
                            {goal ? <>
                              <span className="gl">Next goal</span>
                              <div className="gt"><b>{goal.n}</b>{need > 0 ? <span className="num lb2-tip r" tabIndex={0} data-tip={`This is PnL: ${money(need)} more profit (after fees) over ${label.toLowerCase()} to reach the ${goal.n === '#1' ? 'top spot' : goal.n}. The cut-off is ${money(goal.c.pnl, true)} and you are at ${money(mine.pnl, true)}.`}>{money(need)} more to go</span> : <span className="num">You are there</span>}</div>
                              <div className="gb"><i style={{ width: pctDone + '%' }} /><em style={{ left: pctDone + '%' }} /></div>
                            </> : <>
                              <span className="gl">You lead the board</span>
                              <div className="gt"><b>#1</b><span className="num">{money(mine.pnl - ranked[1].pnl)} ahead of #2</span></div>
                              <div className="gb"><i style={{ width: '100%' }} /><em style={{ left: '100%' }} /></div>
                            </>}
                          </div>
                        )
                      })()}
                      <button className="lb2-cta" onClick={() => router.push('/SOL')}>Trade<ArrowRight size={16} /></button>
                    </>}
              </section>
            </aside>
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------- classic
  const cpages = Math.max(1, Math.ceil(rows.length / size))
  const cpg = Math.min(page, cpages), shown = rows.slice((cpg - 1) * size, cpg * size)
  return (
    <div className="pagewrap" style={{ background: '#000', padding: 0 }}>
      <div className="lb">
        <div className="lb-top">
          <div className="lb-ranges">{RANGES.map((r, i) => <button key={r[0]} className={i === ri ? 'on' : ''} onClick={() => setRi(i)}>{r[0]}</button>)}</div>
          <label className="lb-search"><Search size={16} /><input aria-label="Search trader address" placeholder="Search trader address" value={q} onChange={e => setQ(e.target.value)} />{q && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQ('')}><X size={14} /></button>}</label>
        </div>
        {signedIn && !ghost && <div className="lb-note"><Info size={16} />Not yet eligible — keep trading to appear on the leaderboard.</div>}
        {ghost && gRow && (
          <div className="lb-place"><Badge n={gRow.rank} /><span>{gRow.addr}</span><span className="pl">Placement<ChevronRight size={12} /></span></div>
        )}
        <div className="lb-card"><div className="lb-scroll">
          <div className="lb-hd">
            <div className="c0">{head('rank', 'Rank', true)}</div><div className="c1"><span>Trader</span></div>
            <div className="cn">{head('pnl', `PnL (${short})`)}</div><div className="cn">{head('roi', `ROI (${short})`)}</div><div className="cn">{head('vol', `Volume (${short})`)}</div><div className="cn">{head('value', 'Account Value')}</div>
          </div>
          {loading ? Array.from({ length: size }, (_, i) => (
            <div key={i} className="lb-row lb-sk"><div className="cA"><span className="skel c" /></div><div className="cB"><span className="skel" style={{ width: 80 }} /></div>
              <div className="cN"><span className="skel" style={{ width: 64 }} /><span className="skel" style={{ width: 56 }} /><span className="skel" style={{ width: 56 }} /><span className="skel" style={{ width: 72 }} /></div></div>
          )) : shown.map(t => (
            <div key={t.addr + t.rank} className={'lb-row' + (ghostKey && t.addr.startsWith(ghostKey) ? ' me' : '')}>
              <div className="cA"><Badge n={t.rank} /></div>
              <div className="cB"><button className="a" title="View this trader's account (read-only)" onClick={() => enterGhost(t.addr)}>{t.addr}</button>
                <button className="lb-ib" aria-label="Copy pubkey" title="Copy address" onClick={() => onCopy(t.addr)}><Copy size={12} /></button>
                <button className="lb-ib g" aria-label="Enter ghost mode" title="View this trader's account (read-only)" onClick={() => enterGhost(t.addr)}><Ghost size={12} /></button></div>
              <div className="cN">
                <span className={t.pnl >= 0 ? 'buy' : 'sell'}>{(t.pnl >= 0 ? '+' : '-') + '$' + fmt(Math.abs(t.pnl), 0)}</span>
                <span className={t.roi >= 0 ? 'buy' : 'sell'}>{(t.roi >= 0 ? '+' : '') + t.roi.toFixed(2)}%</span>
                <span>{usd(t.vol, 0)}</span>
                <span>{usd(t.value, 0)}</span>
              </div>
            </div>
          ))}
          {!loading && !rows.length && <div className="lb-empty">No traders found</div>}
          <Pager cls="lb-pg" size={size} setSize={setSize} page={cpg} setPage={setPage} pages={cpages} from={(cpg - 1) * size + 1} to={Math.min(cpg * size, rows.length)} total={loading ? 0 : rows.length} />
          <div className="lb-ft"><span>Minimum account value and trading volume thresholds apply. PnL is realized + unrealized, net of fees.</span><span>Last updated: {stamp}</span></div>
        </div></div>
      </div>
    </div>
  )
}

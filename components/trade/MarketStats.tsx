'use client'
import { HintScroll } from './ScrollHint'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, Gift, Search, Star } from 'lucide-react'
import { TriDown, TriUp } from '@/components/icons/Phx'
import { E } from '@/lib/sim'
import { MARKETS, compact, fmt, logo, price as fp, type Market } from '@/lib/data'
import { useApp } from '@/lib/store'
import { usePresence } from '@/lib/presence'

const CATS = ['Featured', 'All', 'Pre-IPO', 'Crypto', 'Commodities', 'Equities', 'Upcoming Earnings'] as const
const FEATURED = ['SOL', 'BTC', 'HYPE', 'ETH', 'NVDA', 'SPCX', 'ZEC', 'SNDK']
const EARNINGS = ['NVDA', 'DELL', 'AMAT', 'NET', 'MRVL', 'BABA', 'ASML']
const GIFT = new Set(['SOL', 'BTC', 'HYPE', 'ETH'])
type SortKey = 'vol' | 'px' | 'chg' | 'oi' | 'cap' | 'fund' | 'lev'

export function Logo({ sym, size = 18 }: { sym: string; size?: number }) {
  const [bad, setBad] = useState(false)
  if (bad) return <span style={{ width: size, height: size, borderRadius: '50%', background: 'hsl(var(--button))', display: 'inline-grid', placeItems: 'center', fontSize: size * 0.5, fontWeight: 600, flex: 'none' }}>{sym[0]}</span>
  return <img src={logo(sym)} alt="" width={size} height={size} style={{ borderRadius: '50%', flex: 'none' }} onError={() => setBad(true)} />
}
// price tick flash: re-key the element when the value changes so the colour keyframe replays (green up / red down)
export function useFlash(v: number) {
  const prev = useRef(v)
  const [f, setF] = useState({ cls: '', k: 0 })
  useEffect(() => {
    if (v !== prev.current) { const up = v > prev.current; prev.current = v; setF(s => ({ cls: up ? 'animate-price-up' : 'animate-price-down', k: s.k + 1 })) }
  }, [v])
  useEffect(() => { if (!f.cls) return; const t = setTimeout(() => setF(s => (s.k === f.k ? { cls: '', k: s.k } : s)), 520); return () => clearTimeout(t) }, [f.k]) // eslint-disable-line react-hooks/exhaustive-deps
  return f
}
export const open24 = (m: Market) => m.px / (1 + m.chg / 100)
const capNum = (m: Market) => { const c = m.cap; if (!c) return 0; const n = parseFloat(c.slice(1)); return c.endsWith('T') ? n * 1e12 : c.endsWith('B') ? n * 1e9 : n * 1e6 }

function hhmmss(secs: number) { const s = Math.max(0, secs); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map(n => String(n).padStart(2, '0')).join(':') }

function Stats({ v2, children }: { v2: boolean; children: React.ReactNode }) { return v2 ? <HintScroll className="t-st">{children}</HintScroll> : <div className="t-st">{children}</div> }

export default function MarketStats() {
  const { sym, market, mark, set, favs, toggleFav, tickN, v2 } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const pr = usePresence(open)
  const [cat, setCat] = useState<(typeof CATS)[number]>('All')
  const [q, setQ] = useState('')
  const [hl, setHl] = useState(0)
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'vol', dir: -1 })
  const inp = useRef<HTMLInputElement>(null)
  void tickN

  const o24 = open24(market), dAbs = mark - o24, dPct = (dAbs / o24) * 100
  const up = dAbs >= 0
  const now = new Date(), secsLeft = 3600 - (now.getMinutes() * 60 + now.getSeconds())
  const index = mark * (1 - 0.00035 * (((sym.charCodeAt(0) % 5) - 2) / 2 || 1))
  const fm = useFlash(mark), fi = useFlash(index)

  const rows = useMemo(() => {
    let l = MARKETS.slice()
    if (cat === 'Featured') l = FEATURED.map(s => MARKETS.find(m => m.sym === s)!).filter(Boolean)
    else if (cat === 'Pre-IPO') l = l.filter(m => m.cat === 'preipo')
    else if (cat === 'Crypto') l = l.filter(m => m.cat === 'crypto')
    else if (cat === 'Commodities') l = l.filter(m => m.cat === 'commodity')
    else if (cat === 'Equities') l = l.filter(m => m.cat === 'stock')
    else if (cat === 'Upcoming Earnings') l = EARNINGS.map(s => MARKETS.find(m => m.sym === s)!).filter(Boolean)
    const t = q.trim().toLowerCase()
    if (t) l = l.filter(m => m.sym.toLowerCase().includes(t) || m.name.toLowerCase().includes(t))
    const v = (m: Market) => sort.k === 'px' ? E.marks[m.sym] : sort.k === 'chg' ? m.chg : sort.k === 'oi' ? m.oi : sort.k === 'cap' ? capNum(m) : sort.k === 'fund' ? m.fund : sort.k === 'lev' ? m.lev : m.vol
    return l.sort((a, b) => (v(a) - v(b)) * sort.dir)
  }, [cat, q, sort]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (s: string) => { set({ sym: s }); setOpen(false); setQ(''); router.push('/' + s) }
  useEffect(() => { setHl(0) }, [cat, q, open])
  useEffect(() => { if (open) setTimeout(() => inp.current?.focus(), 0) }, [open])
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); setOpen(true) }
      else if (open && e.key === 'Escape') setOpen(false)
      else if (open && e.key === 'ArrowDown') { e.preventDefault(); setHl(h => Math.min(rows.length - 1, h + 1)) }
      else if (open && e.key === 'ArrowUp') { e.preventDefault(); setHl(h => Math.max(0, h - 1)) }
      else if (open && e.key === 'Enter' && rows[hl]) pick(rows[hl].sym)
    }
    window.addEventListener('keydown', kd); return () => window.removeEventListener('keydown', kd)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  const Th = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th onClick={() => setSort(s => (s.k === k ? { k, dir: (-s.dir) as 1 | -1 } : { k, dir: -1 }))}>
      {sort.k === k && (sort.dir === -1 ? <ChevronDown size={12} style={{ display: 'inline', verticalAlign: -2 }} /> : <ChevronUp size={12} style={{ display: 'inline', verticalAlign: -2 }} />)}{children}
    </th>
  )

  return (
    <div className="t-mkt">
      <button className={`t-star${favs.includes(sym) ? ' on' : ''}`} onClick={() => toggleFav(sym)} aria-label={`Add ${sym} to favorites`}>
        <Star size={16} fill={favs.includes(sym) ? 'currentColor' : 'none'} />
      </button>
      <button className={`t-sel${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
        <Logo sym={sym} size={24} /><span className="nm">{sym}</span><span className="lv">{market.lev}x</span>
        <ChevronDown size={16} className={`muted chv${open ? ' o' : ''}`} />
      </button>
      <Stats v2={v2}>
        <div><span className="l">Mark</span><span className="v"><span key={fm.k} className={fm.cls}>${fp(mark, market.dec)}</span></span></div>
        <div><span className="l">Index</span><span className="v"><span key={fi.k} className={fi.cls}>${fp(index, market.dec)}</span></span></div>
        <div><span className="l">24h Change</span><span className={`v ${up ? 'buy' : 'sell'}`}>{up ? '+' : '-'}${fp(Math.abs(dAbs), market.dec)} ({dPct >= 0 ? '+' : ''}{dPct.toFixed(2)}%){up ? <TriUp size={12} /> : <TriDown size={12} />}</span></div>
        <div><span className="l">24h Volume</span><span className="v">${fmt(market.vol + (E.tickN % 50) * 37, 0)}</span></div>
        <div><span className="l">Open Interest</span><span className="v">${fmt(market.oi + (E.tickN % 30) * 11, 0)}</span></div>
        <div><span className="l">1h Funding</span><span className="v"><span className={market.fund >= 0 ? 'buy' : 'sell'}>{market.fund.toFixed(4)}%</span><span>{hhmmss(secsLeft)}</span></span></div>
        <div><span className="l">Market Cap</span><span className="v">{market.cap ?? '-'}</span></div>
      </Stats>
      {pr.mounted && (<>
        {open && <div style={{ position: 'fixed', inset: 0, zIndex: 44 }} onClick={() => setOpen(false)} />}
        <div className="t-msel pop-in" data-state={pr.state} style={{ ['--pop-origin' as string]: 'top left' }}>
          <div className="t-msearch"><Search size={14} /><input ref={inp} placeholder="Search Markets" value={q} onChange={e => setQ(e.target.value)} /></div>
          <div className="t-mtabs">{CATS.map(c => <button key={c} className={c === cat ? 'on' : ''} onClick={() => setCat(c)}>{c}</button>)}</div>
          <div className="t-mscroll">
            <table className="t-mt num">
              <thead><tr><th>Market</th><Th k="lev">Max Leverage</Th><Th k="px">Price</Th><Th k="chg">24h Change</Th><Th k="vol">24h Volume</Th><Th k="oi">Open Interest</Th><Th k="cap">Market Cap</Th><Th k="fund">1h Funding</Th></tr></thead>
              <tbody>
                {rows.map((m, i) => {
                  const mk = E.marks[m.sym] ?? m.px, d = ((mk - open24(m)) / open24(m)) * 100
                  return (
                    <tr key={m.sym} className={i === hl ? 'hl' : ''} onMouseEnter={() => setHl(i)} onClick={() => pick(m.sym)}>
                      <td><div className="tmk">
                        <span className={`t-star${favs.includes(m.sym) ? ' on' : ''}`} onClick={e => { e.stopPropagation(); toggleFav(m.sym) }}><Star size={16} fill={favs.includes(m.sym) ? 'currentColor' : 'none'} /></span>
                        <Logo sym={m.sym} />{m.sym}{GIFT.has(m.sym) && <Gift size={14} className="gift" />}
                      </div></td>
                      <td><span className="lvb">{m.lev}x</span></td>
                      <td>${fp(mk, m.dec)}</td>
                      <td className={d >= 0 ? 'buy' : 'sell'}>{d >= 0 ? '+' : ''}{d.toFixed(2)}% {d >= 0 ? <TriUp size={12} style={{ display: 'inline-flex', verticalAlign: 0 }} /> : <TriDown size={12} style={{ display: 'inline-flex', verticalAlign: 0 }} />}</td>
                      <td>${fmt(m.vol, 0)}</td><td>${fmt(m.oi, 0)}</td><td>{m.cap ?? '-'}</td>
                      <td className={m.fund >= 0 ? 'buy' : 'sell'}>{m.fund.toFixed(4)}%</td>
                    </tr>
                  )
                })}
                {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: 'center', height: 120 }} className="muted">No markets found</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="t-mkeys"><span><kbd>/</kbd>Open</span><span><kbd>↑↓</kbd>Navigate</span><span><kbd>Enter</kbd>Select</span><span><kbd>Esc</kbd>Close</span></div>
        </div>
      </>)}
    </div>
  )
}
void compact

'use client'
import Unbuilt from '../Unbuilt'
import { memo, useDeferredValue, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowDown, X } from 'lucide-react'
import { PhoenixLogo } from '@/components/icons/Phx'
import Logo from './Logo'
import { useApp } from '@/lib/store'
import { MARKETS, pct, compact, price, type Cat, type Market } from '@/lib/data'
import './pages.css'

const SECS: { cat: Cat; title: string; total: number; noun: string }[] = [
  { cat: 'crypto', title: 'Crypto perpetual futures', total: 55, noun: 'crypto' },
  { cat: 'stock', title: 'Stock and ETF perpetual futures', total: 44, noun: 'stock and ETF' },
  { cat: 'commodity', title: 'Commodity perpetual futures', total: 4, noun: 'commodity' },
  { cat: 'preipo', title: 'Pre-IPO perpetual futures', total: 1, noun: 'pre-IPO' },
]
const MOVERS: [string, number][] = [['ANSEM', -22.36], ['AMD', 14.66], ['AMAT', 11.23], ['NET', 10.73], ['MRVL', 9.76], ['NBIS', 9.36], ['KLAC', 9.24], ['AVGO', 8.89], ['ORE', -9.09], ['CBRS', 8.41]]
const RECENT = ['AERO', 'DRV', 'KLAC', 'METADAO', 'ORE']
// the live site lists every market in the page (collapsed to 8 rows); the replica's data file only has the headline ones, so pad the lists with the remaining listed names
const EXTRA: [string, string, Cat][] = [
  ['VVV', 'Venice', 'crypto'], ['SUI', 'Sui', 'crypto'], ['VIRTUAL', 'Virtuals Protocol', 'crypto'], ['ENA', 'Ethena', 'crypto'], ['PEPE', 'Pepe', 'crypto'], ['UNI', 'Uniswap', 'crypto'], ['JUP', 'Jupiter', 'crypto'], ['LINK', 'Chainlink', 'crypto'], ['CRV', 'Curve DAO', 'crypto'], ['XLM', 'Stellar', 'crypto'], ['MORPHO', 'Morpho', 'crypto'], ['DOGE', 'Dogecoin', 'crypto'], ['JTO', 'Jito', 'crypto'], ['FIL', 'Filecoin', 'crypto'], ['LTC', 'Litecoin', 'crypto'], ['ORCA', 'Orca', 'crypto'], ['TAO', 'Bittensor', 'crypto'], ['FET', 'Artificial Superintelligence Alliance', 'crypto'], ['BP', 'Backpack', 'crypto'], ['TRX', 'Tron', 'crypto'], ['MEGA', 'MegaETH', 'crypto'], ['SHIB', 'Shiba Inu', 'crypto'], ['RAY', 'Raydium', 'crypto'], ['SKR', 'Seeker', 'crypto'], ['BONK', 'Bonk', 'crypto'], ['DERIVE', 'Derive', 'crypto'], ['NEAR', 'NEAR Protocol', 'crypto'], ['APT', 'Aptos', 'crypto'], ['OP', 'Optimism', 'crypto'], ['TON', 'Toncoin', 'crypto'], ['ATOM', 'Cosmos', 'crypto'], ['DOT', 'Polkadot', 'crypto'], ['INJ', 'Injective', 'crypto'], ['TIA', 'Celestia', 'crypto'], ['RENDER', 'Render', 'crypto'], ['WLD', 'Worldcoin', 'crypto'], ['ONDO', 'Ondo', 'crypto'],
  ['INTC', 'Intel', 'stock'], ['QQQ', 'Nasdaq-100 ETF', 'stock'], ['HOOD', 'Robinhood', 'stock'], ['MU', 'Micron', 'stock'], ['COIN', 'Coinbase', 'stock'], ['HY9H', 'SK hynix', 'stock'], ['CRWV', 'CoreWeave', 'stock'], ['SPY', 'S&P 500 ETF', 'stock'], ['CRCL', 'Circle', 'stock'], ['TSM', 'TSMC', 'stock'], ['QCOM', 'Qualcomm', 'stock'], ['CBRS', 'Cerebras', 'stock'], ['NFLX', 'Netflix', 'stock'], ['LLY', 'Eli Lilly', 'stock'], ['TLT', '20+ Year Treasury Bond ETF', 'stock'], ['MSFT', 'Microsoft', 'stock'], ['ORCL', 'Oracle', 'stock'], ['PLTR', 'Palantir', 'stock'], ['CRWD', 'CrowdStrike', 'stock'], ['TXN', 'Texas Instruments', 'stock'], ['OPEN', 'Opendoor', 'stock'], ['ADBE', 'Adobe', 'stock'], ['CRM', 'Salesforce', 'stock'], ['V', 'Visa', 'stock'],
]
const REAL_STOCK_TOP = ['NVDA', 'SPCX', 'SNDK', 'IREN', 'MSTR', 'DELL', 'GOOGL', 'META']
const ALL: Market[] = (() => {
  const base = MARKETS.map(m => m.cat === 'stock' && !REAL_STOCK_TOP.includes(m.sym) ? { ...m, vol: Math.min(m.vol, 125e3) } : m)
  const seen = new Set(base.map(m => m.sym))
  const extra = EXTRA.filter(([s]) => !seen.has(s)).map(([sym, name, cat], i) => {
    const k = (i * 37) % 100
    return { sym, name, cat, lev: 10, px: 1 + k * 3.7, chg: ((k % 17) - 8) / 3, vol: Math.max(1200, 84e3 * Math.pow(0.93, i % 26)), oi: Math.max(300, 21e3 * Math.pow(0.94, i % 24)), fund: 0.0012, dec: 2 } as Market
  })
  return [...base, ...extra]
})()
type K = 'px' | 'chg' | 'vol' | 'oi' | 'fund'
const COLS: [K, string][] = [['px', 'Price'], ['chg', '24h'], ['vol', '24h volume'], ['oi', 'Open interest'], ['fund', 'Funding, 1h']]
const FAQ: [string, string][] = [
  ['Can I trade stocks on Phoenix at the weekend?', 'Yes. Every market trades 24/7, stocks and ETFs included. Stock and ETF index prices come from external sources 24/5, through the premarket, after-hours and overnight sessions. On weekends and holidays, they come from the Phoenix order book, within a bound of the last external price.'],
  ['Do I own the stock, ETF or company?', 'No. Each market is a perpetual future: a contract that tracks the price of the asset and settles in USDC. You hold a leveraged position, not shares, so there are no dividends, voting rights or delivery.'],
  ['What does a positive funding rate mean?', 'Traders who are long pay traders who are short when the funding rate is positive, and the reverse when it is negative. Funding keeps the perpetual close to the index price and is charged continuously.'],
  ['How is open interest counted?', 'Each contract once, in USD at the current mark price. Long and short positions are not added together, so open interest is the notional value of all contracts that are still open.'],
  ['What collateral and fees apply?', 'USDC and native SOL count as collateral. Trading fees are charged per fill, and funding accrues while a position is open. See the fee schedule in the docs for current rates.'],
]
const rich = (t: string) => t

const Sec = memo(function Sec({ cat, title, total, noun, q }: (typeof SECS)[number] & { q: string }) {
  const [all, setAll] = useState(false), [sk, setSk] = useState<K>('vol'), [dir, setDir] = useState<1 | -1>(-1)
  const f = q.trim().toLowerCase()
  const list = useMemo(() => ALL.filter(m => m.cat === cat && (!f || (m.sym + ' ' + m.name).toLowerCase().includes(f))).sort((a, b) => (a[sk] - b[sk]) * dir), [cat, f, sk, dir])
  if (!list.length) return null
  const more = !all && !f && list.length > 8
  const n = list.length
  return (
    <section className="mk-sec">
      <div className="mkh"><h2>{title}</h2><small>{total} market{total === 1 ? '' : 's'}</small></div>
      <div className="mk-tw">
        <div className="mk-scroll" style={more ? { maxHeight: 42.8 + 8 * 54.7 + 45.4, overflowY: 'hidden' } : undefined}>
        <table className="mk-tbl">
          <thead><tr><th><span className="mk-th">Market</span></th>{COLS.map(([k, t]) => <th key={k}><button className={'mk-th' + (sk === k ? ' on' : '')} aria-label={`Sort by ${t}` + (sk === k ? (dir === 1 ? ', ascending' : ', descending') : '')} onClick={() => { if (sk === k) setDir(d => (d === 1 ? -1 : 1)); else { setSk(k); setDir(-1) } }}>{t}{sk === k && <ArrowDown size={12} style={dir === 1 ? { transform: 'rotate(180deg)' } : undefined} />}</button></th>)}</tr></thead>
          <tbody>{list.map(m => (
            <tr key={m.sym}>
              <td><Link href={'/' + m.sym} className="mk-m"><Logo sym={m.sym} size={24} /><span><b>{m.sym}{m.cat === 'preipo' && <em>Pre-IPO</em>}</b><small>{m.name}</small></span></Link></td>
              <td><span>${price(m.px, m.px >= 10000 ? 0 : m.px >= 1 ? 2 : m.dec)}</span></td>
              <td><span className={m.chg < 0 ? 'sell' : 'buy'}>{pct(m.chg)}</span></td>
              <td><span>{compact(m.vol)}</span></td>
              <td><span>{compact(m.oi)}</span></td>
              <td><span className={m.fund < 0 ? 'sell' : 'buy'}>{(m.fund < 0 ? '' : '+') + m.fund.toFixed(4)}%</span></td>
            </tr>))}</tbody>
        </table>
        </div>
        {more && <div className="mk-more"><button onClick={() => setAll(true)}>Show all {total} {noun} markets</button></div>}
      </div>
    </section>
  )
})

export default function MarketsPage() {
  const { openDialog, signedIn } = useApp()
  const [q, setQ] = useState(''), [open, setOpen] = useState(1)
  const dq = useDeferredValue(q)
  return (
    <div className="mkp">
      <header className="mk-hd">
        <div className="in">
          <Link href="/" className="hlg" aria-label="Phoenix home"><PhoenixLogo /></Link>
          <nav><Link href="/">Trade</Link><Link href="/portfolio">Portfolio</Link><Link href="/rewards">Rewards</Link><Link href="/leaderboard">Leaderboard</Link></nav>
          {signedIn ? <Link href="/" className="go">Open app</Link> : <button className="go" onClick={() => openDialog('login')}>Start Trading</button>}
        </div>
      </header>
      <main className="mk">
        <h1>Perpetual Futures Markets on the Phoenix Perp DEX</h1>
        <p className="sum">Phoenix lists 104 perpetual futures markets: 55 crypto, 44 stocks and ETFs, 4 commodities and 1 <span style={{ whiteSpace: 'nowrap' }}>pre-IPO</span>. Together they traded $39.15M in the last 24 hours, with $20.90M in open interest.</p>
        <p className="upd">Updated Nov 9, 2026, 20:29 UTC</p>
        <div className="mk-cards">
          <section className="mk-card"><h2>Top movers, 24h</h2>
            <div className="mk-mv">{MOVERS.map(([s, p]) => <Link key={s} href={'/' + s} className="mk-li"><Logo sym={s} size={20} /><b>{s}</b><span className={'e ' + (p < 0 ? 'sell' : 'buy')}>{pct(p)}</span></Link>)}</div>
          </section>
          <section className="mk-card"><h2>Recently listed</h2>
            {RECENT.map(s => <Link key={s} href={'/' + s} className="mk-li"><Logo sym={s} size={20} /><b>{s}</b><small>Listed Oct 27</small></Link>)}
          </section>
        </div>
        <div className="mk-bar">
          <nav className="mk-pill"><span>All markets</span></nav>
          <label className="mk-search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg><input aria-label="Search markets" placeholder="Search markets" value={q} onChange={e => setQ(e.target.value)} />{q && <button type="button" className="clr" aria-label="Clear search" onClick={() => setQ('')}><X size={14} /></button>}</label>
        </div>
        {SECS.map(s => <Sec key={s.cat} {...s} q={dq} />)}
        {dq.trim() && !ALL.some(m => (m.sym + ' ' + m.name).toLowerCase().includes(dq.trim().toLowerCase())) && <div className="mk-empty">No markets match &ldquo;{dq.trim()}&rdquo;</div>}
        <section className="mk-faq">
          <div className="hd"><h2>Questions</h2></div>
          {FAQ.map(([qq, a], i) => (
            <div key={qq} className={'it' + (open === i + 1 ? ' open' : '')}>
              <button className="sm" onClick={() => setOpen(o => (o === i + 1 ? 0 : i + 1))}><b>{qq}</b><span aria-hidden>+</span></button>
              {open === i + 1 && <p>{rich(a)}</p>}
            </div>
          ))}
        </section>
      </main>
      <footer className="mk-ft">
        <div className="cols">
          <p>Perpetual futures on a fully on-chain order book.</p>
          <div><h3>Markets</h3><Link href="/markets">All markets</Link><Unbuilt href="/earnings" className="soon">Earnings calendar</Unbuilt></div>
          <div><h3>Phoenix</h3><Unbuilt href="https://docs.phoenix.trade/">Docs</Unbuilt><Unbuilt href="/terms-of-service">Terms</Unbuilt><Unbuilt href="/privacy-policy">Privacy</Unbuilt><a href="https://x.com/PhoenixTrade" target="_blank" rel="noopener noreferrer">X</a><a href="https://discord.com/invite/phoenixtrade" target="_blank" rel="noopener noreferrer">Discord</a></div>
        </div>
        <div className="legal2"><div><p>Perpetual futures carry significant risk, including the loss of your entire collateral.</p><p>See Phoenix <Unbuilt href="/terms-of-service">terms and conditions</Unbuilt>. Products are not available in all jurisdictions.</p></div><p className="c">© 2026 Phoenix</p></div>
      </footer>
    </div>
  )
}

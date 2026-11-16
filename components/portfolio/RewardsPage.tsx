'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Copy, Lock, Unlock } from 'lucide-react'
import { useApp } from '@/lib/store'
import { fmt } from '@/lib/data'
import { Gate } from './PortfolioPage'
import RewardsV2, { PayoutText } from './RewardsV2'
import './portfolio.css'

const DAY = 864e5
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const md = (t: number) => MO[new Date(t).getMonth()] + ' ' + new Date(t).getDate()

export default function RewardsPage() {
  const { signedIn, ghost, acct, loading, say, v2 } = useApp()
  const router = useRouter()
  // only the calendar day matters here (the second-by-second countdown lives in its own small component), so this re-renders at midnight, not every second
  const midnight = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() }
  const [day, setDay] = useState(midnight)
  useEffect(() => { const id = setInterval(() => setDay(midnight()), 20000); return () => clearInterval(id) }, [])
  useEffect(() => { if (ghost) router.replace('/portfolio') }, [ghost, router])
  if (!signedIn && !ghost) return <div className="rw-page"><div className="rw"><Gate title="Connect your wallet to view rewards" text="Referral rewards, claimable balances, and reward activity appear here once a wallet is connected." /></div></div>
  if (ghost) return null

  const todayMid = new Date(day)
  const start = day - 6 * DAY // rewards programme start for this account
  const dayN = 6
  const eligible = ['SOL', 'BTC', 'ETH', 'HYPE']
  const paid = acct.fund.filter(f => eligible.includes(f.sym) && f.amount < 0).reduce((a, f) => a + -f.amount, 0)
  const claimable = paid * 0.1
  const days = Array.from({ length: 10 }, (_, i) => todayMid.getTime() - (10 - i) * DAY)
  const startIdx = days.findIndex(d => d >= start), nEarn = Math.max(1, 9 - startIdx + 1) // v2: spread the earnings over the days since the programme began (today excluded)
  const daily = claimable / nEarn
  const yMax = v2 && claimable > 0 ? (() => { const t = daily * 1.4, p = Math.pow(10, Math.floor(Math.log10(t))), m = t / p; return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p })() : 1
  const yT = [0, 0.2, 0.4, 0.6, 0.8, 1].map(f => f * yMax)
  const volQ = typeof location !== 'undefined' ? parseFloat(new URLSearchParams(location.search).get('vol') ?? '') : NaN // demo switch: ?vol=2500 previews the locked referral state
  const vol = Number.isNaN(volQ) ? acct.traded : volQ, pr = Math.min(100, (vol / 10000) * 100), unlocked = vol >= 10000
  const L = 36, R = 24, cw = 100 // percentages handled in viewBox 1000x230
  void L; void R; void cw

  // v2: while the account loads, the real layout is drawn as grey blocks so nothing moves when the numbers arrive
  if (v2) return <RewardsV2 start={start} todayMid={day} vol={vol} ghost={loading.acct} />
  return (
    <div className="rw-page"><div className="rw">
      {loading.acct ? <><div className="skel" style={{ height: 84, borderRadius: 12 }} /><div className="skel" style={{ height: 346, borderRadius: 16 }} /><div className="skel" style={{ height: 224, borderRadius: 16 }} /></> : <>
        <div className="rw-claim">
          <div><h2>Claimable Balance</h2><p>Fee share rewards accrue to your claimable balance every 24 hours. Once claimed, your reward amount will be added to your cross-margin account balance.</p></div>
          <button className={'rw-claimbtn' + (claimable >= 0.01 ? ' ok' : '')} title={claimable >= 0.01 ? undefined : 'Nothing to claim yet: the rebate builds up daily'} onClick={() => say(claimable >= 0.01 ? 'Rewards claimed' : 'Nothing to claim yet', claimable >= 0.01 ? 'ok' : 'err')}>Claim {fmt(claimable)} USDC</button>
        </div>
        <div className="rw-tail">
          <h2>Tailwind Rewards</h2>
          <div className="rw-tcols">
            <div className="rw-in">
              <h3>Earn 10% Funding Rebate</h3>
              <div className="rw-bul"><i />Receive 10% funding rate back on eligible market trades</div>
              <div className="rw-bul"><i />Rewards are accrued and paid out daily in Claimable Balance</div>
              <div className="rw-box"><b><CalendarDays size={16} />Day {dayN}</b>Next rewards payout in: <PayoutText /></div>
              <div className="rw-box mk">Eligible Markets<b>Bitcoin, Ethereum, Hyperliquid, Solana</b></div>
            </div>
            <div className="rw-in rw-ch">
              <div className="hd"><span>Total earned · {md(start)} – {new Date(todayMid.getTime() - DAY).getDate()}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}><div className="big">{fmt(claimable)}<small>USDC</small></div>
                <div className="rw-leg" style={{ marginTop: 6, color: 'hsl(var(--muted-foreground))', font: '400 12px/16px var(--font)' }}><span><i style={{ background: 'hsl(var(--phoenix))' }} />Earnings</span><span><i style={{ background: 'hsl(var(--muted-foreground)/.6)' }} />Funding Paid</span></div></div>
              <div className="rw-svgw">
                <svg viewBox="0 0 640 240" preserveAspectRatio="none" width="100%" height="100%" style={{ overflow: 'visible' }}>
                  {yT.map(v => { const y = 200 - (v / yMax) * 180; return <g key={v}><line x1="36" x2="640" y1={y} y2={y} stroke="hsl(218 23% 23%)" strokeOpacity=".5" /><text x="26" y={y + 4} textAnchor="end" vectorEffect="non-scaling-stroke">{v === 0 ? '0' : +v.toFixed(3)}</text></g> })}
                  {days.map((d, i) => { const cx = 36 + 20 + i * ((640 - 36 - 40) / 9), last = i === 9; return <text key={d} x={cx} y={226} textAnchor="middle">{md(d)}{last ? ' ' : ''}{last && <tspan fill="hsl(27 96% 61%)">•</tspan>}</text> })}
                  {(() => { const i = days.findIndex(d => d >= start), cx = 36 + 20 + i * ((640 - 36 - 40) / 9) - 18; return <g><line x1={cx} x2={cx} y1="30" y2="200" stroke="hsl(27 96% 61%)" strokeDasharray="3 3" /><rect x={cx + 0} y="12" width="62" height="16" rx="2" fill="hsl(27 60% 24%)" /><text x={cx + 31} y="24" textAnchor="middle" style={{ fill: 'hsl(27 96% 61%)', fontSize: 10 }}>Rewards start</text></g> })()}
                  {claimable > 0 && v2 ? days.map((d, i) => i >= startIdx && i < 9 ? <rect key={d} x={36 + 14 + i * ((640 - 36 - 40) / 9)} width="12" y={200 - (daily / yMax) * 180} height={(daily / yMax) * 180} fill="hsl(27 96% 61%)" opacity={0.85} rx="2" /> : null) : claimable > 0 ? days.map((d, i) => <rect key={d} x={36 + 14 + i * ((640 - 36 - 40) / 9)} width="12" y={200 - Math.min(180, claimable * 8)} height={Math.min(180, claimable * 8)} fill="hsl(27 96% 61%)" opacity={0.8} />) : <path d="M600 199.5H636" stroke="hsl(215 25% 65%)" strokeOpacity=".7" strokeDasharray="2 2" />}
                </svg>
              </div>
            </div>
          </div>
        </div>
        <div className="rw-ref">
          <div>
            {v2 && unlocked ? <>
              <h2>Referrals unlocked <Unlock size={16} /></h2>
              <p>You passed $10,000 lifetime volume, so your referral code is live. Share it to earn 20% of your referees&apos; fees.</p>
              <div className="rw-code"><span>Your referral code</span><b className="num">{('PHX-' + acct.addr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).slice(0, 12)}</b><button onClick={() => { try { void navigator.clipboard?.writeText(('PHX-' + acct.addr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).slice(0, 12)) } catch { /* ignore */ } say('Referral code copied') }}><Copy size={13} />Copy</button></div>
              <div className="rw-prog">Lifetime volume <b>${fmt(vol, 0)}</b><span className="muted"> · qualified at $10,000</span></div>
            </> : <>
            <h2>Unlock Referrals {unlocked ? <Unlock size={16} /> : <Lock size={16} />}</h2>
            <p>Trade $10,000 on Phoenix to unlock your personal referral code and earn 20% fee share.</p>
            <div className="rw-prog">Current <b>${fmt(vol, 0)}</b><div className="rw-pbar"><span className="t" style={{ display: 'none' }} /><div className="t"><i style={{ width: pr + '%' }} /></div><span>$10,000 Volume</span></div></div>
            </>}
          </div>
          <div className="rw-q">Qualification<b>$10K Lifetime Volume</b>
            {[['20% Fee Share', 'Earn on every trade'], ['10% Referee Discount', 'For your referrals'], ['$100M Volume Cap', 'Per referee ($1,000 max reward)']].map(([a, b]) => <div className="rw-qi" key={a}>{unlocked ? <Unlock size={16} /> : <Lock size={16} />}<div>{a}<span>{b}</span></div></div>)}
          </div>
        </div>
      </>}
    </div></div>
  )
}

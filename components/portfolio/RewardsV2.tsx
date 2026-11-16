'use client'
// Rewards, redesigned (v2). Three jobs, in order of what a trader cares about:
//   1. What can I claim right now, and when is the next payout?   (big number + one orange button)
//   2. Where do I earn it, and how do I earn more?                (activity heatmap + eligible markets with Trade buttons)
//   3. What do I get for bringing someone?                        (big numbers, the code, the qualification)
import { memo, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Copy, Lock } from 'lucide-react'
import { useApp } from '@/lib/store'
import { fmt } from '@/lib/data'
import { Logo } from '../trade/MarketStats'
import { E } from '@/lib/sim'

const DAY = 864e5
const MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MARKETS: [string, string][] = [['BTC', 'Bitcoin'], ['ETH', 'Ethereum'], ['HYPE', 'Hyperliquid'], ['SOL', 'Solana']]
const WEEKS = 12

// a dotted-underlined term with a hover / focus explanation
const Tip = ({ t, children }: { t: string; children: React.ReactNode }) => <span className="rw2-tip" tabIndex={0} data-tip={t}>{children}</span>

// a dotted term that opens a rich card (hover or focus)
const RichTip = ({ trigger, children, up }: { trigger: React.ReactNode; children: React.ReactNode; up?: boolean }) => <span className={'rw2-rt' + (up ? ' up' : '')} tabIndex={0}><span className="rw2-tip plain">{trigger}</span><span className="rw2-pop" role="tooltip">{children}</span></span>

// time to the next payout (local midnight). Only these small components tick every second, not the whole page.
const clock = () => { const t = new Date(); const next = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1).getTime() - t.getTime(); return { hh: Math.floor(next / 36e5), mm: Math.floor((next % 36e5) / 6e4), ss: Math.floor((next % 6e4) / 1e3) } }
const useClock = () => { const [c, setC] = useState(clock); useEffect(() => { const id = setInterval(() => setC(clock()), 1000); return () => clearInterval(id) }, []); return c }
const pad = (n: number) => String(n).padStart(2, '0')
export function PayoutText() { const { hh, mm, ss } = useClock(); return <>{hh}h {mm}m {ss}s</> }
function PayoutTimer() { const { hh, mm, ss } = useClock(); return <div className="rw2-cta timer num" role="timer" title="Time until the next daily payout" aria-label={`Next payout in ${pad(hh)} hours ${pad(mm)} minutes ${pad(ss)} seconds`}>{pad(hh)}:{pad(mm)}:{pad(ss)}</div> }
const copyText = (t: string) => { try { void navigator.clipboard?.writeText(t) } catch { /* clipboard may be blocked: the toast still confirms the action */ } }

type P = { start: number; todayMid: number; vol: number; ghost?: boolean }

export default memo(function RewardsV2({ start, todayMid, vol, ghost }: P) {
  const { acct, say, set } = useApp()
  // claiming moves the balance into the account; until the next payout the claim box shows only the countdown
  const [claimed, setClaimed] = useState(0)
  useEffect(() => { try { setClaimed(parseFloat(localStorage.getItem('phx-rw-claimed') || '0') || 0) } catch { /* ignore */ } }, [])
  // rebate per day = 10% of the funding paid that day on the eligible markets. Finished days are paid out; today is still accruing.
  // Computed once per change of the underlying funding / fills, not on every 500ms price tick.
  const posKey = acct.positions.map(p => p.sym).join(',')
  const d = useMemo(() => {
    const dayVal = (t0: number) => acct.fund.filter(f => ['BTC', 'ETH', 'HYPE', 'SOL'].includes(f.sym) && f.amount < 0 && f.t >= t0 && f.t < t0 + DAY).reduce((a, f) => a - f.amount, 0) * 0.1
    const nDays = Math.max(0, Math.round((todayMid - start) / DAY))
    const paidDays = Array.from({ length: nDays }, (_, i) => dayVal(start + i * DAY))
    const earned = paidDays.reduce((a, b) => a + b, 0), paid = earned / 0.1
    const accruing = dayVal(todayMid)
    // the same maths per market: rebate earned (finished days), earning today, and what you traded there since rewards began
    const mkt = MARKETS.map(([sym, name]) => {
      const paidM = acct.fund.filter(f => f.sym === sym && f.amount < 0 && f.t >= start && f.t < todayMid).reduce((a, f) => a - f.amount, 0)
      const todayM = acct.fund.filter(f => f.sym === sym && f.amount < 0 && f.t >= todayMid).reduce((a, f) => a - f.amount, 0) * 0.1
      const traded = acct.fills.filter(f => f.sym === sym && f.t >= start).reduce((a, f) => a + f.size * f.price, 0)
      const open = posKey.split(',').includes(sym) ? 1 : 0
      return { sym, name, paid: paidM, rebate: paidM * 0.1, today: todayM, traded, open }
    })
    // activity grid: WEEKS columns x 7 rows, the last cell is today; days since the programme began show their earnings
    const todayDow = new Date(todayMid).getDay()
    const cells: { t: number; v: number; future: boolean }[][] = []
    for (let w = 0; w < WEEKS; w++) {
      const col: { t: number; v: number; future: boolean }[] = []
      for (let dd = 0; dd < 7; dd++) {
        const t = todayMid - ((WEEKS - 1 - w) * 7 + (todayDow - dd)) * DAY
        col.push({ t, v: t >= start && t < todayMid ? dayVal(t) : t === todayMid ? accruing : 0, future: t > todayMid })
      }
      cells.push(col)
    }
    const monthLabels = cells.map((c, i) => { const m = new Date(c[0].t).getMonth(); return i === 0 || m !== new Date(cells[i - 1][0].t).getMonth() ? MO[m] : '' })
    const active = cells.flat().filter(c => c.v > 0 && c.t < todayMid).length
    const vmax = Math.max(1e-9, ...cells.flat().map(c => c.v))
    return { earned, paid, accruing, mkt, cells, monthLabels, active, vmax }
  }, [acct.fund, acct.fund.length, acct.fills, acct.fills.length, posKey, todayMid, start])
  const { earned, paid, accruing, mkt, cells, monthLabels, active, vmax } = d
  const rebateTotal = mkt.reduce((a, m) => a + m.rebate, 0), todayTotal = mkt.reduce((a, m) => a + m.today, 0)
  const ranked = [...mkt].sort((a, b) => b.rebate + b.today - (a.rebate + a.today))
  const topM = ranked[0], lows = ranked.slice(-2).map(m => m.name)
  const hint = rebateTotal + todayTotal <= 0 ? 'Trade these markets to start earning the rebate.' : `Most of your rebate comes from ${topM.name}. ${lows[0]} and ${lows[1]} earn the least, so trading them more adds the most.`
  const breakdown = (
    <>
      <b className="pt">Rebate by market</b>
      <span className="pg"><i /><span>Market</span><span>Funding paid</span><span>Rebate</span><span>Today</span><span>Traded</span></span>
      {mkt.map(m => (
        <span className="pr" key={m.sym}>
          <Logo sym={m.sym} size={20} /><span className="pn">{m.name}<em>{m.sym}</em></span>
          <span className="num">${fmt(m.paid)}</span>
          <span className="num rb">{fmt(m.rebate, 3)}<i style={{ width: (rebateTotal > 0 ? (m.rebate / rebateTotal) * 100 : 0) + '%' }} /></span>
          <span className="num">{m.today > 0 ? '+' + fmt(m.today, 3) : '–'}</span>
          <span className="num">{m.traded + m.open > 0 ? '$' + fmt(m.traded, 0) : '–'}</span>
        </span>
      ))}
      <span className="pr tot"><i /><span className="pn">All four</span><span className="num">${fmt(mkt.reduce((a, m) => a + m.paid, 0))}</span><span className="num">{fmt(rebateTotal, 3)}</span><span className="num">{todayTotal > 0 ? '+' + fmt(todayTotal, 3) : '–'}</span><span className="num">${fmt(mkt.reduce((a, m) => a + m.traded, 0), 0)}</span></span>
      <span className="ph">{hint}</span>
    </>
  )
  const claimable = Math.max(0, earned - claimed)
  const router = useRouter()
  const unlocked = vol >= 10000, pr = Math.min(100, (vol / 10000) * 100), left = Math.max(0, 10000 - vol)
  const code = ('PHX-' + acct.addr.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()).slice(0, 12)
  const go = (s: string) => { set({ sym: s }); router.push('/' + s) }
  const ready = claimable >= 0.01
  const claim = () => {
    if (!ready) return
    E.collateral += claimable; E.note('Rewards Claimed', `${fmt(claimable)} USDC added to your account balance`)
    const total = claimed + claimable; setClaimed(total); try { localStorage.setItem('phx-rw-claimed', String(total)) } catch { /* ignore */ }
    say('Rewards claimed')
  }
  return (
    <div className="rw-page"><div className={'rw2' + (ghost ? ' ghosted' : '')} aria-busy={ghost || undefined}>
      <div className="rw2-lc">

      {/* 1. what you can claim now */}
      <section className="rw2-hero">
        <div className="rw2-claim">
          <span className="eb">Claimable balance</span>
          <div className="rw2-big num">{fmt(claimable)}<small>USDC</small></div>
          <p>This is the <Tip t="Funding rebate: Phoenix gives back 10% of the funding you pay on the eligible markets (Bitcoin, Ethereum, Hyperliquid and Solana). It builds up daily and is paid out at the next payout.">10%</Tip> funding rebate on the <RichTip trigger={<b className="num">${fmt(paid)}</b>}>{breakdown}</RichTip> of funding you paid on the eligible markets. It is added to your cross-margin balance when you claim.</p>
        </div>
        {ready ? <button className="rw2-cta" onClick={claim}>Claim {fmt(claimable)} USDC</button> : <PayoutTimer />}
      </section>

      {/* 2. where you earn it */}
      <div className="rw2-two">
        <section className="rw2-card">
          <div className="rw2-h"><h2>Tailwind rewards</h2><span>Your rebate, paid out daily</span></div>
          <div className="rw2-heat" role="img" aria-label={`Daily rewards for the last ${WEEKS} weeks. ${active} days earned.`}>
            <div className="rw2-mo" style={{ gridTemplateColumns: `28px repeat(${WEEKS},1fr)` }}><i />{monthLabels.map((m, i) => <span key={i}>{m}</span>)}</div>
            <div className="rw2-gr">
              <div className="rw2-dl"><span /><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /></div>
              <div className="rw2-cols" style={{ gridTemplateColumns: `repeat(${WEEKS},1fr)` }}>
                {cells.map((col, w) => <div key={w} className="rw2-col">{col.map(c => (
                  <i key={c.t} className={'rw2-c' + (c.future ? ' f' : c.v > 0 ? ' on' : '') + (c.t === todayMid ? ' today' : '')} style={c.v > 0 ? { background: `hsl(var(--phoenix)/${(0.3 + 0.6 * (c.v / vmax)).toFixed(2)})` } : undefined} title={c.future ? '' : `${MO[new Date(c.t).getMonth()]} ${new Date(c.t).getDate()}: ${c.v > 0 ? '+' + fmt(c.v, 3) + ' USDC' + (c.t === todayMid ? ' so far (paid out at the next payout)' : '') : 'no rewards'}`} />
                ))}</div>)}
              </div>
            </div>
            <div className="rw2-lg"><span>Rewards began {MO[new Date(start).getMonth()]} {new Date(start).getDate()}</span><span className="sc">Less<i /><i className="a" /><i className="b" /><i className="c" />More</span></div>
          </div>
          <div className="rw2-stats3">
            <div><b className="num">{active}</b><span>Days with rewards</span></div>
            <div><b className="num">{fmt(accruing, 3)}</b><span><RichTip up trigger="Accruing today">{breakdown}</RichTip></span></div>
          </div>
          <p className="rw2-note">The rebate is paid out once a day, based on the funding you paid that day. Today&apos;s amount keeps building until the next payout.</p>
        </section>

        <section className="rw2-card">
          <div className="rw2-h"><h2>Eligible markets</h2><span>Trade these to earn the rebate</span></div>
          <div className="rw2-mk">
            {MARKETS.map(([s, n]) => (
              <button key={s} className="rw2-m" onClick={() => go(s)} aria-label={`Trade ${n}`} title={`Open the ${s}-PERP market`}>
                <Logo sym={s} size={36} />
                <span className="nm"><b>{n}</b><em>{s}-PERP</em></span>
                <span className="go">Trade<ArrowRight size={14} /></span>
              </button>
            ))}
          </div>
          <p className="rw2-note">Funding you pay on these four markets earns the rebate. Other markets do not count.</p>
        </section>
      </div>
      </div>

      {/* 3. referrals (right column, always in view): top = unlock / your code, bottom = what you get */}
      <aside className="rw2-rcol" aria-label="Referrals">
        <section className={'rw2-rbox rw2-un' + (unlocked ? ' on' : '')}>
          <span className="eb">Referrals</span>
          {unlocked ? <>
            <h2>Your referral code</h2>
            <div className="rw2-code"><div><span>Share this code</span><b className="num">{code}</b></div></div>
            <div className="rw2-cb">
              <button onClick={() => { copyText(code); say('Referral code copied') }}><Copy size={14} />Copy code</button>
              <button className="sec" onClick={() => { copyText('https://phoenix.trade/?ref=' + code); say('Invite link copied') }}><Copy size={14} />Copy invite link</button>
            </div>
            <p className="ok"><Check size={14} /><span>Unlocked at $10,000 lifetime volume. Yours: <b className="num">${fmt(vol, 0)}</b></span></p>
          </> : <>
            <h2>Unlock your referral code</h2>
            <div className="rw2-pg">
              <div className="t num"><span>Lifetime volume</span><span><b>${fmt(vol, 0)}</b> / $10,000</span></div>
              <div className="bar" role="progressbar" aria-valuenow={Math.round(pr)} aria-valuemin={0} aria-valuemax={100} aria-label="Progress to $10,000 lifetime volume"><i style={{ width: Math.max(2, pr) + '%' }} /></div>
              <p className="num">Trade <b>${fmt(left, 0)}</b> more to unlock</p>
            </div>
            <div className="rw2-lk">
              <span className="ic" aria-hidden><Lock size={16} /></span>
              <span className="tx"><b>Your code is locked</b><span>It appears here at $10,000</span></span>
              <button onClick={() => go('SOL')}>Trade<ArrowRight size={14} /></button>
            </div>
          </>}
        </section>

        <section className="rw2-rbox rw2-get">
          <div className="rw2-h"><h2>What you get</h2><span>For every trader who joins with your code</span></div>
          <ul className="rw2-gl">
            <li><b className="num a">20%</b><span><strong>of every fee your referees pay</strong>Paid to you on each trade they make</span></li>
            <li><b className="num">10%</b><span><strong>fee discount for people you refer</strong>They pay less, you still earn your share</span></li>
            <li><b className="num">$1,000</b><span><strong>maximum reward per referee</strong>Counted on up to $100M of their volume</span></li>
          </ul>
        </section>
      </aside>
    </div></div>
  )
})

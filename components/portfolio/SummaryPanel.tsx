'use client'
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Account } from '@/lib/account'
import { usd, fmt } from '@/lib/data'
import { useApp } from '@/lib/store'

const sg = (n: number) => Math.abs(n) < 0.005 ? '$0.00' : (n < 0 ? '-$' : '+$') + fmt(Math.abs(n))
const col = (n: number) => (Math.abs(n) < 0.005 ? '' : n < 0 ? 'sell' : 'buy')

export default function SummaryPanel({ a }: { a: Account }) {
  const [open, setOpen] = useState(false)
  const { v2 } = useApp()
  const S = ({ l, v, u, big, cls }: { l: string; v: string; u?: boolean; big?: boolean; cls?: string }) => <div className={'pf-stat' + (big ? ' big' : '')}><label className={u ? 'u' : ''}>{l}</label><div className={cls}>{v}</div></div>
  if (v2) {
    // v2: three tiers. What matters now (big), the margin picture (list), lifetime totals (quiet list)
    const L = ({ l, v, cls }: { l: string; v: string; cls?: string }) => <div className="pf2-r"><span>{l}</span><b className={cls}>{v}</b></div>
    return (
      <div className="pf2">
        <div className="pf2-hero">
          <div><span>Unrealised PnL</span><b className={col(a.upnl)}>{sg(a.upnl)}</b></div>
          <div><span>Available cash</span><b>{usd(a.available)}</b></div>
          <div><span>Total exposure</span><b>{usd(a.exposure)}</b></div>
        </div>
        <h4>Margin</h4>
        <div className="pf2-l"><L l="Collateral balance" v={usd(a.collateral)} /><L l="Isolated collateral" v={usd(a.isolated)} /><L l="Cross initial margin" v={usd(a.initMargin)} /><L l="Cross maintenance margin" v={usd(a.maintMargin)} /></div>
        <h4>Lifetime</h4>
        <div className="pf2-l two"><L l="Realised PnL" v={sg(a.realized)} cls={col(a.realized)} /><L l="Total funding" v={sg(a.funding)} cls={col(a.funding)} /><L l="Trading fees" v={(a.fees < 0 ? '-$' : '$') + fmt(Math.abs(a.fees))} cls={col(a.fees)} /><L l="Total deposited" v={usd(a.deposited)} /><L l="Total withdrawn" v={usd(a.withdrawn)} /><L l="Total traded" v={usd(a.traded)} /></div>
      </div>
    )
  }
  return (
    <>
      <div className="pf-grid pf-g2"><S big u l="Total Exposure" v={usd(a.exposure)} /><S big u l="Available Cash" v={usd(a.available)} /></div>
      <div className="pf-grid" style={{ marginTop: 13 }}>
        <button className="pf-row" onClick={() => setOpen(o => !o)}><span>Collateral Balance</span><b>{usd(a.collateral)}<ChevronDown size={12} className="muted pf-chev" style={{ transform: open ? 'rotate(-180deg)' : undefined }} /></b></button>
        {open && <div className="pf-alloc pf-row animate-slide-down" style={{ height: 'auto', flexDirection: 'column', alignItems: 'stretch', gap: 6, padding: '10px 12px', fontWeight: 400 }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><span>USDC</span><span>{usd(a.collateral)}</span></div></div>}
        <div className="pf-row"><span>Isolated Collateral</span><b style={{ paddingRight: 21 }}>{usd(a.isolated)}</b></div>
      </div>
      <div className="pf-grid pf-g3" style={{ marginTop: 13 }}>
        <S l="Unrealized PnL" v={sg(a.upnl)} cls={col(a.upnl)} /><S u l="Cross Initial Margin" v={usd(a.initMargin)} /><S u l="Cross Maint. Margin" v={usd(a.maintMargin)} />
      </div>
      <div className="pf-sub">Trading Totals</div>
      <div className="pf-grid pf-g3">
        <S l="Realized PnL" v={sg(a.realized)} cls={col(a.realized)} /><S u l="Total Funding" v={sg(a.funding)} cls={col(a.funding)} /><S l="Trading Fees" v={(a.fees < 0 ? '-$' : '$') + fmt(Math.abs(a.fees))} cls={col(a.fees)} />
        <S u l="Total Deposited" v={usd(a.deposited)} /><S u l="Total Withdrawn" v={usd(a.withdrawn)} /><S u l="Total Traded" v={usd(a.traded)} />
      </div>
    </>
  )
}

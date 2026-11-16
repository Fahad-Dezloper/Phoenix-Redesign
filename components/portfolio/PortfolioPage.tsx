'use client'
import { useState } from 'react'
import { useApp } from '@/lib/store'
import { fmt } from '@/lib/data'
import PositionsPanel from '@/components/trade/PositionsPanel'
import ValueChart, { ChartSkel, RANGES, seriesSummary, type ChartTab, type Range } from './ValueChart'
import SummaryPanel from './SummaryPanel'
import AccountHealth from './AccountHealth'
import Breakdown from './Breakdown'
import './portfolio.css'

export function Gate({ title, text }: { title: string; text: string }) {
  const { openDialog } = useApp()
  return (
    <div className="pf-gate"><h1>{title}</h1><p>{text}</p><button className="btn pri" onClick={() => openDialog('login')}>Start Trading</button></div>
  )
}

export default function PortfolioPage() {
  const { signedIn, ghost, acct, loading } = useApp()
  const [tab, setTab] = useState<ChartTab>('Value')
  const [range, setRange] = useState<Range>('1 Week')
  const [side, setSide] = useState<'Summary' | 'Account Health' | 'Breakdown'>('Summary')
  const active = signedIn || !!ghost
  if (!active) return <div className="pf-gatewrap"><Gate title="Connect your wallet to view your portfolio" text="Portfolio balances, performance, and trading activity appear here once a wallet is connected." /></div>
  const ranges: readonly Range[] = tab === 'Daily PnL' ? RANGES.filter(r => r !== '1 Day') : RANGES
  const r: Range = ranges.includes(range) ? range : '1 Week'
  const sum = seriesSummary(acct, tab, r)
  const loadingA = loading.acct
  return (
    <div className="pf-page">
      <div className="pf-top">
        <div className="pf-card pf-chartcard">
          <div className="pf-tabs" role="tablist" aria-label="Chart">{(['Value', 'Cumulative PnL', 'Daily PnL'] as ChartTab[]).map(t => <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
          <div className="pf-bar">
            <div className="pf-ranges" role="tablist" aria-label="Period">{ranges.map(x => <button key={x} role="tab" aria-selected={x === r} className={x === r ? 'on' : ''} onClick={() => setRange(x)}>{x}</button>)}</div>
            {loadingA ? <div className="skel" style={{ width: 180, height: 24 }} aria-hidden /> : tab !== 'Daily PnL' && (
              <div className="pf-big"><span>{tab === 'Value' ? '$' + fmt(sum.total) : (sum.total < 0 ? '-$' : '$') + fmt(Math.abs(sum.total))}</span><small className={sum.delta < 0 ? 'sell' : 'buy'}>{(sum.delta < 0 ? '-$' : '+$') + fmt(Math.abs(sum.delta))}</small></div>
            )}
          </div>
          {loadingA ? <ChartSkel /> : <ValueChart acct={acct} tab={tab} range={r} />}
        </div>
        <div className="pf-card pf-side">
          <div className="pf-stabs" role="tablist" aria-label="Account">{(['Summary', 'Account Health', 'Breakdown'] as const).map(t => <button key={t} role="tab" aria-selected={t === side} className={t === side ? 'on' : ''} onClick={() => setSide(t)}>{t}</button>)}</div>
          {/* while loading, the real panel is drawn as grey blocks (same markup, so nothing moves when the numbers arrive) */}
          <div className={loadingA ? 'pf-ghosted' : undefined} aria-busy={loadingA || undefined}>
            {side === 'Summary' ? <SummaryPanel a={acct} /> : side === 'Account Health' ? <AccountHealth a={acct} /> : <Breakdown a={acct} />}
          </div>
        </div>
      </div>
      <div className="pf-bottom"><PositionsPanel extraTabs={['Deposits & Withdrawals']} /></div>
    </div>
  )
}

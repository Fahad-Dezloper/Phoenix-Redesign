'use client'
import { useState } from 'react'
import { ChevronDown, HeartPulse } from 'lucide-react'
import type { Account } from '@/lib/account'
import { usd } from '@/lib/data'

export default function AccountHealth({ a }: { a: Account }) {
  const [open, setOpen] = useState(false)
  const h = Math.round(a.health), st = h >= 60 ? { c: 'hsl(var(--buy))', t: 'Healthy' } : h >= 30 ? { c: 'hsl(40 95% 58%)', t: 'At Risk' } : { c: 'hsl(var(--sell))', t: 'Danger' }
  return (
    <>
      <div className="pf-desc">Health of each of your positions based on liquidation risk</div>
      <button className="pf-row" onClick={() => setOpen(o => !o)}><span>Allocation</span><b>{usd(a.equity)}<ChevronDown size={12} className="muted" style={{ transform: open ? 'rotate(180deg)' : undefined }} /></b></button>
      {open && <div className="pf-alloc">{[['Collateral', a.collateral], ['Unrealized PnL', a.upnl], ...a.positions.map(p => [p.sym + ' ' + p.side, p.margin] as [string, number])].map(([l, v]) => <div key={l as string}><span className="muted">{l}</span><span>{usd(v as number)}</span></div>)}</div>}
      <div className="pf-health">
        <span className="tag">Cross</span>
        <span className="bar"><i style={{ width: h + '%', background: st.c }} /></span>
        <span className="val" style={{ color: st.c }}>{h}% <HeartPulse size={12} /> {st.t}</span>
      </div>
    </>
  )
}

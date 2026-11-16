'use client'
import type { Account } from '@/lib/account'
import { usd, fmt } from '@/lib/data'

const k = (n: number) => (n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(2) + 'K' : '$' + fmt(n))
const GREENS = ['hsl(142 69% 52%)', 'hsl(142 50% 40%)', 'hsl(160 55% 45%)'], REDS = ['hsl(0 90% 66%)', 'hsl(0 65% 52%)', 'hsl(14 80% 58%)']

export default function Breakdown({ a }: { a: Account }) {
  const total = a.positions.reduce((s, p) => s + p.value, 0)
  const lg = a.positions.filter(p => p.side === 'Long').reduce((s, p) => s + p.value, 0), sh = total - lg
  const pc = (v: number) => (total ? Math.round((v / total) * 100) : 0)
  let li = 0, si = 0
  const segs = a.positions.map(p => ({ ...p, color: p.side === 'Long' ? GREENS[li++ % 3] : REDS[si++ % 3], f: total ? p.value / total : 0 }))
  const R = 70, T = 30, C = 2 * Math.PI * (R - T / 2)
  let off = 0
  return (
    <>
      <div className="pf-bd">
        <div style={{ position: 'relative', width: 160, height: 160, flex: 'none' }}>
          <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="80" cy="80" r={R - T / 2} fill="none" stroke="hsl(234 10% 23%)" strokeWidth={T} />
            {segs.map(s => { const len = s.f * C, el = <circle key={s.sym + s.side} cx="80" cy="80" r={R - T / 2} fill="none" stroke={s.color} strokeWidth={T} strokeDasharray={`${Math.max(0, len - (segs.length > 1 ? 2 : 0))} ${C}`} strokeDashoffset={-off} />; off += len; return el })}
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', font: '400 12px/16px var(--font)', color: 'hsl(var(--muted-foreground))' }}><div>Total<br />{usd(total)}</div></div>
        </div>
        <div className="pf-bdr">
          <div><span className="chip buy">Long</span><span>{usd(lg)}<span className="buy" style={{ marginLeft: 10 }}>{pc(lg)}%</span></span></div>
          <div><span className="chip sell">Short</span><span>{k(sh)}<span className="sell" style={{ marginLeft: 10 }}>{pc(sh)}%</span></span></div>
        </div>
      </div>
      {segs.map(s => (
        <div className="pf-bdrow" key={s.sym + s.side}>
          <span className="d" style={{ background: s.color }} /><span className={'chip ' + (s.side === 'Long' ? 'buy' : 'sell')}>{s.side}</span>{s.sym}
          <span className="r"><span>{k(s.value)}</span><span className={s.side === 'Long' ? 'buy' : 'sell'}>{pc(s.value)}%</span></span>
        </div>
      ))}
    </>
  )
}

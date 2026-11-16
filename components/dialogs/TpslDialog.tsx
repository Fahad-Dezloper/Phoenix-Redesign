'use client'
import { useEffect, useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { fmt, price as fp, sgn } from '@/lib/data'
import { useApp } from '@/lib/store'
import { Modal } from './ConfirmDialog'

export default function TpslDialog() {
  const app = useApp()
  const sym = app.dialogArg, p = app.acct.positions.find(x => x.sym === sym)
  const [tab, setTab] = useState<'tp' | 'sl'>('tp'), [tp, setTp] = useState(''), [sl, setSl] = useState('')
  useEffect(() => { if (app.dialog === 'tpsl') { setTab('tp'); setTp(p?.tp ? String(p.tp) : ''); setSl(p?.sl ? String(p.sl) : '') } }, [app.dialog]) // eslint-disable-line react-hooks/exhaustive-deps
  if (app.dialog !== 'tpsl') return null
  if (!p) return <Modal title="Edit Take Profit & Stop Loss" onClose={app.closeDialog}><div className="empty" style={{ height: 120 }}>{sym ? `No open position in ${sym}.` : "No open position."}</div></Modal>
  const dec = app.market.dec, long = p.side === 'Long', v = tab === 'tp' ? tp : sl, setV = tab === 'tp' ? setTp : setSl
  const px = parseFloat(v), pnl = px ? (px - p.entry) * p.size * (long ? 1 : -1) : 0
  const num = (s: string) => /^\d*\.?\d*$/.test(s)
  const bad = !!((parseFloat(tp) && (long ? parseFloat(tp) <= p.mark : parseFloat(tp) >= p.mark)) || (parseFloat(sl) && (long ? parseFloat(sl) >= p.mark : parseFloat(sl) <= p.mark)))
  return (
    <Modal title="Edit Take Profit & Stop Loss" onClose={app.closeDialog} wide>
      <div className="t-ca">
        <div className="p"><span style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span className={`chip ${long ? 'buy' : 'sell'}`}>{p.side}</span>{fmt(p.size, 3)} {sym} <span className="muted">•</span> ${fp(p.entry, dec)}</span><span className={`num ${p.upnl >= 0 ? 'buy' : 'sell'}`}>{sgn(p.upnl)}</span></div>
        <div className="t-tabs2"><button className={tab === 'tp' ? 'on' : ''} onClick={() => setTab('tp')}>Take Profit</button><button className={tab === 'sl' ? 'on' : ''} onClick={() => setTab('sl')}>Stop Loss</button></div>
        <div className="t-rowf" style={{ marginBottom: 8 }}><span className="t-ar l" style={{ color: 'hsl(var(--foreground))' }}>Market<ChevronDown size={12} /></span><button style={{ marginLeft: 'auto', color: 'hsl(var(--muted-foreground))' }} onClick={() => setV('')} aria-label="Clear"><Trash2 size={16} /></button></div>
        <div className="t-rowf" style={{ marginBottom: 6 }}><span className="l">Trigger Price</span><span className="muted">$</span><input inputMode="decimal" placeholder="0" value={v} onChange={e => num(e.target.value) && setV(e.target.value)} style={{ maxWidth: 160 }} /></div>
        <div className="muted num" style={{ textAlign: 'right', fontSize: 12, marginBottom: 14 }}>{px ? `Est. PnL: ${sgn(pnl)}` : 'Est. PnL: -'}</div>
      </div>
      <div className="t-box2 num">
        <div className="r"><span>Mark Price</span><b>${fp(p.mark, dec)}</b></div>
        <div className="r"><span>Liquidation Price</span><b>${fp(p.liq, dec)}</b></div>
        <div className="r"><span>Take Profit</span><b>{parseFloat(tp) ? `$${fp(parseFloat(tp), dec)}` : 'None'}</b></div>
        <div className="r"><span>Stop Loss</span><b>{parseFloat(sl) ? `$${fp(parseFloat(sl), dec)}` : 'None'}</b></div>
      </div>
      {bad && <div className="sell" style={{ fontSize: 12, marginTop: 10 }}>Trigger prices must be on the correct side of the mark price.</div>}
      <button className="cta sec" style={{ marginTop: 16 }} disabled={!!bad} onClick={() => { app.setTpsl(sym, parseFloat(tp) || undefined, parseFloat(sl) || undefined); app.closeDialog() }}>Confirm</button>
    </Modal>
  )
}

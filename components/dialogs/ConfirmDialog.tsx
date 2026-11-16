'use client'
import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { fmt, price as fp, usd } from '@/lib/data'
import { useApp } from '@/lib/store'
import { useOrderCalc } from '../trade/OrderForm'
import '../trade/trade.css'

export function Modal({ title, children, onClose, wide }: { title: string; children: React.ReactNode; onClose: () => void; wide?: boolean }) {
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal t-dlg" role="dialog" aria-label={title} style={wide ? { width: 'min(480px,calc(100vw - 32px))' } : undefined}>
        <div className="mhd"><h3>{title}</h3><button className="xbtn" onClick={onClose} aria-label="Close"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  )
}

export default function ConfirmDialog() {
  const app = useApp()
  const c = useOrderCalc()
  const [dont, setDont] = useState(false)
  if (app.dialog !== 'confirm') return null
  const f = app.form, long = f.side === 'Long'
  const label = f.kind === 'Market' ? '' : ` ${f.kind}`
  const go = () => { if (dont) app.set({ settings: { ...app.settings, confirmOrders: false } }); app.place() }
  return (
    <Modal title="Confirm Order" onClose={app.closeDialog}>
      <div className="sumline"><span className={`chip ${long ? 'buy' : 'sell'}`}>{f.side}</span><span>{fmt(c.base || 0.04, c.bd)} {c.sym} at ${fp(c.px, c.market.dec)}</span>{label && <span className="muted" style={{ fontSize: 13 }}>{label.trim()}</span>}</div>
      <div className="t-box2 num">
        <div className="r"><span>Estimated Liquidation Price</span><b>{c.liq != null && c.liq > 0 ? `$${fp(c.liq, c.market.dec)}` : 'None (no liquidation risk)'}</b></div>
        <div className="r"><span>Expected Price</span><b>${fp(c.px, c.market.dec)}</b></div>
        <div className="r"><span>Order Value</span><b>{usd(c.value)}</b></div>
        <div className="r"><span>Margin Required</span><b>{usd(c.margin)}</b></div>
        <div className="r"><span>Slippage</span><b>Est: {f.kind === 'Market' ? c.slipEst.toFixed(3) + '%' : '-'} / Max: {f.slippage}%</b></div>
        <hr />
        <div className="r"><span>Network Fee</span><b><span className="buy">$0.00</span><span className="t-spons">Sponsored</span></b></div>
        <div className="r"><span>Taker Fee</span><b>{c.feePct.toFixed(3)}%</b></div>
      </div>
      <label className="t-dchk" onClick={() => setDont(d => !d)}><span className={`t-box${dont ? ' on' : ''}`}>{dont && <Check size={10} strokeWidth={3} />}</span>Don&apos;t show this again</label>
      <button className={`cta ${long ? 'buy' : 'sell'}`} onClick={go}>Place Order</button>
    </Modal>
  )
}

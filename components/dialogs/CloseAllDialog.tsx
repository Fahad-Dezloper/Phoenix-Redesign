'use client'
import { sgn, usd } from '@/lib/data'
import { useApp } from '@/lib/store'
import { Modal } from './ConfirmDialog'

export default function CloseAllDialog() {
  const app = useApp()
  if (app.dialog !== 'closeall') return null
  const ps = app.acct.positions, tot = ps.reduce((a, p) => a + p.upnl, 0)
  return (
    <Modal title="Close All Positions" onClose={app.closeDialog}>
      {ps.length === 0 ? <div className="empty" style={{ height: 100 }}>No open positions.</div> : (
        <div className="t-box2 num" style={{ marginBottom: 16 }}>
          {ps.map(p => <div className="r" key={p.sym}><span><span className={p.side === 'Long' ? 'buy' : 'sell'}>{p.side}</span> {p.sym}</span><b>{usd(p.value)} <span className={p.upnl >= 0 ? 'buy' : 'sell'}>{sgn(p.upnl)}</span></b></div>)}
          <hr />
          <div className="r"><span>Estimated Total PnL</span><b className={tot >= 0 ? 'buy' : 'sell'}>{sgn(tot)}</b></div>
          <div className="r"><span>Order Type</span><b>Market</b></div>
          <div className="r"><span>Taker Fee</span><b>0.035%</b></div>
        </div>)}
      <p className="muted" style={{ margin: '0 0 16px', fontSize: 12, lineHeight: '16px' }}>All open positions will be closed at the current market price. Open orders are not affected.</p>
      <button className="cta sec" disabled={ps.length === 0} onClick={app.closeAll}>Close All Positions</button>
    </Modal>
  )
}

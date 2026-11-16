'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChevronDown } from 'lucide-react'
import { fmt, price as fp, usd, sgn } from '@/lib/data'
import { useApp } from '@/lib/store'
import { Modal } from './ConfirmDialog'

export default function CloseDialog() {
  const app = useApp()
  const sym = app.dialogArg, p = app.acct.positions.find(x => x.sym === sym)
  const [frac, setFrac] = useState(1)
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => { if (app.dialog === 'close') setFrac(1) }, [app.dialog])
  if (app.dialog !== 'close') return null
  if (!p) return <Modal title="Close Position" onClose={app.closeDialog}><div className="empty" style={{ height: 120 }}>{sym ? `No open position in ${sym}.` : "No open position."}</div></Modal>
  const q = p.size * frac, dec = app.market.dec
  const set = (e: React.PointerEvent) => { const r = bar.current!.getBoundingClientRect(); setFrac(Math.min(1, Math.max(0.01, (e.clientX - r.left) / r.width))) }
  const pnl = p.upnl * frac, rem = 1 - frac
  const full = frac >= 0.999
  const bd = p.mark >= 1000 ? 5 : p.mark >= 10 ? 3 : 2
  if (app.v2) {
    // v2: one clear question ("how much, and what will I get?"), the result first, details underneath
    const long = p.side === 'Long', fee = q * p.mark * 0.00035, net = pnl - fee, roi = p.margin ? (pnl / (p.margin * frac)) * 100 : 0
    const setFromInput = (v: string) => { const n = parseFloat(v); if (isNaN(n)) return; setFrac(Math.min(1, Math.max(0.01, n / p.size))) }
    const confirm = () => app.closePos(sym, frac)
    return (
      <Modal title={`Close ${sym} position`} onClose={app.closeDialog} wide>
        <div className="cl" onKeyDown={e => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'BUTTON') confirm() }}>
          <div className="cl-pos num"><span className={`chip ${long ? 'buy' : 'sell'}`}>{p.side}</span><b>{fmt(p.size, bd)} {sym}</b><i /><span>Entry <b>${fp(p.entry, dec)}</b></span><i /><span>Mark <b>${fp(p.mark, dec)}</b></span><i /><span>{p.lev.toFixed(1)}x</span></div>
          <div className="cl-sz">
            <div className="cl-qk" role="group" aria-label="Amount to close">{[0.25, 0.5, 0.75, 1].map(f => <button key={f} className={Math.abs(frac - f) < 0.005 ? 'on' : ''} onClick={() => setFrac(f)}>{f === 1 ? 'All' : `${f * 100}%`}</button>)}</div>
            <div className="cl-in"><input aria-label={`Amount of ${sym} to close`} inputMode="decimal" value={q.toFixed(bd)} onChange={e => setFromInput(e.target.value)} /><span>{sym}</span><em className="num">{Math.round(frac * 100)}%</em></div>
          </div>
          <div className="t-dsl" ref={bar} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(e) }} onPointerMove={e => e.buttons === 1 && set(e)}>
            <span className="tr" /><span className="fl" style={{ width: `${frac * 100}%` }} /><span className="kn" style={{ left: `${frac * 100}%` }} />
          </div>
          <div className={`cl-hero num ${pnl >= 0 ? 'buy' : 'sell'}`}><span>You will {pnl >= 0 ? 'realise' : 'lose'}</span><b>{sgn(pnl)}</b><em>({roi >= 0 ? '+' : ''}{roi.toFixed(2)}%)</em></div>
          <div className="t-box2 num cl-sum">
            <div className="r"><span>Position</span><b>{fmt(p.size, bd)} <ArrowRight size={13} /> {full ? <span className="muted">Closed</span> : `${fmt(p.size - q, bd)} ${sym}`}</b></div>
            <div className="r"><span>Margin released</span><b>{usd(p.margin * frac)}</b></div>
            <div className="r"><span>Liquidation price</span><b>{full ? <span className="muted">—</span> : `$${fp(p.liq, dec)}`}</b></div>
            <div className="r"><span>Fee (0.035%)</span><b>{usd(fee)}</b></div>
            <hr />
            <div className="r tot"><span>Net after fee</span><b className={net >= 0 ? 'buy' : 'sell'}>{sgn(net)}</b></div>
          </div>
          <p className="cl-note">Closes at the market price, about ${fp(p.mark, dec)}. Slippage up to {app.form.slippage}%. Network fee sponsored.</p>
          <button className="cta cl-go" onClick={confirm} autoFocus>{full ? `Close position · ${fmt(p.size, bd)} ${sym}` : `Close ${Math.round(frac * 100)}% · ${fmt(q, bd)} ${sym}`}</button>
        </div>
      </Modal>
    )
  }
  return (
    <Modal title="Close Position" onClose={app.closeDialog} wide>
      <div className="t-rowf" style={{ padding: '10px 14px' }}><span className="t-ar l" style={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}>Market<ChevronDown size={12} /></span><span className="l" style={{ marginLeft: 8 }}>Mid Price</span><span className="num" style={{ marginLeft: 'auto', font: '500 18px/24px var(--font)' }}>${fp(p.mark, dec)}</span></div>
      <div className="t-box2 num" style={{ background: 'none', padding: '0 4px' }}>
        <div className="r"><span>Mark Price</span><b>${fp(p.mark, dec)}</b></div>
        <div className="r"><span>Entry Price</span><b>${fp(p.entry, dec)}</b></div>
        <div className="r"><span>Position</span><b><span className={`chip ${p.side === 'Long' ? 'buy' : 'sell'}`}>{p.side}</span><span className={p.side === 'Long' ? 'buy' : 'sell'}>{fmt(p.size, bd)} {sym}</span><ArrowRight size={13} />{full ? 0 : fmt(p.size - q, bd)} {sym}</b></div>
      </div>
      <div className="t-rowf" style={{ marginTop: 8 }}><span className="l">Order Size</span><input readOnly value={fmt(q, bd)} /><span className="chip" style={{ height: 24 }}>{sym}<ChevronDown size={12} /></span></div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
        <div className="t-dsl" ref={bar} onPointerDown={e => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); set(e) }} onPointerMove={e => e.buttons === 1 && set(e)}>
          <span className="tr" /><span className="fl" style={{ width: `${frac * 100}%` }} /><span className="kn" style={{ left: `${frac * 100}%` }} />
        </div>
        <div className="t-pctbox">{Math.round(frac * 100)}%</div>
      </div>
      <div className="t-box2 num">
        <div className="r"><span>Liquidation Price</span><b>${fp(p.liq, dec)}<ArrowRight size={13} />{full ? '-' : `$${fp(p.liq, dec)}`}</b></div>
        <div className="r"><span>Position Margin</span><b>{usd(p.margin)}<ArrowRight size={13} />{full ? '-' : usd(p.margin * rem)}</b></div>
        <div className="r"><span>Leverage</span><b>{p.lev.toFixed(1)}x<ArrowRight size={13} />{full ? '-' : `${(p.lev * rem).toFixed(1)}x`}</b></div>
        <div className="r"><span>Estimated Price</span><b>${fp(p.mark, dec)}</b></div>
        <div className="r"><span>Estimated PnL</span><b className={pnl >= 0 ? 'buy' : 'sell'}>{sgn(pnl)}</b></div>
        <div className="r"><span>Taker Fee</span><b>0.035%</b></div>
        <div className="r"><span>Slippage</span><b>Est. 0.12% / Max {app.form.slippage}%</b></div>
      </div>
      <button className="cta sec" style={{ marginTop: 16 }} onClick={() => app.closePos(sym, frac)}>Confirm Order</button>
    </Modal>
  )
}

'use client'
import { useState } from 'react'
import { ArrowUp, ArrowDown, Share2 } from 'lucide-react'
import { logo, price as fp, sgn } from '@/lib/data'
import { useApp } from '@/lib/store'
import { Modal } from './ConfirmDialog'

export default function ShareDialog() {
  const app = useApp()
  const [mode, setMode] = useState<'roi' | 'usd'>('roi')
  if (app.dialog !== 'share') return null
  const sym = app.dialogArg, p = app.acct.positions.find(x => x.sym === sym)
  if (!p) return <Modal title="Share Position" onClose={app.closeDialog}><div className="empty" style={{ height: 120 }}>{sym ? `No open position in ${sym}.` : "No open position."}</div></Modal>
  const dec = app.market.dec, pos = p.upnl >= 0
  return (
    <Modal title="Share Position" onClose={app.closeDialog} wide>
      <div className="t-tgl"><button className={mode === 'roi' ? 'on' : ''} onClick={() => setMode('roi')}>% ROI</button><button className={mode === 'usd' ? 'on' : ''} onClick={() => setMode('usd')}>USDC</button></div>
      <div className={`t-share${pos ? '' : ' neg'}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, font: '500 18px/24px var(--font)', letterSpacing: '.05em' }}><span style={{ color: 'hsl(var(--phoenix))' }}>✕</span>PHOENIX</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 18 }}>
          <img src={logo(sym)} alt="" width={28} height={28} style={{ borderRadius: '50%' }} /><span style={{ font: '500 24px/32px var(--font)' }}>{sym}</span>
          <span className={`chip ${p.side === 'Long' ? 'buy' : 'sell'}`}>{p.side}</span><span className="chip">{p.lev.toFixed(1)}x</span>
        </div>
        <div className={`big num ${pos ? 'buy' : 'sell'}`}>{mode === 'roi' ? `${p.roi >= 0 ? '+' : ''}${p.roi.toFixed(2)}%` : sgn(p.upnl)}{pos ? <ArrowUp size={30} /> : <ArrowDown size={30} />}</div>
        <div className="ee num"><div>Entry Price<b>${fp(p.entry, dec)}</b></div><div>Mark Price<b>${fp(p.mark, dec)}</b></div></div>
      </div>
      <button className="cta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }} onClick={() => { try { void navigator.clipboard?.writeText(`${p.side} ${sym} ${sgn(p.upnl)} (${p.roi.toFixed(2)}%) on Phoenix`) } catch { /* ignore */ } app.closeDialog(); app.say('Link copied to clipboard') }}><Share2 size={16} />Share</button>
    </Modal>
  )
}

'use client'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ChevronDown, ChevronRight, Copy, Eye, EyeOff, LoaderCircle, Wallet, X } from 'lucide-react'
import { UnifoldLogo } from '@/components/icons/Phx'
import { useApp } from '@/lib/store'
import { fmt } from '@/lib/data'
import './dw.css'

const WALLET_BAL = 25
type View = 'main' | 'card' | 'exchange' | 'crypto'
const Ic = ({ src, bg, cls }: { src: string; bg?: string; cls?: string }) => <span className={cls} style={bg ? { background: bg } : undefined}><img src={src} alt="" /></span>
// INR flag: circular 1x1 flag graphic (lipis/flag-icons); production's widget flag file could not be read, so this is the standard flag, not a copy of theirs
const Flag = () => <img className="dx-flag" src="/img/flags/in-flagicons.svg" alt="" width={16} height={16} />
const Powered = () => <div className="dx-pw"><UnifoldLogo /></div>

export default function DepositDialog() {
  const { dialog, closeDialog, deposit, acct, say } = useApp()
  const [amt, setAmt] = useState(''), [show, setShow] = useState(true), [view, setView] = useState<View>('main'), [inr, setInr] = useState('6000')
  const open = dialog === 'deposit'
  const closeRef = useRef(closeDialog); closeRef.current = closeDialog
  useEffect(() => { if (!open) { setAmt(''); setShow(true); setView('main'); setInr('6000') } }, [open])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [open])
  if (!open) return null
  const n = parseFloat(amt) || 0, ok = n > 0 && n <= WALLET_BAL
  const addr = acct.addr.replace('…', '...')
  const Close = ({ s = 16 }: { s?: number }) => <button className="dx-x" aria-label="Close" onClick={closeDialog}><X size={s} /></button>
  let body, cls = 'dx-frame'
  if (view === 'main') {
    body = (
      <div className="dx-pad40">
        <h2 className="dx-h2">Deposit funds</h2>
        <button className="dx-x" style={{ left: 442, top: 36 }} aria-label="Close" onClick={closeDialog}><X size={16} /></button>
        <div className="dx-methods">
          <button className="dx-mth" onClick={() => setView('card')}>
            <span className="dx-ico"><Ic src="/img/payments/visa.svg" /><Ic src="/img/payments/mastercard.svg" cls="mc" /></span>
            <span className="lb">Card<ChevronRight size={16} /></span>
          </button>
          <button className="dx-mth" onClick={() => setView('exchange')}>
            <span className="dx-ico"><Ic src="/img/payments/coinbase.svg" bg="rgb(11,14,17)" /><Ic src="/img/payments/binance.svg" /></span>
            <span className="lb">Exchange<ChevronRight size={16} /></span>
          </button>
          <button className="dx-mth" onClick={() => setView('crypto')}>
            <span className="dx-ico c3"><Ic src="/img/chains/ethereum.svg" /><Ic src="/img/chains/arbitrum-one.svg" bg="rgb(33,49,71)" /><Ic src="/img/chains/solana.svg" /></span>
            <span className="lb">Send Crypto<ChevronRight size={16} /></span>
          </button>
        </div>
        <h3 className="dx-tab"><Wallet />Connected Wallet</h3>
        <div className="dx-wal"><span>Connected wallet ({show ? addr : '••••...••••'})</span>
          <span className="ac"><button className="dx-ib" aria-label="Copy wallet address" onClick={() => { try { void navigator.clipboard?.writeText(acct.addr) } catch { /* ignore */ } say('Address copied') }}><Copy size={16} /></button><button className="dx-ib" aria-label="Show wallet address" onClick={() => setShow(v => !v)}>{show ? <Eye size={16} /> : <EyeOff size={16} />}</button></span></div>
        <h3 className="dx-lbl">Amount</h3>
        <div className="dx-fld">
          <span className="dx-chip"><img src="/img/tokens/usdc.svg" alt="" />USDC<ChevronDown /></span>
          <input className="dx-in" inputMode="decimal" placeholder="0" value={amt} onChange={e => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
          <button className="dx-max" onClick={() => setAmt(String(WALLET_BAL))}>MAX</button>
        </div>
        <div className="dx-sub"><span>Available: {WALLET_BAL} USDC</span><span>Est. value: ${fmt(n)}</span></div>
        {n > WALLET_BAL && <div className="dx-err">Amount exceeds wallet balance</div>}
        <button className="dx-btn dep" disabled={!ok} onClick={() => deposit(n)}>Submit Deposit</button>
      </div>
    )
  } else if (view === 'card') {
    cls += ' dx-w400'
    body = (
      <div className="dx-uf card">
        <div className="tt">Deposit with Card<Close s={20} /></div>
        <button className="dx-cur" aria-label="Currency" title="Currency" onClick={() => say('INR is the only currency in this demo')}><Flag />INR<ChevronDown className="cv" size={14} /></button>
        <div className="dx-big">₹{inr}</div>
        <div className="dx-qa">{['8,600', '43,000', '86,000'].map(v => <button key={v} onClick={() => setInr(v.replace(',', ''))}>₹{v}</button>)}</div>
        <div className="pl">Provider</div>
        <div className="dx-pv" />
        <button className="dx-ct" disabled title="Card deposits are not available in the demo">Continue</button>
        <Powered />
      </div>
    )
  } else if (view === 'exchange') {
    cls += ' dx-w400'
    body = (
      <div className="dx-uf exch">
        <div className="tt">Connect Exchange<Close s={20} /></div>
        <div className="dx-ex">
          <button className="dx-exr" onClick={() => say('Coinbase is not available in the demo')}><span className="bi"><img src="/img/payments/coinbase.svg" alt="" /></span>Coinbase<ChevronRight /></button>
          <button className="dx-exr" onClick={() => say('Binance Pay is not available in the demo')}><span className="bi bn" style={{ background: 'rgb(240,185,11)' }}><img src="/img/payments/binance.svg" alt="" /></span>Binance Pay<ChevronRight /></button>
        </div>
        <Powered />
      </div>
    )
  } else {
    body = (
      <div className="dx-sc">
        <div className="hd"><button className="bk" aria-label="Back" onClick={() => setView('main')}><ArrowLeft size={16} /></button><h2>Send Crypto</h2><Close /></div>
        <div className="sub">Transfer cryptocurrency to a deposit address</div>
        <div className="dx-sel2">
          <div><label>Source Chain</label><button className="dx-sel" aria-label="Source chain" onClick={() => say('Arbitrum is the only chain in this demo')}><span className="ci" style={{ background: 'rgb(33,49,71)' }}><img src="/img/chains/arbitrum-one.svg" alt="" /></span>Arbitrum<ChevronDown /></button></div>
          <div><label>Source Token</label><button className="dx-sel" aria-label="Source token" onClick={() => say('USDC is the only token in this demo')}><span className="ci"><img src="/img/tokens/usdc.svg" alt="" /></span>USDC<ChevronDown /></button></div>
        </div>
        <div className="dx-card"><div className="lb">Send to</div>
          <div className="dx-adr"><div className="a dx-sk" /><div className="b dx-sk" /></div>
          <div className="dx-sk dx-ln" style={{ marginTop: 20 }} /><div className="dx-sk dx-ln" style={{ width: '82%' }} />
        </div>
        <div className="dx-card d"><div className="dx-dt">
          <div><span className="dx-sk" style={{ width: 80 }} /></div><div><span className="dx-sk" style={{ width: 97 }} /></div><div><span className="dx-sk" style={{ width: 112 }} /></div>
        </div></div>
        <button className="dx-wait" disabled title="Send funds to the address above to continue"><LoaderCircle className="spin" />Waiting for deposit</button>
      </div>
    )
  }
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog() }}>
      <div className={'modal ' + cls} role="dialog" aria-label="Deposit funds">{body}</div>
    </div>
  )
}

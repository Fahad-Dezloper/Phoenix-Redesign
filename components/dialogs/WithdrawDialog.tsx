'use client'
import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, ChevronLeft, Copy, Eye, EyeOff, Info, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { fmt } from '@/lib/data'
import { useEscape, usePresence } from '@/lib/presence'
import './dw.css'

const FEE = 0.5
type Asset = 'USDC' | 'SOL'
export default function WithdrawDialog() {
  const { dialog, closeDialog, withdraw, acct, say } = useApp()
  const [amt, setAmt] = useState(''), [show, setShow] = useState(true), [step, setStep] = useState<'form' | 'review'>('form')
  const [asset, setAsset] = useState<Asset>('USDC'), [menu, setMenu] = useState(false)
  const open = dialog === 'withdraw'
  const menuRef = useRef(false); menuRef.current = menu
  const closeRef = useRef(closeDialog); closeRef.current = closeDialog
  const pres = usePresence(menu, 150)
  useEscape(menu, () => setMenu(false))
  useEffect(() => { if (!open) { setAmt(''); setShow(true); setStep('form'); setAsset('USDC'); setMenu(false) } }, [open])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && !menuRef.current) closeRef.current() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [open])
  if (!open) return null
  const usdcBal = Math.max(0, acct.available), avail = asset === 'USDC' ? usdcBal : 0
  const n = parseFloat(amt) || 0, ok = asset === 'USDC' && n > FEE && n <= avail + 1e-9
  const addr = acct.addr.replace('…', '...')
  const pick = (f: number) => setAmt(f === 1 ? avail.toFixed(2).replace(/\.?0+$/, '') : (Math.floor(avail * f * 100) / 100).toFixed(2))
  const dis = (f: number) => avail <= 0 || (f < 1 && avail * f - FEE < 0.5)
  const Fee = <><span className="l">Fee <Info className="dx-info" aria-label="More information" /></span><span>${fmt(FEE)}</span></>
  const Wal = <>Connected wallet ({show ? addr : '••••...••••'})</>
  const Eyeb = <button className="dx-ib" aria-label="Show full wallet address" onClick={() => setShow(v => !v)}>{show ? <Eye size={16} /> : <EyeOff size={16} />}</button>
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog() }}>
      <div className="modal dx-frame" role="dialog" aria-label="Withdraw funds" onMouseDown={e => { if (menu && !(e.target as HTMLElement).closest('.dx-menu,.dx-chip')) setMenu(false) }}>
        <div className="dx-pad42">
          {step === 'form' ? (<>
            <h2 className="dx-h2" style={{ width: 'auto' }}>Withdraw funds</h2>
            <button className="dx-x" style={{ left: 438, top: 36 }} aria-label="Close dialog" onClick={closeDialog}><X size={20} /></button>
            <div className="dx-sec s1"><h3>Withdrawable Balance</h3>
              <div className="dx-bal"><img src="/img/tokens/usdc.svg" alt="" />{fmt(usdcBal)}<span className="sy">USDC</span><span className="v">${fmt(usdcBal)}</span></div>
              <div className="dx-bal"><img src="/img/tokens/sol.svg" alt="" />0<span className="sy">SOL</span><span className="v">$0.00</span></div>
            </div>
            <div className="dx-sec s2"><h3>Amount</h3>
              <div className="dx-box">
                <button className={'dx-chip' + (menu ? ' open' : '')} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(v => !v)}><img src={asset === 'USDC' ? '/img/tokens/usdc.svg' : '/img/tokens/sol.svg'} alt="" />{asset}<ChevronDown /></button>
                <input className="dx-in" inputMode="decimal" placeholder="0" value={amt} onChange={e => setAmt(e.target.value.replace(/[^0-9.]/g, ''))} />
                {pres.mounted && (
                  <div className="dx-menu pop-in" role="menu" data-state={pres.state} style={{ ['--pop-origin' as string]: 'top left' }}>
                    {(['USDC', 'SOL'] as Asset[]).map(a => (
                      <button key={a} role="menuitem" className={'dx-mi' + (a === asset ? ' sel' : '')} onClick={() => { setAsset(a); setAmt(''); setMenu(false) }}>
                        <img src={a === 'USDC' ? '/img/tokens/usdc.svg' : '/img/tokens/sol.svg'} alt="" />{a}{a === asset && <Check />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="dx-row"><span>Available: {fmt(avail)} {asset}</span>
                <span className="dx-pcts">{[0.25, 0.5, 0.75, 1].map(f => <button key={f} className="dx-max" disabled={dis(f)} onClick={() => pick(f)}>{f === 1 ? 'MAX' : f * 100 + '%'}</button>)}</span></div>
              <div className="dx-fee">{Fee}</div>
              {n > 0 && <div className="dx-fee"><span>You receive</span><span>${fmt(Math.max(0, n - FEE))}</span></div>}
            </div>
            <div className="dx-sec s3"><h3>Receive in</h3>
              <div className="dx-wbox"><span>{Wal}</span>
                <button className="dx-ib" aria-label="Copy wallet address" onClick={() => { try { void navigator.clipboard?.writeText(acct.addr) } catch { /* ignore */ } say('Address copied') }}><Copy size={16} /></button>{Eyeb}</div>
            </div>
            <button className="dx-btn wd" disabled={!ok} onClick={() => setStep('review')}>Continue to Review</button>
          </>) : (<>
            <div className="dx-rv-hd"><button className="dx-bk" aria-label="Back" onClick={() => setStep('form')}><ChevronLeft size={20} /></button><h2>Review withdrawal</h2>
              <button className="dx-x" style={{ right: 0, top: 2 }} aria-label="Close dialog" onClick={closeDialog}><X size={20} /></button></div>
            <img className="dx-rv-ic" src="/img/tokens/usdc.svg" alt="" />
            <p className="dx-rv-t">Withdraw {fmt(n)} USDC</p>
            <div className="dx-hr" />
            <div className="dx-rv-rows">
              <div><span className="l">Receive in</span><span className="r">{Wal}{Eyeb}</span></div>
              <div><span className="l">Fee <Info className="dx-info" aria-label="More information" /></span><span>${fmt(FEE)}</span></div>
              <div><span className="l">You receive</span><span>${fmt(Math.max(0, n - FEE))}</span></div>
            </div>
            <button className="dx-btn rv" onClick={() => withdraw(n)}>Confirm Withdraw</button>
          </>)}
        </div>
      </div>
    </div>
  )
}

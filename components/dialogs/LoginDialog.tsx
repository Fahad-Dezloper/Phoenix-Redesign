'use client'
import { useEffect, useState } from 'react'
import { Loader2, Wallet, X } from 'lucide-react'
import { PhoenixLogo } from '@/components/icons/Phx'
import { PHX_SVG } from '@/lib/phx-svgs'
import { useApp } from '@/lib/store'
import '../pages/pages.css'

const MARK_D = (PHX_SVG.mark.match(/ d="([^"]+)"/) || [, ''])[1]
const Google = () => (
  <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.500-.2-2.200H12v4.200h5.900a5 5 0 0 1-2.200 3.300v2.700h3.500c2.100-1.900 3.300-4.700 3.300-8Z" /><path fill="#34A853" d="M12 23c3 0 5.400-1 7.200-2.700l-3.500-2.700c-1 .7-2.200 1-3.700 1-2.800 0-5.200-1.900-6-4.500H2.400v2.800A11 11 0 0 0 12 23Z" /><path fill="#FBBC05" d="M6 14.100a6.600 6.600 0 0 1 0-4.200V7.100H2.400a11 11 0 0 0 0 9.800L6 14.100Z" /><path fill="#EA4335" d="M12 5.400c1.600 0 3 .6 4.100 1.600l3.100-3.100A11 11 0 0 0 2.400 7.100L6 9.900c.8-2.600 3.200-4.500 6-4.500Z" /></svg>
)

export default function LoginDialog() {
  const { dialog, closeDialog, signIn, loginStep, set } = useApp()
  const [email, setEmail] = useState('')
  const [via, setVia] = useState('')
  const open = dialog === 'login'
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape' && loginStep === 'choose') closeDialog() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [open, loginStep, closeDialog])
  useEffect(() => { if (!open) { setEmail(''); setVia('') } }, [open])
  if (!open) return null
  const go = (m: 'google' | 'wallet' | 'email', label: string) => { setVia(label); signIn(m) }
  const valid = /.+@.+\..+/.test(email)
  const connecting = loginStep === 'connecting'
  return (
    <div className="ov lg-ov" onMouseDown={e => { if (e.target === e.currentTarget && !connecting) closeDialog() }}>
      <div className="modal lg-login" role="dialog" aria-label="Sign in">
        <div className="lg-l">
          <svg className="bg" viewBox="0 0 404 580" preserveAspectRatio="none" aria-hidden>
            <defs>
              <linearGradient id="lgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5a3716" /><stop offset="1" stopColor="#7a4a18" /></linearGradient>
              <linearGradient id="lgb2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4a2e12" /><stop offset="1" stopColor="#6a4016" /></linearGradient>
              <pattern id="lgx" width="32" height="32" patternUnits="userSpaceOnUse"><svg x="10" y="9" width="12" height="13" viewBox="0 0 120 131"><path d={MARK_D} fill="#fff" fillOpacity=".045" /></svg></pattern>
              <linearGradient id="lgf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".3" stopColor="#fff" stopOpacity=".4" /><stop offset=".6" stopColor="#fff" stopOpacity="0" /></linearGradient>
              <mask id="lgm"><rect width="404" height="580" fill="url(#lgf)" /></mask>
            </defs>
            <rect width="404" height="580" fill="url(#lgx)" />
            <path d="M71 309 C 170 330 300 345 405 217 L 405 252 L 311 428Z" fill="url(#lgb)" />
            <path d="M322 459 L 405 499 L 405 580 L 251 580Z" fill="url(#lgb2)" />
          </svg>
          <div className="bd"><PhoenixLogo width={124} /></div>
          <div className="hl"><span className="a">Trade</span><span className="b">SOL <em>25x</em></span><p>Crypto, equities, commodities and pre-IPO markets. All on Solana.</p></div>
        </div>
        <div className="lg-r">
          {connecting ? (
            <div className="lg-conn"><Loader2 size={32} className="spin" style={{ color: 'hsl(var(--phoenix))' }} /><div>Connecting{via ? ' with ' + via : ''}...<small>Approve the request in your {via === 'wallet' ? 'wallet' : 'browser'} to continue</small></div></div>
          ) : (<>
            <p className="gs">Get started</p>
            <button className="lg-opt" onClick={() => go('google', 'Google')}><Google />Sign in with Google</button>
            <button className="lg-opt" onClick={() => go('wallet', 'wallet')}><Wallet size={16} />Sign in with Wallet</button>
            <div className="lg-or">or continue with email</div>
            <label htmlFor="lg-email">Email address</label>
            <input id="lg-email" className="lg-em" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && valid) go('email', 'email') }} />
            <button className={'lg-go' + (valid ? ' ready' : '')} onClick={() => go('email', 'email')}>Continue with email</button>
          </>)}
        </div>
        {!connecting && <button className="xbtn lg-x" aria-label="Close onboarding" onClick={() => { set({ loginStep: 'choose' }); closeDialog() }}><X size={18} strokeWidth={1.5} /></button>}
      </div>
    </div>
  )
}

'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, ChevronDown, Copy, Ghost, LogOut, Settings, Smartphone } from 'lucide-react'
import { useApp } from '@/lib/store'
import { E } from '@/lib/sim'
import { usePresence } from '@/lib/presence'
import Logo from '@/components/pages/Logo'
import { PhoenixLogo, PhoenixMark, DiscordLogo } from '@/components/icons/Phx'
import { usd, sgn } from '@/lib/data'
import RollNum from '@/components/RollNum'

function useOutside(open: boolean, close: () => void) {
  const r = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (r.current && !r.current.contains(e.target as Node)) close() }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    document.addEventListener('mousedown', h); document.addEventListener('keydown', k)
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k) }
  }, [open, close])
  return r
}

type Part = string | { sym: string }
const ANN: { title: string; ago: string; body: Part[] }[] = [
  { title: 'Equity reporting today', ago: '8hr ago', body: [{ sym: 'NBIS' }, ' is reporting earnings today, before the market open.'] },
  { title: 'New Asset Markets', ago: '1d ago', body: [{ sym: 'PANW' }, ' and ', { sym: 'CSCO' }, ' are now available to trade.'] },
  { title: 'FX markets are now available', ago: '1d ago', body: [{ sym: 'GBPUSD' }, ', ', { sym: 'EURUSD' }, ', and ', { sym: 'USDJPY' }, ' are now available to trade at up to 100x leverage.'] },
  { title: 'Equity reporting today', ago: '1d ago', body: [{ sym: 'CRWV' }, ' is reporting earnings today, after the market close.'] },
  { title: 'Tailwind Rewards are now live', ago: '1w ago', body: ['Phoenix now pays back 10% of the funding you pay on BTC, ETH, SOL and HYPE. Rewards are calculated daily and claimable on the Rewards page.'] },
]
export default function Nav() {
  const path = usePathname()
  const { signedIn, ghost, acct, sym, openDialog, signOut, say, unread, tickN, v2, exitGhost } = useApp()
  const [menu, setMenu] = useState(false), [balOpen, setBalOpen] = useState(false), [bell, setBell] = useState(false), [btab, setBtab] = useState<'Trades' | 'Announcements'>('Announcements')
  const mref = useOutside(menu, () => setMenu(false)), bref = useOutside(bell, () => setBell(false))
  const bref2 = useOutside(balOpen, () => setBalOpen(false)), bpop = usePresence(balOpen)
  const mp = usePresence(menu), bp = usePresence(bell)
  const v2on = v2 && signedIn && !ghost
  const v2bal = v2 && (signedIn || !!ghost) // v2 balance badge + popover; read-only for a watched trader
  const RO = 'Read-only while watching another trader'
  const on = (p: string) => (p === '/' ? !['/portfolio', '/rewards', '/leaderboard', '/markets'].some(x => path.startsWith(x)) : path.startsWith(p))
  const active = signedIn || !!ghost
  const L = (href: string, label: string, match: string, off = false, dot = false) => <Link href={href} className={(on(match) ? 'on ' : '') + (off ? 'off' : '')}>{label}{dot && !ghost && <i className="rdot" />}</Link>
  void tickN
  return (
    <nav className={`nav${v2 ? ' v2n' : ''}`}>
      <div className="l">
        <Link href={'/' + sym} className="brand" aria-label="Phoenix home"><PhoenixLogo className="bw" /><PhoenixMark size={24} className="bm" /></Link>
        <div className="links">
          {L('/' + sym, 'Trade', '/')}
          {L('/portfolio', 'Portfolio', '/portfolio', !active)}
          {L('/rewards', 'Rewards', '/rewards', !!ghost, true)}
          {L('/leaderboard', 'Leaderboard', '/leaderboard')}
        </div>
      </div>
      <div className="r">
        {active ? (<>
          {!v2bal && <button className="btn" disabled={!!ghost} title={ghost ? 'Read-only while viewing another trader' : undefined} onClick={() => openDialog('deposit')}>Deposit</button>}
          {!v2bal && <button className="btn" disabled={!!ghost} title={ghost ? 'Read-only while viewing another trader' : undefined} onClick={() => openDialog('withdraw')}>Withdraw</button>}
          {v2bal ? (
            <div className="pop balbadge" ref={bref2}>
              <button className="btn num bal" aria-haspopup="dialog" aria-expanded={balOpen} onClick={() => { setBalOpen(v => !v); setMenu(false); setBell(false) }}><RollNum value={usd(acct.equity)} /><ChevronDown size={14} className={'chv' + (balOpen ? ' o' : '')} /></button>
              <span className="sep" aria-hidden />
              <button className="dep" aria-label="Deposit" title={ghost ? RO : 'Deposit'} disabled={!!ghost} aria-disabled={!!ghost} style={ghost ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => { if (ghost) return; setBalOpen(false); openDialog('deposit') }}>Deposit</button>
              {bpop.mounted && (
                <div className="menu balpop pop-in" data-state={bpop.state} style={{ ['--pop-origin' as string]: 'top right' }}>
                  <div className="bhd"><span>{ghost ? 'Watched account value' : 'Account value'}</span><b className="num">{usd(acct.equity)}</b></div>
                  <div className="bgrid num">
                    <span>Available to trade</span><b>{usd(acct.available)}</b>
                    <span>Collateral</span><b>{usd(acct.collateral)}</b>
                    <span>Unrealized PnL</span><b className={acct.upnl >= 0 ? 'buy' : 'sell'}>{sgn(acct.upnl)}</b>
                    <span>Margin used</span><b>{usd(acct.initMargin)}</b>
                    <span>Open exposure</span><b>{usd(acct.exposure)}</b>
                  </div>
                  <div className="health"><div className="hl"><span>Account health</span><b className="num">{acct.health.toFixed(0)}%</b></div><div className="bar"><i style={{ width: acct.health + '%', background: acct.health >= 60 ? 'hsl(var(--buy))' : acct.health >= 30 ? 'hsl(var(--phoenix))' : 'hsl(var(--sell))' }} /></div></div>
                  {ghost && <p className="num" style={{ margin: '12px 0 0', font: '400 12px/16px var(--font)', color: 'hsl(var(--muted-foreground))' }}>Read-only while watching. Deposits and withdrawals are only for your own account.</p>}
                  <div className="bact"><button className="btn" disabled={!!ghost} aria-disabled={!!ghost} title={ghost ? RO : undefined} style={ghost ? { opacity: 0.5, cursor: 'not-allowed' } : undefined} onClick={() => { if (ghost) return; setBalOpen(false); openDialog('withdraw') }}>Withdraw</button><Link className="btn" href="/portfolio" onClick={() => setBalOpen(false)}>Portfolio</Link></div>
                </div>
              )}
            </div>
          ) : <button className="btn num bal" onClick={() => !ghost && say('Account balance ' + usd(acct.equity))}>{usd(acct.equity)}</button>}
          <div className="pop" ref={mref}>
            {ghost && v2 ? (
              // v2 Ghost Mode: ghost icon + the watched address, styled as the normal wallet button
              <button className="btn wal gh" aria-haspopup="menu" aria-expanded={menu} aria-label={'Watching ' + ghost + ' (read-only)'} title={'Watching ' + ghost + ' (read-only)'} onClick={() => { setMenu(v => !v); setBalOpen(false); setBell(false) }}>
                <Ghost size={16} strokeWidth={2} style={{ flex: 'none', color: 'hsl(var(--muted-foreground))' }} aria-hidden /><span className="wt">{ghost}</span>
              </button>
            ) : (
            <button className={'btn wal' + (ghost ? ' gh' : '')} aria-haspopup="menu" aria-expanded={menu} aria-label={ghost ? 'Viewing as ' + ghost : 'Wallet ' + acct.addr} onClick={() => { setMenu(v => !v); setBalOpen(false); setBell(false) }}>
              {ghost ? <><span className="wt">Viewing as {ghost}</span><span className="wm">Ghost</span></> : <>{v2 ? <img className="avimg" src="/img/wallets/phantom.svg" alt="Phantom" width={16} height={16} /> : <i className="av" />}<span className="wt">{acct.addr}</span></>}
            </button>
            )}
            {mp.mounted && ghost && v2 && (
              <div className="menu pop-in" data-state={mp.state} style={{ ['--pop-origin' as string]: 'top right' }}>
                <div className="mh"><div className="mrow"><Ghost size={16} strokeWidth={2} style={{ flex: 'none', color: 'hsl(var(--phoenix))' }} aria-hidden /><u>{ghost}</u><button aria-label="Copy address" title="Copy address" onClick={() => { try { void navigator.clipboard?.writeText(ghost) } catch { /* ignore */ } say('Address copied') }}><Copy size={16} /></button></div></div>
                <button className="mi" onClick={() => { setMenu(false); exitGhost() }}><ArrowLeft size={16} /><span>{signedIn ? 'Back to my account' : 'Stop watching'}</span></button>
              </div>
            )}
            {mp.mounted && !ghost && (
              <div className="menu pop-in" data-state={mp.state} style={{ ['--pop-origin' as string]: 'top right' }}>
                <div className="mh"><div className="mrow">{v2 ? <img className="avimg" src="/img/wallets/phantom.svg" alt="Phantom" width={16} height={16} /> : <i className="av" />}<u>{acct.addr}</u><button aria-label="Copy address" title="Copy address" onClick={() => { try { void navigator.clipboard?.writeText(acct.addr) } catch { /* ignore */ } say('Address copied') }}><Copy size={16} /></button></div><button className="mlo" aria-label="Disconnect" title="Disconnect" onClick={() => { setMenu(false); signOut() }}><LogOut size={16} /></button></div>
                {v2 && <button className="mi" onClick={() => { setMenu(false); openDialog('settings') }}><Settings size={16} /><span>Settings</span></button>}
                <button className="mi" onClick={() => { setMenu(false); say('Not redesigned. Mobile sign-in is unchanged from the current Phoenix, so it is not part of this demo.', 'info', 4500) }}><Smartphone size={16} /><span>Login on mobile</span></button>
                <button className="mi" onClick={() => { setMenu(false); signOut() }}><LogOut size={16} /><span>Sign Out</span></button>
                <hr />
                <a className="mi" href="https://discord.com/invite/phoenixtrade" target="_blank" rel="noreferrer"><DiscordLogo size={16} /><span>Join Discord</span></a>
              </div>
            )}
          </div>
          <div className="pop" ref={bref}>
            <button className="btn sq" aria-label="Notifications" aria-haspopup="dialog" aria-expanded={bell} onClick={() => { setBell(v => !v); setMenu(false); setBalOpen(false); E.unread = 0 }}><Bell size={16} />{unread > 0 && !ghost && <i className="badge" />}</button>
            {bp.mounted && (
              <div className="notif pop-in" data-state={bp.state} style={{ ['--pop-origin' as string]: 'top right' }}>
                <h4>Notifications</h4>
                <div className="tabs">{(['Trades', 'Announcements'] as const).map(t => <button key={t} className={btab === t ? 'on' : ''} onClick={() => setBtab(t)}>{t}</button>)}</div>
                {btab === 'Trades'
                  ? (!ghost && E.notes.length > 0
                    ? <div className="nlist">{E.notes.slice(0, 12).map(n => <div className="ncard" key={n.id}><div className="nic"><PhoenixMark size={16} /></div><div className="nbd"><div className="nrow2"><b>{n.title}</b></div><p>{n.text}</p></div></div>)}</div>
                    : <p className="caught">You&apos;re all caught up.</p>)
                  : <div className="nlist">{ANN.map((a, i) => (
                    <div className="ncard" key={i}>
                      <div className="nic"><i className="ndot" /><PhoenixMark size={16} /></div>
                      <div className="nbd"><div className="nrow2"><b>{a.title}</b><span>{a.ago}</span></div>
                        <p>{a.body.map((p, j) => typeof p === 'string' ? <span key={j}>{p}</span> : <span className="nchip" key={j}><Logo sym={p.sym} size={12} />{p.sym}</span>)}</p></div>
                    </div>))}</div>}
              </div>
            )}
          </div>
        </>) : <button className="btn navcta" onClick={() => openDialog('login')}>Start Trading</button>}
        {!v2on && <button className="btn sq" aria-label="Settings" onClick={() => openDialog('settings')}><Settings size={16} /></button>}
      </div>
    </nav>
  )
}

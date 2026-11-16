'use client'
import Unbuilt from './Unbuilt'
import { useApp } from '@/lib/store'
import Link from 'next/link'
import { XLogo, DiscordLogo } from '@/components/icons/Phx'
export default function Footer() {
  const { tickN, v2 } = useApp(), ping = Math.floor(tickN / 4)
  if (v2) {
    // v2: an exchange status bar. Connection, RPC latency, the chain's current slot and the time on the left; the useful links on the right.
    const ms = 36 + ((tickN * 7) % 19), slot = 311_400_000 + Math.floor((Date.now() - 1_790_000_000_000) / 400)
    const tone = ms < 100 ? 'ok' : ms < 250 ? 'mid' : 'bad'
    return (
      <footer className="footer v2f">
        <div className="l">
          <span className="it" title="Phoenix market data is streaming"><span className="pdot" role="img" aria-label="Phoenix market data received"><span key={ping} className="pring animate-ping" /><i className="dot" /></span><b>Operational</b></span>
          <span className="sep" />
          <span className="it" title="Round-trip time to the Solana RPC node"><i className={'dot ' + tone} /><span className="k">RPC</span><b className="num">{ms} ms</b></span>
          <span className="sep lo" />
          <span className="it lo" title="Current Solana slot"><span className="k">Slot</span><b className="num">{slot.toLocaleString('en-US')}</b></span>
          <span className="sep lo" />
          <span className="it lo" title="Network"><span className="k">Solana</span><b>Mainnet</b></span>
        </div>
        <div className="r">
          <span className="it lo2" title="Coordinated Universal Time"><span className="k">UTC</span><b className="num">{new Date().toISOString().slice(11, 19)}</b></span>
          <span className="sep lo2" />
          <Link href="/markets">Markets</Link><Unbuilt href="https://docs.phoenix.trade/" className="lo2">Docs</Unbuilt><Unbuilt href="/terms-of-service">Terms</Unbuilt><Unbuilt href="/privacy-policy">Privacy</Unbuilt>
          <span className="sep" />
          <a href="https://x.com/PhoenixTrade" target="_blank" rel="noreferrer" aria-label="Phoenix on X"><XLogo size={12} /></a>
          <a href="https://discord.com/invite/phoenixtrade" target="_blank" rel="noreferrer" aria-label="Phoenix on Discord"><DiscordLogo size={16} /></a>
        </div>
      </footer>
    )
  }
  return (
    <footer className="footer">
      <div className="l"><span className="st"><span className="pdot" role="img" aria-label="Phoenix market data received"><span key={ping} className="pring animate-ping" /><i className="dot" /></span><span>Phoenix</span></span><span className="st"><i className="dot" /><span>RPC</span></span></div>
      <div className="r">
        <Link href="/markets">Markets</Link><Unbuilt href="/terms-of-service">Terms</Unbuilt><Unbuilt href="/privacy-policy">Privacy</Unbuilt>
        <Unbuilt href="https://docs.phoenix.trade/">Docs</Unbuilt>
        <a href="https://x.com/PhoenixTrade" target="_blank" rel="noreferrer" aria-label="x.com"><XLogo size={12} /></a>
        <a href="https://discord.com/invite/phoenixtrade" target="_blank" rel="noreferrer" aria-label="Discord"><DiscordLogo size={16} /></a>
      </div>
    </footer>
  )
}

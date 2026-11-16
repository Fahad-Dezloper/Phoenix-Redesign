'use client'
import { useState } from 'react'
import { Check, Copy, Ghost, X } from 'lucide-react'
import { useApp } from '@/lib/store'
import { Identicon, traderInfo } from './GhostDock'

const money = (n: number) => (n < 0 ? '-' : '+') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')

export default function GhostBanner() {
  const { ghost, exitGhost, watchRemove, say, v2 } = useApp()
  const [ok, setOk] = useState(false)
  if (!ghost || v2) return null // v2: the watching strip is gone; the dock shows who you are watching
  if (!v2) return (
    <div className="ghostbar">
      <Ghost size={16} /><b>Ghost Mode</b><span>•</span><span>Viewing as <b className="addr">{ghost}</b></span>
      <div className="gr">
        <button aria-label="Copy address" onClick={() => say('Address copied')}><Copy size={14} /></button>
        <button aria-label="Exit Ghost Mode" className="x" onClick={exitGhost}><X size={16} /></button>
      </div>
    </div>
  )
  const t = traderInfo(ghost)
  const copy = () => { try { navigator.clipboard?.writeText(ghost) } catch { /* ignore */ } setOk(true); setTimeout(() => setOk(false), 1400) }
  return (
    <div className="ghostbar" role="status">
      <span className="gi"><Identicon addr={ghost} size={22} /></span>
      <span>Watching <span className="gt">{ghost.length > 14 ? ghost.slice(0, 4) + '…' + ghost.slice(-4) : ghost}</span></span>
      <span className="gro">Read-only</span>
      {t && <span className="gs">Rank <b>#{t.rank}</b><span>·</span><b className={t.pnl >= 0 ? 'buy' : 'sell'}>{money(t.pnl)}</b> 1D</span>}
      <div className="gr">
        <button className={'gb' + (ok ? ' ok' : '')} onClick={copy} aria-label="Copy address">{ok ? <Check size={13} /> : <Copy size={13} />}{ok ? 'Copied' : 'Copy address'}</button>
        <button className="gb" onClick={() => watchRemove(ghost)} aria-label="Stop watching this trader">Stop watching</button>
        <button className="gb" onClick={exitGhost} aria-label="Back to my account">Back to my account</button>
      </div>
    </div>
  )
}

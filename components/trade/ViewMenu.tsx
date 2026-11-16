'use client'
import { useEffect, useState } from 'react'
import { Check, LayoutPanelLeft } from 'lucide-react'
import { useApp } from '@/lib/store'
import { usePresence, useEscape } from '@/lib/presence'

type V = 'default' | 'all' | 'depth' | 'chart' | 'trades'
type R = [number, number, number, number, 'c' | 'b' | 't']
export const VIEWS: { v: V; label: string; sub: string; r: R[] }[] = [
  { v: 'default', label: 'Chart + Order Book', sub: 'Default · Trade List on a tab', r: [[1, 1, 18, 18, 'c'], [20, 1, 7, 18, 'b']] },
  { v: 'all', label: 'Chart, Order Book + Trade List', sub: 'All three at once', r: [[1, 1, 18, 18, 'c'], [20, 1, 7, 9, 'b'], [20, 11, 7, 8, 't']] },
  { v: 'depth', label: 'Order Book + Trade List', sub: 'Side by side, no chart', r: [[1, 1, 12.5, 18, 'b'], [14.5, 1, 12.5, 18, 't']] },
  { v: 'chart', label: 'Chart only', sub: 'Full width', r: [[1, 1, 26, 18, 'c']] },
  { v: 'trades', label: 'Trade List only', sub: 'Full width', r: [[1, 1, 26, 18, 't']] },
]
const KEY = 'phx-v2-view'
export const ViewGlyph = ({ r }: { r: R[] }) => (
  <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>{r.map((x, i) => <rect key={i} x={x[0]} y={x[1]} width={x[2]} height={x[3]} rx="2" fill={x[4] === 'c' ? 'currentColor' : x[4] === 'b' ? 'hsl(var(--phoenix))' : 'hsl(var(--buy))'} opacity={x[4] === 'c' ? 0.35 : 0.85} />)}</svg>
)

export default function ViewMenu() {
  const { view, set } = useApp()
  const [open, setOpen] = useState(false)
  const pr = usePresence(open)
  useEscape(open, () => setOpen(false))
  useEffect(() => { try { const v = localStorage.getItem(KEY) as V | null; if (v && VIEWS.some(x => x.v === v)) set({ view: v }) } catch { /* ignore */ } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (v: V) => { set({ view: v }); try { localStorage.setItem(KEY, v) } catch { /* ignore */ } setOpen(false) }
  const cur = VIEWS.find(x => x.v === view)!
  return (
    <div className="t-vw">
      <button className={`t-vwb${open ? ' on' : ''}`} onClick={() => setOpen(o => !o)} aria-haspopup="menu" aria-expanded={open} aria-label="Change view" title="Change view"><LayoutPanelLeft size={16} /></button>
      {pr.mounted && (<>{open && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />}
        <div className="t-pop pop-in" data-state={pr.state} style={{ right: 0, top: 36, width: 292, ['--pop-origin' as string]: 'top right' }}>
          <div className="lab">View · {cur.label}</div>
          {VIEWS.map(x => <button key={x.v} className={`it vw${x.v === view ? ' on' : ''}`} onClick={() => pick(x.v)}><ViewGlyph r={x.r} /><span className="tx"><b>{x.label}</b><small>{x.sub}</small></span>{x.v === view && <Check className="ck" size={16} />}</button>)}
        </div></>)}
    </div>
  )
}

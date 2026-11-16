'use client'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { useApp } from '@/lib/store'
import { MARKETS } from '@/lib/data'
import { cmpCss } from '../trade/ChartPanel'
import Logo from '../pages/Logo'
import '../pages/pages.css'

const DOT: Record<string, string> = { AAPL: '#ffffff', AAVE: '#b6509e', ADA: '#0033ad', AERO: '#0056d6', AMAT: '#008cb4', AMD: '#ed1c24', AMZN: '#ff9900', ANSEM: '#3fc84c' }
const dot = (s: string) => DOT[s] || `hsl(${[...s].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 360} 65% 50%)`
const MAX = 2 // v2: at most two markets overlaid on the chart

export default function CompareDialog() {
  const { dialog, closeDialog, say, sym, v2, compare, set } = useApp()
  const [q, setQ] = useState('')
  const [hi, setHi] = useState(0) // keyboard-highlighted row
  const [pos, setPos] = useState<CSSProperties | undefined>(undefined)
  const ls = useRef<HTMLDivElement>(null)
  const open = dialog === 'compare'
  useEffect(() => { if (!open) { setQ(''); setHi(0) } }, [open])
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [open, closeDialog])
  // v2: anchor the popover under the chart's Compare button (right-aligned) instead of a fixed spot
  useLayoutEffect(() => {
    if (!open || !v2) { setPos(undefined); return }
    const b = document.querySelector('.t-chart .t-cmp')?.getBoundingClientRect()
    if (!b) { setPos(undefined); return }
    const w = 290, left = Math.max(8, Math.min(window.innerWidth - w - 8, b.right - w)), top = Math.min(b.bottom + 6, window.innerHeight - 354)
    setPos({ left, top, ['--pop-origin' as string]: 'top right' })
  }, [open, v2])
  useEffect(() => { setHi(0) }, [q])
  useEffect(() => { ls.current?.querySelector<HTMLElement>(`[data-i="${hi}"]`)?.scrollIntoView({ block: 'nearest' }) }, [hi])
  if (!open) return null
  const active = v2 ? compare.filter(c => c !== sym) : []
  const list = MARKETS.filter(m => m.sym !== sym && (m.sym + ' ' + m.name).toLowerCase().includes(q.trim().toLowerCase())).sort((a, b) => (active.includes(b.sym) ? 1 : 0) - (active.includes(a.sym) ? 1 : 0) || a.sym.localeCompare(b.sym)) // markets being compared first
  const pick = (s: string) => {
    if (!v2) { say(`Comparing ${sym} with ${s}`); closeDialog(); return }
    if (active.includes(s)) set({ compare: active.filter(x => x !== s) })
    else set({ compare: [...active, s].slice(-MAX) }) // a third pick replaces the oldest
    closeDialog()
  }
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi(i => Math.min(list.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi(i => Math.max(0, i - 1)) }
    else if (e.key === 'Enter' && list[hi]) { e.preventDefault(); pick(list[hi].sym) }
  }
  return (
    <div className="cp-ov" onMouseDown={e => { if (e.target === e.currentTarget) closeDialog() }}>
      <div className={'cp pop-in' + (v2 ? ' cp-v2' : '')} data-state="open" role="dialog" aria-label="Compare markets" style={pos}>
        <label className="s"><Search size={14} /><input autoFocus placeholder="Search markets" value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} aria-controls="cp-list" /></label>
        {v2 && <div className="cp-note">{active.length ? `Comparing ${active.length} of ${MAX}${active.length >= MAX ? ' · a new pick replaces the oldest' : ''}` : `Overlay up to ${MAX} markets as % change`}</div>}
        <div className="ls" id="cp-list" role="listbox" ref={ls}>
          {list.map((m, i) => {
            const ci = active.indexOf(m.sym), on = ci >= 0
            return (
              <div key={m.sym} data-i={i} role="option" aria-selected={on} className={'it' + (v2 && i === hi ? ' kb' : '') + (on ? ' on' : '')} onClick={() => pick(m.sym)} onMouseMove={() => v2 && hi !== i && setHi(i)}>
                <Logo sym={m.sym} size={18} />{(!v2 || on) && <span className="d" style={{ background: v2 ? cmpCss(ci) : dot(m.sym) }} />}
                <span className="n">{m.sym}<small>{m.name}</small></span>
                <button className="pl" aria-label={on ? `Remove ${m.sym} comparison` : `Add ${m.sym} comparison`} tabIndex={-1}>{on ? <Check size={14} /> : <Plus size={14} />}</button>
              </div>
            )
          })}
          {!list.length && <div className="empty" style={{ height: 120 }}>No markets found</div>}
        </div>
      </div>
    </div>
  )
}

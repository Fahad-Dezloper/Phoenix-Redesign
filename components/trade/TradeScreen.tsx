'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import './trade.css'
import { MARKETS } from '@/lib/data'
import { useApp } from '@/lib/store'
import { TickerHead } from './TickerBar'
import TickerBar from './TickerBar'
import MarketStats from './MarketStats'
import ChartPanel from './ChartPanel'
import BookPanel from './BookPanel'
import OrderForm from './OrderForm'
import PositionsPanel from './PositionsPanel'
import ViewMenu from './ViewMenu'

// true below the 1024px breakpoint (tablet portrait): the layout switches to two columns and the page scrolls inside the grid
function useNarrow(px = 1023) {
  const [n, setN] = useState(false)
  useEffect(() => { const mq = window.matchMedia(`(max-width:${px}px)`), f = () => setN(mq.matches); f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f) }, [px])
  return n
}

export default function TradeScreen({ sym }: { sym?: string }) {
  const { set, sym: cur, v2, view, tpFocus, tkLanes } = useApp()
  useEffect(() => { document.documentElement.toggleAttribute('data-tpf', !!(v2 && tpFocus)); return () => document.documentElement.removeAttribute('data-tpf') }, [v2, tpFocus])
  const md = useNarrow()
  const nobook = v2 && (view === 'chart' || view === 'depth' || view === 'trades'), showChart = !v2 || view === 'default' || view === 'all' || view === 'chart'
  const [bh, setBh] = useState(v2 ? 244 : 200)
  const twoL = tkLanes[1] !== null
  const [bw, setBw] = useState(240)
  const labels = useMemo(() => (typeof location !== 'undefined' && new URLSearchParams(location.search).has('labels')), [])
  useEffect(() => { if (v2) setBh(h => (h === 200 ? 244 : h)) }, [v2]) // v2 starts with a taller bottom panel (the store switches v2 on after the first render)
  const vr = useRef<{ x: number; w: number } | null>(null)
  const dr = useRef<{ y: number; h: number } | null>(null)

  useEffect(() => { if (sym && sym !== cur && MARKETS.some(m => m.sym === sym)) set({ sym }) }, [sym]) // eslint-disable-line react-hooks/exhaustive-deps
  // the drag listeners live only for the length of a drag (no window-wide mousemove work the rest of the time)
  const startDrag = (e: React.MouseEvent, kind: 'y' | 'x') => {
    e.preventDefault()
    if (kind === 'y') dr.current = { y: e.clientY, h: bh }; else vr.current = { x: e.clientX, w: bw }
    document.body.style.userSelect = 'none'; if (kind === 'x') document.body.style.cursor = 'col-resize'
    const mv = (ev: MouseEvent) => {
      if (dr.current) setBh(Math.min(480, Math.max(120, dr.current.h - (ev.clientY - dr.current.y))))
      if (vr.current) setBw(Math.min(560, Math.max(200, vr.current.w - (ev.clientX - vr.current.x))))
    }
    const up = () => { dr.current = null; vr.current = null; document.body.style.userSelect = ''; document.body.style.cursor = ''; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
  }

  return (
    <main className={`grid t-grid${v2 ? ` t-v2grid${twoL ? '' : ' one'}${nobook ? ' nb' : ''}${labels ? '' : ' nol' /* S1-S5 badges are off by default; add ?labels to see them */}` : nobook ? ' nb' : ''}`} style={{ ['--bh' as string]: `${bh}px`, ['--bw' as string]: `${bw}px` }}>
      {v2 && <TickerHead />}
      {v2 ? <>
        <section className="panel t-tkp"><TickerBar /></section>
        <section className="panel t-merge"><div className="t-mst"><MarketStats /></div>{showChart ? <ChartPanel /> : <div className="t-alt"><BookPanel mode={view === 'depth' ? 'side' : 'trades'} /></div>}<ViewMenu /></section>
      </> : <>
        <section className="panel t-stats"><TickerBar /><MarketStats /></section>
        <ChartPanel />
      </>}
      {!nobook && <BookPanel mode={v2 && view === 'all' ? 'stack' : v2 && md ? 'side' : 'tabs'} />}
      <OrderForm />
      <div className="t-pos"><PositionsPanel /></div>
      <div className="t-hrz" onMouseDown={e => startDrag(e, 'y')}><i /><i /><i /><i /><i /></div>
      {!nobook && <div className="t-vrz" role="separator" aria-orientation="vertical" aria-label="Resize order book" onMouseDown={e => startDrag(e, 'x')} onDoubleClick={() => setBw(240)}><i /><i /><i /><i /><i /></div>}
    </main>
  )
}

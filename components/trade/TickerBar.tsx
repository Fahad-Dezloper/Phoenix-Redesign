'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight, Check, DollarSign, Flame, Percent, Star, Plus, Tag, TrendingUp, X } from 'lucide-react'
import { TriDown, TriUp } from '@/components/icons/Phx'
import { E } from '@/lib/sim'
import { MARKETS, TOP_MOVERS, bySym, price as fp } from '@/lib/data'
import { useApp } from '@/lib/store'
import { usePresence, useEscape } from '@/lib/presence'
import { Logo } from './MarketStats'
import { Edges, useEdges } from './ScrollHint'

type Disp = 'pct' | 'abs' | 'px'
type Mode = 'movers' | 'favs' | 'active'

export default function TickerBar() {
  const { v2 } = useApp()
  return v2 ? <TickerV2 /> : <TickerBase />
}

// ---- v2: any mix of lists at once, each with its own display value ----
type LKey = 'active' | 'movers' | 'favs'
const LISTS: { k: LKey; label: string; Icon: typeof Flame }[] = [{ k: 'active', label: 'Most Active', Icon: Flame }, { k: 'movers', label: 'Top Movers', Icon: TrendingUp }, { k: 'favs', label: 'Favorites', Icon: Star }]
const DISP: { d: Disp; label: string; tip: string }[] = [{ d: 'pct', label: '%', tip: 'Percent change' }, { d: 'abs', label: '$Δ', tip: 'Absolute change' }, { d: 'px', label: 'Px', tip: 'Price' }]
const KEY = 'phx-v2-ticker'
const HANDLE = 24 // width of the draggable divider between two lanes

const itemsOf = (k: LKey, favs: string[]) => k === 'active' ? [...MARKETS].sort((a, b) => b.vol - a.vol).slice(0, 12).map(m => m.sym) : k === 'movers' ? TOP_MOVERS : favs

// v2: list + display controls. One list -> they sit inside the box; two lists -> each gets a control above its half.
function usePersist() {
  const { tkLanes: lanes, tkDisp: disp, tkSplit: split0, set } = useApp()
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(KEY + '2') || 'null'); if (v?.lanes && v?.disp) set({ tkLanes: v.lanes, tkDisp: v.disp, ...(typeof v.split === 'number' ? { tkSplit: v.split } : {}) }) } catch { /* ignore */ } }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { try { localStorage.setItem(KEY + '2', JSON.stringify({ lanes, disp, split: split0 })) } catch { /* ignore */ } }, [lanes, disp, split0])
}

function ListCtl({ lane }: { lane: 0 | 1 }) {
  const { tkLanes: lanes, tkDisp: disp, set } = useApp()
  const [open, setOpen] = useState(false)
  const pr = usePresence(open)
  useEscape(open, () => setOpen(false))
  const setLanes = (l: [LKey, LKey | null]) => set({ tkLanes: l })
  const pick = (k: LKey) => { if (lane === 0) setLanes([k, lanes[1] === k ? lanes[0] : lanes[1]]); else setLanes([lanes[0] === k ? (lanes[1] ?? lanes[0]) : lanes[0], k]) }
  const split = () => setLanes([lanes[0], LISTS.find(x => x.k !== lanes[0])!.k])
  const setD = (d: Disp) => { const n: [Disp, Disp] = [disp[0], disp[1]]; n[lane] = d; set({ tkDisp: n }) }
  const k = lanes[lane]!, cur = LISTS.find(x => x.k === k)!
  return (
    <div className="t-vc">
      <div style={{ position: 'relative' }}>
        <button className="t-vsel" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}><cur.Icon size={14} fill="currentColor" strokeWidth={2} />{cur.label}<ChevronDown size={12} className={`chv${open ? ' o' : ''}`} /></button>
        {pr.mounted && (<>{open && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />}
          <div className="t-pop pop-in" data-state={pr.state} style={{ left: 0, top: 26, width: 208, ['--pop-origin' as string]: 'top left' }}>
            <div className="lab">List</div>
            {LISTS.map(x => <button key={x.k} className={`it${x.k === k ? ' on' : ''}`} onClick={() => { pick(x.k); setOpen(false) }}><x.Icon size={14} fill="currentColor" strokeWidth={2} />{x.label}{x.k === k && <Check className="ck" size={16} />}</button>)}
            <hr /><div className="lab">Show for {cur.label}</div>
            {DISP.map(x => <button key={x.d} className={`it${disp[lane] === x.d ? ' on' : ''}`} onClick={() => { setD(x.d); setOpen(false) }}>{x.d === 'pct' ? <Percent size={14} /> : x.d === 'abs' ? <DollarSign size={14} /> : <Tag size={14} />}{x.tip}{disp[lane] === x.d && <Check className="ck" size={16} />}</button>)}
            {lane === 1 && <><hr /><button className="it" onClick={() => { setLanes([lanes[0], null]); setOpen(false) }}><X size={14} />Remove this list</button></>}
          </div></>)}
      </div>
      {lane === 0 && !lanes[1] && <button className="t-vadd" title="Show a second list side by side" aria-label="Add a second list" onClick={split}><Plus size={14} /></button>}
    </div>
  )
}

// the row above the box: only present (height animates 0 -> 34) while two lists are shown
export function TickerHead() {
  const { tkLanes: lanes, tkSplit: split0 } = useApp()
  usePersist()
  const two = !!lanes[1]
  // folder tabs attached to the top edge of the strip box: one per list, each sitting over the left end of its half
  return <div className={`t-v2head${two ? ' two' : ''}`} style={two ? { gridTemplateColumns: `minmax(0,${split0}fr) ${HANDLE}px minmax(0,${1 - split0}fr)` } : undefined}><ListCtl lane={0} />{two && <><span /><ListCtl lane={1} /></>}</div>
}

// Two-finger swipes, mouse wheel and click-drag all scroll a lane sideways.
function useLaneScroll() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const wheel = (e: WheelEvent) => { const d = Math.abs(e.deltaX) >= Math.abs(e.deltaY) ? e.deltaX : e.deltaY; if (el.scrollWidth <= el.clientWidth || !d) return; e.preventDefault(); el.scrollLeft += d }
    let sx = 0, sl = 0, down = false, moved = false
    const pd = (e: PointerEvent) => { if (e.pointerType !== 'mouse' || e.button !== 0) return; down = true; moved = false; sx = e.clientX; sl = el.scrollLeft }
    const pm = (e: PointerEvent) => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 4) { moved = true; el.style.cursor = 'grabbing' } if (moved) el.scrollLeft = sl - dx }
    const pu = () => { down = false; el.style.cursor = '' }
    const click = (e: MouseEvent) => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false } }
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu); el.addEventListener('click', click, true)
    return () => { el.removeEventListener('wheel', wheel); el.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); el.removeEventListener('click', click, true) }
  }, [])
  return ref
}

function TickerV2() {
  const { sym, set, favs, tickN, tkLanes: lanes, tkDisp: disp, tkSplit: split } = useApp()
  const router = useRouter()
  const sc = useRef<HTMLDivElement>(null), ref0 = useLaneScroll(), ref1 = useLaneScroll()
  const drag = useRef<boolean>(false)
  // drag the divider; each side stops at the width of its own list selector + display buttons, which move with it
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault(); drag.current = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); document.body.style.cursor = 'col-resize'; document.body.style.userSelect = 'none'
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current || !sc.current) return
    const box = sc.current.getBoundingClientRect(), pad = 4, total = box.width - pad * 2 - HANDLE
    const w = (i: number) => (document.querySelectorAll('.t-v2head .t-vc')[i] as HTMLElement | undefined)?.offsetWidth ?? 220
    const minL = w(0) + pad, minR = w(1) + pad
    const left = Math.min(Math.max(e.clientX - box.left - pad - HANDLE / 2, minL), Math.max(minL, total - minR))
    set({ tkSplit: +(left / total).toFixed(4) })
  }
  const onUp = (e: React.PointerEvent) => { drag.current = false; document.body.style.cursor = ''; document.body.style.userSelect = ''; try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId) } catch { /* ignore */ } }
  void tickN
  const go = (s: string) => { set({ sym: s }); router.push('/' + s) }
  const open24 = (s: string) => { const m = bySym(s); return m.px / (1 + m.chg / 100) }
  const chgOf = (s: string) => { const mk = E.marks[s] ?? bySym(s).px, o = open24(s); return ((mk - o) / o) * 100 }
  const val = (s: string, d: Disp) => {
    const m = bySym(s), mk = E.marks[s] ?? m.px, o = open24(s), chg = ((mk - o) / o) * 100, col = chg >= 0 ? 'buy' : 'sell', Arr = chg >= 0 ? TriUp : TriDown
    if (d === 'px') return <span className="v num">${fp(mk, m.dec)}</span>
    const tx = d === 'pct' ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : `${mk - o >= 0 ? '+' : '-'}$${fp(Math.abs(mk - o), m.dec)}`
    return <span className={`v num ${col}`}>{tx}{d === 'pct' && <Arr size={14} />}</span>
  }
  const e0 = useEdges(ref0), e1 = useEdges(ref1)
  const Lane = ({ lane }: { lane: 0 | 1 }) => {
    const k = lanes[lane]!, list = itemsOf(k, favs), rf = lane === 0 ? ref0 : ref1, ed = lane === 0 ? e0 : e1
    return (<div className="t-sh">
      <div className="t-gl" ref={rf}>
        {list.length === 0 && <span className="muted" style={{ fontSize: 13, padding: '0 8px', whiteSpace: 'nowrap' }}>Star a market to pin it here.</span>}
        {list.map(s => (
          <button key={k + s} className={`t-tchip${s === sym ? ' on' : ''}`} onClick={() => go(s)} aria-label={`Open ${s} market, ${chgOf(s) >= 0 ? 'up' : 'down'} ${Math.abs(chgOf(s)).toFixed(2)}% over the last 24 hours`}>
            <Logo sym={s} size={20} /><span className="sy">{s}</span>{val(s, disp[lane])}
          </button>
        ))}
      </div>
      <Edges el={rf} l={ed.l} r={ed.r} /></div>
    )
  }
  return (
    <div className={`t-tick v2 strip${lanes[1] ? ' two' : ''}`} ref={sc} style={lanes[1] ? { gridTemplateColumns: `minmax(0,${split}fr) ${HANDLE}px minmax(0,${1 - split}fr)` } : undefined}>
      {Lane({ lane: 0 })}
      {lanes[1] && <><div className="t-vmid" role="separator" aria-orientation="vertical" aria-label="Drag to resize the two lists" title="Drag to resize (double-click to reset)" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onDoubleClick={() => set({ tkSplit: 0.5 })}><i /><i /><i /></div>{Lane({ lane: 1 })}</>}
    </div>
  )
}

function TickerBase() {
  const { sym, set, favs, tickN, v2 } = useApp()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const pr = usePresence(open)
  useEscape(open, () => setOpen(false))
  const [mode0, setMode] = useState<Mode | null>(null)
  const mode: Mode = mode0 ?? (v2 ? 'active' : 'movers')
  const [disp, setDisp] = useState<Disp>('pct')
  const sc = useRef<HTMLDivElement>(null)
  void tickN
  const list = mode === 'active' ? [...MARKETS].sort((a, b) => b.vol - a.vol).slice(0, 10).map(m => m.sym) : mode === 'movers' ? TOP_MOVERS : favs
  const go = (s: string) => { set({ sym: s }); router.push('/' + s) }

  const chgOf = (s: string) => { const m = bySym(s), mk = E.marks[s] ?? m.px, o = m.px / (1 + m.chg / 100); return ((mk - o) / o) * 100 }
  const val = (s: string) => {
    const m = bySym(s), mk = E.marks[s] ?? m.px
    const open24 = m.px / (1 + m.chg / 100)
    const chg = ((mk - open24) / open24) * 100
    const col = chg >= 0 ? 'buy' : 'sell'
    const Arr = chg >= 0 ? TriUp : TriDown
    if (disp === 'px') return <span className="v num">${fp(mk, m.dec)}</span>
    const t = disp === 'pct' ? `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%` : `${mk - open24 >= 0 ? '+' : '-'}$${fp(Math.abs(mk - open24), m.dec)}`
    return <span className={`v num ${col}`}>{t}{disp === 'pct' && <Arr size={12} />}</span>
  }

  const Item = ({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) => (
    <button className={`it${on ? ' on' : ''}`} onClick={onClick}>{icon}{label}{on && <Check className="ck" size={16} strokeWidth={2} />}</button>
  )

  return (
    <div className="t-tick">
      <div style={{ position: 'relative' }}>
        <button className="t-tm" onClick={() => setOpen(o => !o)} aria-label={`Select market list, currently showing ${mode === 'active' ? 'Most Active' : mode === 'movers' ? 'Top Movers' : 'Favorites'}`}>
          {mode !== 'favs' ? <Flame className="fl" size={14} fill="currentColor" strokeWidth={2} /> : <Star className="fl" size={14} fill="currentColor" strokeWidth={2} />}
          {mode === 'active' ? 'Most Active' : mode === 'movers' ? 'Top Movers' : 'Favorites'}
          <ChevronDown size={12} className={`chv${open ? ' o' : ''}`} />
        </button>
        {pr.mounted && (<>
          {open && <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setOpen(false)} />}
          <div className="t-pop tm pop-in" data-state={pr.state} style={{ left: 0, top: 34, width: 192, ['--pop-origin' as string]: 'top left' }}>
            {v2 && <Item on={mode === 'active'} onClick={() => { setMode('active'); setOpen(false) }} icon={<Flame size={14} fill="currentColor" strokeWidth={2} />} label="Most Active" />}
            <Item on={mode === 'movers'} onClick={() => { setMode('movers'); setOpen(false) }} icon={<Flame size={14} fill="currentColor" strokeWidth={2} />} label="Top Movers" />
            <Item on={mode === 'favs'} onClick={() => { setMode('favs'); setOpen(false) }} icon={<Star size={14} fill="currentColor" strokeWidth={2} />} label="Favorites" />
            <hr />
            <div className="lab">Display value</div>
            <Item on={disp === 'pct'} onClick={() => setDisp('pct')} icon={<Percent size={14} />} label="Percent Change" />
            <Item on={disp === 'abs'} onClick={() => setDisp('abs')} icon={<DollarSign size={14} />} label="Absolute Change" />
            <Item on={disp === 'px'} onClick={() => setDisp('px')} icon={<Tag size={14} />} label="Price" />
          </div>
        </>)}
      </div>
      <span className="t-tsep" />
      <div className="t-tscroll" ref={sc}>
        {list.length === 0 && <span className="muted" style={{ fontSize: 12, padding: '0 8px' }}>No favorites yet. Star a market to pin it here.</span>}
        {list.map(s => (
          <button key={s} className={`t-tchip${s === sym ? ' on' : ''}`} onClick={() => go(s)} aria-label={`Open ${s} market, ${chgOf(s) >= 0 ? 'up' : 'down'} ${Math.abs(chgOf(s)).toFixed(2)}% over the last 24 hours`}>
            <Logo sym={s} size={18} /><span className="sy">{s}</span>{val(s)}
          </button>
        ))}
        {mode === 'movers' && MARKETS.length > 0 && <span style={{ flex: '0 0 40px' }} />}
      </div>
      <button className="t-tarr" onClick={() => sc.current?.scrollBy({ left: 280 })} aria-label="Scroll markets right"><ChevronRight size={14} /></button>
    </div>
  )
}

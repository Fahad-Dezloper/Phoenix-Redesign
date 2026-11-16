'use client'
import { useEffect, useRef, useState, type RefObject, type ReactNode } from 'react'
import { TriDown } from '@/components/icons/Phx'

// Tracks whether a horizontally scrolling element has more content off either edge.
export function useEdges(ref: RefObject<HTMLElement>) {
  const [e, setE] = useState({ l: false, r: false })
  const [el, setEl] = useState<HTMLElement | null>(null)
  useEffect(() => { if (ref.current !== el) setEl(ref.current) }) // the element can mount later (e.g. a second list)
  useEffect(() => {
    if (!el) return
    const f = () => { const l = el.scrollLeft > 2, r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2; setE(p => (p.l === l && p.r === r ? p : { l, r })) }
    f(); el.addEventListener('scroll', f, { passive: true })
    const ro = new ResizeObserver(f); ro.observe(el); [...el.children].forEach(c => ro.observe(c))
    const mo = new MutationObserver(f); mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => { el.removeEventListener('scroll', f); ro.disconnect(); mo.disconnect() }
  }, [el])
  return e
}

// Shadow + chevron at an edge that still has hidden content, like Backpack's top bar. Clicking the chevron scrolls one page.
export function Edges({ el, l, r }: { el: RefObject<HTMLElement>; l: boolean; r: boolean }) {
  const go = (d: 1 | -1) => el.current?.scrollBy({ left: d * Math.max(120, el.current.clientWidth * 0.7), behavior: 'smooth' })
  return (<>
    <button type="button" tabIndex={l ? 0 : -1} aria-hidden={!l} aria-label="Scroll left" className={`t-edge l${l ? ' on' : ''}`} onClick={() => go(-1)}><TriDown size={16} style={{ transform: 'rotate(90deg)' }} /></button>
    <button type="button" tabIndex={r ? 0 : -1} aria-hidden={!r} aria-label="Scroll right" className={`t-edge r${r ? ' on' : ''}`} onClick={() => go(1)}><TriDown size={16} style={{ transform: 'rotate(-90deg)' }} /></button>
  </>)
}

export function HintScroll({ className, children }: { className: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null), e = useEdges(ref)
  return <div className="t-sh"><div className={className} ref={ref}>{children}</div><Edges el={ref} l={e.l} r={e.r} /></div>
}

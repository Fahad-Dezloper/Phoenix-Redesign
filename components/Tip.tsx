'use client'
// A label with a dotted underline that explains itself on hover or keyboard focus.
// The tooltip is rendered into <body> with fixed positioning, so scrolling panels can never clip or misplace it.
import { useState } from 'react'
import { createPortal } from 'react-dom'

export default function Tip({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  const [at, setAt] = useState<{ x: number; y: number; up: boolean } | null>(null)
  const on = (e: { currentTarget: Element }) => {
    const r = e.currentTarget.getBoundingClientRect(), up = r.top > 200
    setAt({ x: Math.min(Math.max(r.left + r.width / 2, 124), window.innerWidth - 124), y: up ? r.top : r.bottom, up })
  }
  return (
    <>
      <span className={'dtip' + (className ? ' ' + className : '')} tabIndex={0} onMouseEnter={on} onMouseLeave={() => setAt(null)} onFocus={on} onBlur={() => setAt(null)}>{label}</span>
      {at && typeof document !== 'undefined' && createPortal(
        <div className={`t-sptip${at.up ? ' up' : ''}`} role="tooltip" style={{ position: 'fixed', left: at.x, top: at.y, zIndex: 100 }}>{children}</div>, document.body)}
    </>
  )
}

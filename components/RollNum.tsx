'use client'
// Rolling digits: each digit is a 0-9 column that slides to its value when the number changes.
// Unchanged digits keep their transform, so they don't move. Characters are keyed from the right,
// so "$9.99" -> "$10.00" keeps the cents columns in place and only grows on the left.
// Screen readers get the whole value via aria-label; the columns are aria-hidden.
// Motion is transform-only and is switched off under prefers-reduced-motion (see .rn in trade.css).
import { memo } from 'react'

const COL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9']

function RollNum({ value, className }: { value: string; className?: string }) {
  const chars = Array.from(value), n = chars.length
  return (
    <span className={'rn num' + (className ? ' ' + className : '')} role="img" aria-label={value}>
      {chars.map((ch, i) => {
        const k = n - i // position from the right
        return /\d/.test(ch)
          ? <span key={'d' + k} className="rn-d" aria-hidden><span className="rn-c" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>{COL.map(d => <i key={d}>{d}</i>)}</span></span>
          : <span key={'s' + k + ch} className="rn-s" aria-hidden>{ch}</span>
      })}
    </span>
  )
}
export default memo(RollNum)

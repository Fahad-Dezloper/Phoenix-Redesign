import type { ReactNode } from 'react'
import Link from 'next/link'
import { TERMS, PRIVACY } from './legalDocs'
import './pages.css'

// turns https://… and the 1.1-style lead-ins into the link / bold treatment of the live page
const rich = (t: string): ReactNode[] =>
  t.split(/(https?:\/\/[^\s)]+?(?=[.,]?(?:\s|$|\))))/g).map((s, i) => (/^https?:/.test(s) ? <a key={i} href={s}>{s}</a> : s))
function Para({ t }: { t: string }) {
  const m = t.match(/^(\d+\.\d+ [^.]+\.)\s(.*)$/s)
  const lead = !m && /^[A-Z][A-Za-z ,/&-]{3,40}\.\s/.test(t) ? t.match(/^([^.]+\.)\s(.*)$/s) : m
  return <p>{lead ? <><b>{lead[1]}</b> {rich(lead[2])}</> : rich(t)}</p>
}
export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' }) {
  const blocks = doc === 'terms' ? TERMS : PRIVACY
  return (
    <div className="lg">
      <div className="lg-logo"><Link href="/" aria-label="Back to Phoenix"><img src="/mark.svg" alt="" /><span>PHOENIX</span></Link></div>
      {blocks.map(([k, t], i) =>
        k === 'title' ? <h1 key={i}>{t}</h1> : k === 'h2' ? <h2 key={i}>{t}</h2> : k === 'up' ? <p key={i} className="up">{rich(t)}</p> : k === 'meta' ? <p key={i}>{t}</p> : (t.length > 60 && (t.replace(/https?:\/\/\S+/g, '') === t.replace(/https?:\/\/\S+/g, '').toUpperCase())) ? <p key={i} className="up">{rich(t)}</p> : <Para key={i} t={t} />)}
    </div>
  )
}

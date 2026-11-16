'use client'
// A link to a page that is not part of the redesign: instead of opening it, say so.
import { useApp } from '@/lib/store'
export default function Unbuilt({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const { say } = useApp()
  return <a href={href} className={className} onClick={e => { e.preventDefault(); say('Not redesigned. This page is unchanged from the current Phoenix, so it is not part of this demo.', 'info', 4500) }}>{children}</a>
}

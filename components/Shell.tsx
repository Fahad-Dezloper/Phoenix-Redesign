'use client'
import { useEffect, useState } from 'react'
import { Provider } from '@/lib/store'
import Nav from './Nav'
import GhostBanner from './GhostBanner'
import Toasts from './Toasts'
import Dialogs from './dialogs/Dialogs'
import Footer from './Footer'
import Dock from './Dock'
import GhostDock from './GhostDock'
import { useApp } from '@/lib/store'

const SHOW_DOCK = false // the floating dock was tried and dropped: the links live in the top bar again
function DockV2() { const v2 = useApp().v2; useEffect(() => { document.documentElement.toggleAttribute('data-v2', v2); try { const t = new URLSearchParams(location.search).get('theme'); /* default = Carbon 1 Soot; ?theme=ember|ink|plum|paper previews another, nothing is remembered */ if (t) document.documentElement.setAttribute('data-theme', t); else document.documentElement.removeAttribute('data-theme') } catch { /* ignore */ } }, [v2]); return v2 && SHOW_DOCK ? <Dock /> : null }

// The app is all live mock data (clocks, prices, random candles), so it renders on the client only; this avoids hydration mismatches.
export default function Shell({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false), [narrow, setNarrow] = useState(false)
  useEffect(() => {
    setMounted(true)
    const mq = window.matchMedia('(max-width: 639px)'), f = () => setNarrow(mq.matches)
    f(); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f)
  }, [])
  if (!mounted) return <div className="app" />
  // phones: the redesign is not designed for them yet, so say so instead of showing a broken layout
  if (narrow) return (
    <main className="uc" role="status">
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 20h16M6 20V9l6-5 6 5v11M10 20v-6h4v6" /></svg>
      <h1>Phoenix on mobile is under construction</h1>
      <p>This demo is built for tablets and desktop. Open it on a larger screen to try the new trading experience.</p>
    </main>
  )
  return (
    <Provider>
      <div className="app">
        <Nav />
        <GhostBanner />
        <div className="content">{children}</div>
        <Footer />
        <DockV2 />
        <GhostDock />
      </div>
      <Dialogs />
      <Toasts />
    </Provider>
  )
}

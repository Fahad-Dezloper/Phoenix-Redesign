'use client'
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Calendar, Check, ChevronDown, Languages, X } from 'lucide-react'
import { useApp, type Settings, type ChartOpts } from '@/lib/store'
import { usePresence } from '@/lib/presence'
import './st.css'

// settings the shared store has no field for are kept here so they survive closing the dialog
const LS = 'phx-web-settings-extra'
// (v1 only: v2 binds every switch to the store, so the chart and the order form react)
const extra = { oneClick: true, slip: '1', tpSlip: '0.25', slSlip: '10' }
try { Object.assign(extra, JSON.parse(localStorage.getItem(LS) || '{}')) } catch { /* ignore */ }
let openMenus = 0
// lucide 'decimals-arrow-right' (not in the installed lucide-react build) -- exact production geometry
const DecimalsArrowRight = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 18h10" /><path d="m17 21 3-3-3-3" /><path d="M3 11h.01" /><rect x="15" y="3" width="5" height="8" rx="2.5" /><rect x="6" y="3" width="5" height="8" rx="2.5" /></svg>

function Tg({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return <button role="switch" aria-checked={on} aria-label={label} className={'sx-tg' + (on ? ' on' : '')} onClick={() => set(!on)}><i /></button>
}
// Max slippage, bound to the order form's own value (the Slippage popover under Place Order edits the same number)
function SlipInput({ label, value, onSet }: { label: string; value: number; onSet: (v: number) => void }) {
  const [d, setD] = useState<string | null>(null)
  return <div className="sx-slip">{label}<input className="sx-inp" aria-label={label} inputMode="decimal" value={d ?? value + '%'} onFocus={() => setD(String(value))} onBlur={() => setD(null)}
    onChange={e => { const t = e.target.value.replace(/[^0-9.]/g, ''); setD(t); const v = parseFloat(t); if (v > 0 && v <= 50) onSet(v) }} /></div>
}
function Sel({ value, opts, onPick, label, disabled = [] }: { value: string; opts: string[]; onPick: (v: string) => void; label: string; disabled?: string[] }) {
  const [o, setO] = useState(false), btn = useRef<HTMLButtonElement>(null), menu = useRef<HTMLDivElement>(null), pr = usePresence(o)
  const [pos, setPos] = useState({ top: 0, right: 0 })
  useLayoutEffect(() => { if (o && btn.current) { const b = btn.current.getBoundingClientRect(); setPos({ top: b.bottom + 8, right: window.innerWidth - b.right }) } }, [o])
  useEffect(() => {
    if (!o) return
    openMenus++
    const h = (e: MouseEvent) => { const t = e.target as Node; if (btn.current?.contains(t) || menu.current?.contains(t)) return; setO(false) }
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); setO(false) } }
    document.addEventListener('mousedown', h); window.addEventListener('keydown', k, true)
    return () => { openMenus--; document.removeEventListener('mousedown', h); window.removeEventListener('keydown', k, true) }
  }, [o])
  return (
    <div className="sx-sel">
      <button ref={btn} className="sx-selbtn" role="combobox" aria-label={label} aria-expanded={o} onClick={() => setO(v => !v)}>{value}<ChevronDown /></button>
      {pr.mounted && createPortal(
        <div ref={menu} className="sx-menu pop-in" role="listbox" data-state={pr.state} style={{ top: pos.top, right: pos.right }}>
          {opts.map(x => disabled.includes(x)
            ? <button key={x} role="option" aria-selected={false} aria-disabled className="sx-opt" style={{ opacity: 0.5, cursor: 'default' }} onClick={e => e.preventDefault()}>{x}</button>
            : <button key={x} role="option" aria-selected={x === value} className={'sx-opt' + (x === value ? ' on' : '')} onClick={() => { onPick(x); setO(false) }}>{x}{x === value && <Check />}</button>)}
        </div>, document.body)}
    </div>
  )
}

export default function SettingsDialog() {
  const { dialog, closeDialog, settings, set, settingsTab, signedIn, acct, v2, form, setForm } = useApp()
  const [, bump] = useState(0)
  useEffect(() => { if (dialog !== 'settings') return; const k = (e: KeyboardEvent) => { if (e.key === 'Escape') closeDialog() }; document.addEventListener('keydown', k); return () => document.removeEventListener('keydown', k) }, [dialog, closeDialog])
  if (dialog !== 'settings') return null
  const upd = (p: Partial<Settings>) => set({ settings: { ...settings, ...p } })
  const ex = <K extends keyof typeof extra>(k: K, v: (typeof extra)[K]) => { extra[k] = v; try { localStorage.setItem(LS, JSON.stringify(extra)) } catch { /* ignore */ } bump(x => x + 1) }
  const tab = settingsTab
  const tg = (title: string, sub: string | null, on: boolean, f: (v: boolean) => void) => (
    <div className={'sx-trow' + (sub ? '' : ' sx-single')}><Tg on={on} set={f} label={title} /><div className="sx-tx">{title}{sub && <p>{sub}</p>}</div></div>
  )
  const co = settings.chartOpts, cset = (k: keyof ChartOpts) => (v: boolean) => upd({ chartOpts: { ...co, [k]: v } })
  const slip = (label: string, k: 'slip' | 'tpSlip' | 'slSlip') => (
    <div className="sx-slip">{label}<input className="sx-inp" aria-label={label} value={extra[k] + '%'} onChange={e => ex(k, e.target.value.replace(/[^0-9.]/g, ''))} /></div>
  )
  const sec = (h: string, ...c: React.ReactNode[]) => <div className="sx-sec"><div className="sx-h">{h}</div>{c.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</div>
  return (
    <div className="ov" onMouseDown={e => { if (e.target === e.currentTarget && !openMenus) closeDialog() }}>
      <div className="modal sx-modal" role="dialog" aria-label="Settings">
        <div className="sx-hd"><h2>Settings</h2><button className="sx-x" aria-label="Close dialog" onClick={closeDialog}><X size={20} /></button></div>
        <div className="sx-tabs" role="tablist">{(['General', 'Trading', 'Chart'] as const).map(t => <button key={t} role="tab" aria-selected={tab === t} className={'sx-tab' + (tab === t ? ' on' : '')} onClick={() => set({ settingsTab: t })}>{t}</button>)}</div>
        <div className="sx-body">
          {tab === 'General' && (<>
            <div className="sx-row"><h2 className="sx-lab"><Languages />Language</h2><Sel label="Language" value="English" opts={['English', 'More languages soon']} disabled={['More languages soon']} onPick={() => upd({ language: 'English' })} /></div>
            <div className="sx-row"><h2 className="sx-lab"><DecimalsArrowRight />Number Format</h2><Sel label="Number Format" value={settings.numberFormat} opts={['1,234.56', '1.234,56']} onPick={v => upd({ numberFormat: v })} /></div>
            <div className="sx-row"><h2 className="sx-lab"><Calendar />Date Format</h2><Sel label="Date Format" value={settings.dateFormat} opts={['MM/DD/YY', 'DD/MM/YYYY', 'YYYY-MM-DD']} onPick={v => upd({ dateFormat: v })} /></div>
            <div className="sx-row"><div className="sx-lab sx-d"><h2>Blockchain Explorer</h2><p>Choose where to view transactions on-chain</p></div><Sel label="Blockchain Explorer" value={settings.explorer} opts={['Solscan', 'Solana Explorer', 'SolanaFM', 'Orb']} onPick={v => upd({ explorer: v })} /></div>
            <div className="sx-row"><div className="sx-lab sx-d"><h2>Notification Duration</h2><p>Choose how long notifications stay visible</p></div><Sel label="Notification Duration" value={settings.notifySecs + (settings.notifySecs === 1 ? ' second' : ' seconds')} opts={[1, 2, 3, 4, 5, 6].map(n => n + (n === 1 ? ' second' : ' seconds'))} onPick={v => upd({ notifySecs: parseInt(v) })} /></div>
            <div style={{ paddingTop: 16 }}>{tg('Public Leaderboard', 'Show your account on the public leaderboard', settings.publicBoard, v => upd({ publicBoard: v }))}</div>
          </>)}
          {tab === 'Trading' && v2 && (<>
            {/* v2: Place Order is already one click with no confirmation dialog, so the Order Confirmation switches have nothing to change and are not shown */}
            {sec('Order Form', tg('Reset order form after placing an order', 'Turn off to keep size and collateral for your next order', settings.resetForm, v => upd({ resetForm: v })))}
            {sec('Slippage', <SlipInput key="s" label="Max Slippage" value={form.slippage} onSet={v => setForm({ slippage: v })} />)}
          </>)}
          {tab === 'Chart' && v2 && (<>
            {sec('Order Form Lines', tg('Limit Price', null, co.formLimit, cset('formLimit')), tg('Estimated Liquidation', null, co.formLiq, cset('formLiq')), tg('Estimated Entry', null, co.formEntry, cset('formEntry')), tg('Take Profit / Stop Loss', null, co.formTpsl, cset('formTpsl')))}
            {sec('Limit Order Lines', tg('Open Orders', null, co.orders, cset('orders')))}
            {sec('Trade History Marks', tg('Order History Marks', null, co.marks, cset('marks')))}
            {sec('Position Lines', tg('Entry Price', null, settings.showPositionLines, v => upd({ showPositionLines: v })))}
          </>)}
          {tab === 'Trading' && !v2 && (<>
            {sec('Order Confirmation',
              tg('Hide order confirmation', 'Hide confirmation dialog before executing trades', !settings.confirmOrders, v => upd({ confirmOrders: !v })),
              tg(signedIn ? 'One-Click Trading for ' + acct.addr.replace('…', '...') : 'One-Click Trading', 'Enable for faster trading actions', extra.oneClick, v => ex('oneClick', v)))}
            {sec('Order Form', tg('Reset order form after placing an order', 'Turn off to keep size and collateral for your next order', settings.resetForm, v => upd({ resetForm: v })))}
            {sec('Slippage', slip('Max Slippage', 'slip'), slip('Take Profit Max Slippage', 'tpSlip'), slip('Stop Loss Max Slippage', 'slSlip'))}
          </>)}
          {tab === 'Chart' && !v2 && (<>
            {sec('Order Form Lines', tg('Limit Price', null, co.formLimit, cset('formLimit')), tg('Estimated Liquidation', null, co.formLiq, cset('formLiq')), tg('Estimated Entry', null, co.formEntry, cset('formEntry')), tg('Take Profit / Stop Loss', null, co.formTpsl, cset('formTpsl')))}
            {sec('Limit Order Lines', tg('Open Orders', null, co.orders, cset('orders')))}
            {sec('Trade History Marks', tg('Order History Marks', null, co.marks, cset('marks')))}
            {sec('Position Lines', tg('Entry Price', null, settings.showPositionLines, v => upd({ showPositionLines: v })))}
          </>)}
        </div>
      </div>
    </div>
  )
}

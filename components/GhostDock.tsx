'use client'
// Ghost Mode, redesigned: a small row of avatars above the footer. "You" plus up to three traders you are watching.
// Click an avatar to see that account on the trade screen instantly; "+" adds another trader; the little x removes one.
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Check, ImagePlus, Pencil, Plus, Search, UserMinus } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ALL } from '@/lib/data'
import { userAccount } from '@/lib/account'

const MAX = 3
const short = (a: string) => (a.length > 12 ? a.slice(0, 4) + '…' + a.slice(-4) : a)
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 }
export const traderInfo = (a: string) => ALL.find(t => t.addr === a || a.startsWith(t.addr.slice(0, 4)))
const money = (n: number) => (n < 0 ? '-' : '+') + '$' + Math.abs(Math.round(n)).toLocaleString('en-US')
const HUES = [18, 42, 96, 160, 200, 250, 290, 335]

// avatars the user picked (a colour or an uploaded photo), kept in this browser
type Look = { hue?: number; img?: string }
let looks: Record<string, Look> = {}
try { looks = JSON.parse(localStorage.getItem('phx-avatars') || '{}') } catch { /* ignore */ }
const subs = new Set<() => void>()
const setLook = (a: string, l: Look) => { looks = { ...looks, [a]: l }; try { localStorage.setItem('phx-avatars', JSON.stringify(looks)) } catch { /* ignore */ } subs.forEach(f => f()) }
const useLooks = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => looks, () => looks)

// a small symmetric pattern, unique to each address (5x5, mirrored), on a dark disc; or the photo the user chose
export function Identicon({ addr, size = 32, hue: hueOver, img }: { addr: string; size?: number; hue?: number; img?: string }) {
  const L = useLooks()[addr]
  const photo = img ?? L?.img
  if (photo) return <img src={photo} width={size} height={size} alt="" style={{ objectFit: 'cover', display: 'block' }} />
  const h = hash(addr), hue = hueOver ?? L?.hue ?? h % 360
  const cells: [number, number][] = []
  for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if ((h >> (r * 3 + c)) & 1) { cells.push([c, r]); if (c < 2) cells.push([4 - c, r]) }
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" aria-hidden>
      <rect width="30" height="30" fill={`hsl(${hue} 22% 16%)`} />
      {cells.map(([c, r]) => <rect key={c + '-' + r} x={5 + c * 4} y={5 + r * 4} width="4" height="4" rx="0.8" fill={`hsl(${hue} 62% 68%)`} />)}
    </svg>
  )
}

const shrink = (f: File) => new Promise<string>(res => {
  const r = new FileReader()
  r.onload = () => { const im = new Image(); im.onload = () => { const c = document.createElement('canvas'); c.width = c.height = 96; const x = c.getContext('2d')!; const m = Math.min(im.width, im.height); x.drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, 96, 96); res(c.toDataURL('image/jpeg', 0.82)) }; im.src = r.result as string }
  r.readAsDataURL(f)
})

export default function GhostDock() {
  const { ghost, watch, watchAdd, watchRemove, exitGhost, signedIn, v2 } = useApp()
  const router = useRouter(), path = usePathname()
  const onMarket = /^\/[A-Z0-9]{2,6}$/.test(path) // the trade screen of some market
  const toTrade = () => { if (!onMarket) router.push('/SOL') }
  const [open, setOpen] = useState(false), [q, setQ] = useState('')
  const [look, setLookSt] = useState<{ addr: string; edit: boolean; hue?: number; img?: string } | null>(null)
  const [menu, setMenu] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null), file = useRef<HTMLInputElement>(null)
  const close = () => { setOpen(false); setQ(''); setLookSt(null) }
  useEffect(() => {
    if (!open && !menu) return
    const out = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) { close(); setMenu(null) } }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') { if (menu) setMenu(null); else if (look) setLookSt(null); else close() } }
    document.addEventListener('mousedown', out); window.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', out); window.removeEventListener('keydown', esc) }
  })
  const list = useMemo(() => {
    const f = q.trim().toLowerCase()
    return ALL.filter(t => !watch.includes(t.addr) && (!f || t.addr.toLowerCase().includes(f) || ('#' + t.rank) === f || String(t.rank) === f))
  }, [q, watch])
  // <html data-gd> while the dock shows (the positions list makes room for it); <html data-ghost> while viewing another trader (cursor changes)
  const showDock = !!v2 && watch.length > 0
  useEffect(() => { const h = document.documentElement; h.toggleAttribute('data-gd', showDock); return () => h.removeAttribute('data-gd') }, [showDock])
  useEffect(() => { const h = document.documentElement; h.toggleAttribute('data-ghost', !!v2 && !!ghost); return () => h.removeAttribute('data-ghost') }, [v2, ghost])
  if (!v2 || !watch.length) return null // no traders watched: the dock goes away

  const typed = q.trim(), canPaste = typed.length >= 8 && !list.length
  const full = watch.length >= MAX
  const me = !ghost
  const confirm = () => {
    if (!look) return
    setLook(look.addr, look.img ? { img: look.img } : look.hue !== undefined ? { hue: look.hue } : {})
    if (!look.edit && !watchAdd(look.addr)) return
    if (!look.edit) toTrade()
    close()
  }

  return (
    <div className="gd" ref={box} role="toolbar" aria-label="Switch between your account and the traders you are watching">
      {open && !look && (
        <div className="gd-pop" role="dialog" aria-label="Watch a trader">
          <div className="gd-ph"><b>Watch a trader</b><span>{watch.length} of {MAX}</span></div>
          <label className="gd-search"><Search size={14} /><input autoFocus placeholder="Search rank or paste an address" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { if (list[0]) setLookSt({ addr: list[0].addr, edit: false }); else if (canPaste) setLookSt({ addr: typed, edit: false }) } }} /></label>
          <div className="gd-list">
            {list.map(t => (
              <button key={t.addr} className="gd-row" onClick={() => setLookSt({ addr: t.addr, edit: false })}>
                <span className="rk">{t.rank}</span>
                <span className="av"><Identicon addr={t.addr} size={28} /></span>
                <span className="nm"><b>{t.addr}</b></span>
                <span className={'pl num ' + (t.pnl >= 0 ? 'buy' : 'sell')}>{money(t.pnl)}</span>
              </button>
            ))}
            {canPaste && <button className="gd-row" onClick={() => setLookSt({ addr: typed, edit: false })}><span className="rk">·</span><span className="av"><Identicon addr={typed} size={28} /></span><span className="nm"><b>{short(typed)}</b><em>Watch this address</em></span></button>}
            {!list.length && !canPaste && <div className="gd-empty">No traders match. Paste a full address to watch it.</div>}
          </div>
          <p className="gd-note">Top 100 by 1D PnL. Watch up to {MAX} and switch instantly.</p>
        </div>
      )}
      {look && (
        <div className="gd-pop gd-look" role="dialog" aria-label="Choose an avatar">
          <div className="gd-ph"><b>{look.edit ? 'Edit avatar' : 'Choose an avatar'}</b><button className="gd-back" onClick={() => (look.edit ? close() : setLookSt(null))}>{look.edit ? 'Cancel' : 'Back'}</button></div>
          <div className="gd-prev"><span className="big"><Identicon addr={look.addr} size={72} hue={look.hue} img={look.img} /></span><b>{short(look.addr)}</b>{traderInfo(look.addr) && <em>Rank #{traderInfo(look.addr)!.rank}</em>}</div>
          <div className="gd-sw" role="radiogroup" aria-label="Colour">
            {HUES.map(h => <button key={h} role="radio" aria-checked={look.hue === h && !look.img} aria-label={`Colour ${h}`} className={look.hue === h && !look.img ? 'on' : ''} style={{ background: `hsl(${h} 62% 68%)` }} onClick={() => setLookSt({ ...look, hue: h, img: undefined })} />)}
          </div>
          <input ref={file} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setLookSt({ ...look, img: await shrink(f) }) }} />
          <button className="gd-up" onClick={() => file.current?.click()}><ImagePlus size={14} />Upload a photo</button>
          <button className="gd-go" onClick={confirm}>{look.edit ? <><Check size={14} />Save</> : 'Watch this trader'}</button>
        </div>
      )}
      <div className="gd-bar">
        <button className={'gd-av me' + (me ? ' on' : '')} aria-pressed={me} aria-label="Your account" onClick={() => exitGhost()}>
          <span className="disc"><img src="/img/wallets/phantom.svg" alt="" width={18} height={18} /></span>
          <span className="tip"><b>You</b><em>{signedIn ? userAccount().addr : 'Not signed in'}</em></span>
        </button>
        <span className="gd-sep" />
        {watch.map(a => {
          const t = traderInfo(a), on = ghost === a
          return (
            <div key={a} className="gd-wrap">
              {menu === a && (
                <div className="gd-menu" role="menu">
                  <div className="mh"><b>{short(a)}</b>{t && <em>Rank #{t.rank}</em>}</div>
                  <button role="menuitem" onClick={() => { const l = looks[a]; setMenu(null); setOpen(false); setLookSt({ addr: a, edit: true, hue: l?.hue, img: l?.img }) }}><Pencil size={13} />Change avatar</button>
                  <button role="menuitem" className="rm" onClick={() => { setMenu(null); watchRemove(a) }}><UserMinus size={13} />Stop watching</button>
                </div>
              )}
              <button className={'gd-av' + (on ? ' on' : '')} aria-pressed={on} aria-haspopup="menu" aria-expanded={menu === a} aria-label={`Watch ${short(a)}`}
                onClick={() => { if (on) setMenu(m => (m === a ? null : a)); else { setMenu(null); watchAdd(a); toTrade() } }}
                onContextMenu={e => { e.preventDefault(); setOpen(false); setMenu(a) }}>
                <span className="disc"><Identicon addr={a} size={32} /></span>
                {menu !== a && <span className="tip"><b>{short(a)}</b><em>{t ? `Rank #${t.rank} · ${money(t.pnl)} (1D)` : 'Read-only view'}{on ? ' · click for options' : ''}</em></span>}
              </button>
            </div>
          )
        })}
        {!full && (
          <button className={'gd-add' + (open ? ' on' : '')} aria-label="Watch another trader" aria-expanded={open} onClick={() => { setLookSt(null); setOpen(o => !o) }}>
            <Plus size={16} strokeWidth={2.2} />
            <span className="tip"><b>Add another</b><em>{MAX - watch.length} left</em></span>
          </button>
        )}
      </div>
    </div>
  )
}

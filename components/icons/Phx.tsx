'use client'
import { PHX_SVG } from '@/lib/phx-svgs'
import { TV_SVG } from '@/lib/tv-svgs'
import type { CSSProperties } from 'react'

// Renders an exact production SVG, sized by the wrapper (the svg fills it).
function Raw({ html, w, h, className, style, label }: { html: string; w: number; h: number; className?: string; style?: CSSProperties; label?: string }) {
  const svg = html.replace(/<svg([^>]*?)>/, (_m, attrs: string) => `<svg${attrs.replace(/\s(width|height)="[^"]*"/g, '')} width="${w}" height="${h}">`)
  return <i className={className} aria-label={label} role={label ? 'img' : undefined} aria-hidden={label ? undefined : true} style={{ display: 'inline-flex', width: w, height: h, flex: 'none', ...style }} dangerouslySetInnerHTML={{ __html: svg }} />
}
export const PhoenixLogo = ({ className, width = 110 }: { className?: string; width?: number }) => <Raw html={PHX_SVG.logo} w={width} h={width === 110 ? 18 : (width * 32) / 195} className={className} label="Phoenix" style={{ display: 'block' }} />
export const PhoenixMark = ({ size = 16, className, style }: { size?: number; className?: string; style?: CSSProperties }) => <Raw html={PHX_SVG.mark} w={size} h={size} className={className} style={style} />
export const TriDown = ({ size = 12, className, style }: { size?: number; className?: string; style?: CSSProperties }) => <Raw html={PHX_SVG.triDown} w={size} h={(size * 7) / 12} className={className} style={style} />
export const TriUp = ({ size = 12, className, style }: { size?: number; className?: string; style?: CSSProperties }) => <Raw html={PHX_SVG.triDown} w={size} h={(size * 7) / 12} className={className} style={{ transform: 'rotate(180deg)', ...style }} />
export const BookLayoutIcon = ({ size = 16, className }: { size?: number; className?: string }) => <Raw html={PHX_SVG.both} w={size} h={size} className={className} />
export const XLogo = ({ size = 12, className }: { size?: number; className?: string }) => <Raw html={PHX_SVG.x} w={size} h={size * 1.0225} className={className} />
export const DiscordLogo = ({ size = 16, className }: { size?: number; className?: string }) => <Raw html={PHX_SVG.discord} w={size} h={size} className={className} />
// TradingView toolbar glyphs: name = TradingView tooltip text, e.g. 'Trend Line', 'Fib Retracement', 'Measure', 'Zoom In', 'Magnet Mode snaps drawings pla…'
export const TvIcon = ({ name, size = 28, className, style }: { name: string; size?: number; className?: string; style?: CSSProperties }) => {
  const html = TV_SVG[name]; if (!html) return null
  const m = html.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/), vw = m ? +m[1] : size, vh = m ? +m[2] : size
  return <Raw html={html} w={size} h={(size * vh) / vw} className={className} style={style} />
}
export const UnifoldLogo = ({ className }: { className?: string }) => <Raw html={PHX_SVG.unifold} w={128} h={13} className={className} label="Unifold" />

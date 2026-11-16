// Mock market + trader data for the Phoenix web replica. Numbers are taken from the live site on 9-10 Nov 2026.
export type Cat = 'crypto' | 'stock' | 'commodity' | 'preipo'
export type Market = { sym: string; name: string; cat: Cat; lev: number; px: number; chg: number; vol: number; oi: number; fund: number; dec: number; cap?: string }
const M = (sym: string, name: string, cat: Cat, lev: number, px: number, chg: number, vol: number, oi: number, fund: number, dec: number, cap?: string): Market => ({ sym, name, cat, lev, px, chg, vol, oi, fund, dec, cap })
export const MARKETS: Market[] = [
  M('SOL', 'Solana', 'crypto', 25, 86.33, -3.61, 13.22e6, 5.45e6, 0.0012, 2, '$50.81B'),
  M('BTC', 'Bitcoin', 'crypto', 40, 74579, -1.74, 11.98e6, 1.39e6, 0.0012, 0, '$1.49T'),
  M('HYPE', 'Hyperliquid', 'crypto', 10, 74.69, -2.99, 2.47e6, 330e3, 0.0012, 2, '$25.1B'),
  M('ETH', 'Ethereum', 'crypto', 25, 2120.7, -5.02, 2.3e6, 948.5e3, 0.0012, 2, '$256B'),
  M('ZEC', 'Zcash', 'crypto', 10, 1166.62, -7.73, 691.6e3, 4.07e6, 0.0013, 2, '$19.2B'),
  M('PONS', 'Pons', 'crypto', 5, 0.1574, -2.58, 238.8e3, 304, 0.0013, 4),
  M('XPL', 'Plasma', 'crypto', 5, 0.05261, -3.22, 224.4e3, 70.8e3, -0.0048, 5),
  M('PUMP', 'Pump.fun', 'crypto', 5, 0.003602, -3.16, 201.4e3, 97.2e3, 0.0012, 6),
  M('AAVE', 'Aave', 'crypto', 10, 168.4, -2.1, 120e3, 41e3, 0.0012, 2),
  M('ARB', 'Arbitrum', 'crypto', 10, 0.2103, -1.3, 90e3, 22e3, 0.0012, 4),
  M('AVAX', 'Avalanche', 'crypto', 10, 17.82, -2.7, 85e3, 30e3, 0.0012, 2),
  M('ADA', 'Cardano', 'crypto', 10, 0.4112, -1.9, 70e3, 18e3, 0.0012, 4),
  M('AERO', 'Aerodrome', 'crypto', 5, 0.5421, 4.2, 66e3, 12e3, 0.0012, 4),
  M('ANSEM', 'Ansem', 'crypto', 3, 0.0211, -24.69, 59e3, 9e3, 0.0012, 4),
  M('ORE', 'Ore', 'crypto', 5, 41.3, -10.66, 52e3, 7e3, 0.0012, 2),
  M('METADAO', 'MetaDAO', 'crypto', 5, 3.12, -7.27, 48e3, 6e3, 0.0012, 3),
  M('MET', 'Meteora', 'crypto', 5, 0.318, 7.1, 41e3, 5e3, 0.0012, 3),
  M('DRV', 'Drift', 'crypto', 5, 0.092, 1.8, 30e3, 4e3, 0.0012, 4),
  M('NVDA', 'NVIDIA', 'stock', 20, 176.01, -6.24, 1.04e6, 98.6e3, 0.0031, 2),
  M('SPCX', 'SpaceX', 'stock', 10, 141.11, 3.93, 874e3, 912.8e3, 0.0028, 2),
  M('SNDK', 'Sandisk', 'stock', 15, 881.8, 3.83, 477.1e3, 154.1e3, 0.0011, 2),
  M('IREN', 'IREN', 'stock', 10, 21.38, -4.04, 177.7e3, 4.9e3, 0.0033, 2),
  M('DELL', 'Dell', 'stock', 10, 346.8, 3.7, 160.7e3, 68.3e3, 0.0013, 2),
  M('MSTR', 'Strategy', 'stock', 10, 125.49, -1.93, 156.5e3, 77.8e3, 0.0013, 2),
  M('GOOGL', 'Alphabet (Google)', 'stock', 20, 289.97, 1.25, 135.5e3, 420e3, 0.0016, 2),
  M('META', 'Meta', 'stock', 20, 642.27, 4.94, 127.6e3, 327.2e3, 0.0006, 2),
  M('AMD', 'AMD', 'stock', 10, 548.82, 11.88, 423e3, 120e3, 0.0013, 2),
  M('AMAT', 'Applied Materials', 'stock', 10, 388.51, 9.77, 704e3, 210e3, 0.0013, 2),
  M('NET', 'Cloudflare', 'stock', 10, 244.1, 9.53, 300e3, 90e3, 0.0013, 2),
  M('MRNA', 'Moderna', 'stock', 10, 277.74, 7.62, 341e3, 76e3, 0.0013, 2, '$110.9B'),
  M('KLAC', 'KLA', 'stock', 10, 1212.5, 7.27, 280e3, 70e3, 0.0013, 2),
  M('MRVL', 'Marvell', 'stock', 10, 131.2, 7.14, 260e3, 61e3, 0.0013, 2),
  M('AVGO', 'Broadcom', 'stock', 10, 402.6, 7.02, 250e3, 88e3, 0.0013, 2),
  M('ARM', 'Arm', 'stock', 10, 176.4, 6.26, 190e3, 52e3, 0.0013, 2),
  M('NBIS', 'Nebius', 'stock', 10, 167.1, 6.03, 417e3, 80e3, 0.0013, 2),
  M('TSLA', 'Tesla', 'stock', 20, 402.21, 2.13, 318e3, 140e3, 0.0013, 2),
  M('AAPL', 'Apple', 'stock', 20, 268.9, 0.8, 210e3, 90e3, 0.0013, 2),
  M('AMZN', 'Amazon', 'stock', 20, 245.3, 1.1, 205e3, 85e3, 0.0013, 2),
  M('ASML', 'ASML', 'stock', 10, 1040.2, 2.4, 120e3, 40e3, 0.0013, 2),
  M('BABA', 'Alibaba', 'stock', 10, 161.4, -1.2, 110e3, 38e3, 0.0013, 2),
  M('WTIOIL', 'WTI Crude Oil', 'commodity', 10, 86.53, -3.58, 260.8e3, 15.1e3, -0.011, 2),
  M('GOLD', 'Gold', 'commodity', 20, 4111.2, 1.15, 150.2e3, 80e3, 0.0006, 2),
  M('SILVER', 'Silver', 'commodity', 10, 52.91, 1.93, 38.9e3, 64.5e3, 0.0011, 2),
  M('COPPER', 'Copper', 'commodity', 10, 6.39, 1.88, 8.2e3, 3.5e3, 0.0126, 3),
  M('ANTHROPIC', 'Anthropic', 'preipo', 3, 412.5, 0.6, 95e3, 210e3, 0.0015, 2),
]
export const bySym = (s: string) => MARKETS.find(m => m.sym === s) ?? MARKETS[0]
export const TOP_MOVERS = ['AMD', 'AMAT', 'NET', 'MRNA', 'KLAC', 'MRVL', 'AVGO', 'ARM', 'NBIS', 'ZEC']
export const logo = (sym: string) => `/logos/${sym}.svg`

// Number / date format chosen in Settings > General. The store sets these before each render; the defaults give the original output.
let NUM_FMT = '1,234.56', DATE_FMT = 'MM/DD/YY'
export const setFormats = (num: string, date: string) => { NUM_FMT = num; DATE_FMT = date }
const loc = (s: string) => (NUM_FMT === '1.234,56' ? s.replace(/[.,]/g, c => (c === '.' ? ',' : '.')) : s)
export const fmt = (n: number, d = 2) => loc(n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }))
// date + time as the history tables show it, e.g. 11/15/26 09:41 AM (MM/DD/YY), 15/11/2026 09:41 AM, 2026-11-15 09:41 AM
export const fmtDate = (t: number) => {
  const d = new Date(t), h = d.getHours(), p = (n: number) => String(n).padStart(2, '0')
  const day = DATE_FMT === 'DD/MM/YYYY' ? `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}` : DATE_FMT === 'YYYY-MM-DD' ? `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` : `${p(d.getMonth() + 1)}/${p(d.getDate())}/${String(d.getFullYear()).slice(2)}`
  return `${day} ${p(h % 12 || 12)}:${p(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`
}
export const usd = (n: number, d = 2) => (n < 0 ? '-$' : '$') + fmt(Math.abs(n), d)
export const sgn = (n: number, d = 2) => (n < 0 ? '-' : '+') + '$' + fmt(Math.abs(n), d)
export const pct = (n: number, d = 2) => (n < 0 ? '' : '+') + n.toFixed(d) + '%'
export const compact = (n: number) => n >= 1e9 ? '$' + (n / 1e9).toFixed(2) + 'B' : n >= 1e6 ? '$' + (n / 1e6).toFixed(2) + 'M' : n >= 1e3 ? '$' + (n / 1e3).toFixed(1) + 'K' : '$' + n.toFixed(0)
export const price = (n: number, dec: number) => loc(n.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }))

// ---- leaderboard (9 Nov 2026 snapshot; addresses truncated like the live site) ----
export type Trader = { rank: number; addr: string; pnl: number; roi: number; vol: number; value: number }
export const TRADERS: Trader[] = [
  { rank: 1, addr: '3ctH…tuFr', pnl: 23083, roi: 21.69, vol: 1992, value: 105959 },
  { rank: 2, addr: '1imt…XLba', pnl: 23070, roi: 7.14, vol: 0, value: 346159 },
  { rank: 3, addr: 'EfMw…SKne', pnl: 22556, roi: 23.43, vol: 1791, value: 106513 },
  { rank: 4, addr: 'TEY5…FQNQ', pnl: 21475, roi: 20.12, vol: 1395, value: 106617 },
  { rank: 5, addr: 'DayY…rBqa', pnl: 19137, roi: 21.74, vol: 1991, value: 97826 },
  { rank: 6, addr: 'Hj7G…4xnA', pnl: 16217, roi: 19.59, vol: 0, value: 98671 },
  { rank: 7, addr: '3dp1…JEkV', pnl: 15648, roi: 15.66, vol: 0, value: 115249 },
  { rank: 8, addr: '5FiG…EXxh', pnl: 14030, roi: 4.85, vol: 0, value: 303709 },
  { rank: 9, addr: '8wMx…Fbji', pnl: 8990, roi: 8.83, vol: 0, value: 110930 },
  { rank: 10, addr: '6C5k…wxZK', pnl: 5638, roi: 25.13, vol: 12365, value: 28006 },
  { rank: 11, addr: 'AsqD…nXFL', pnl: 5161, roi: 10.32, vol: 2612615, value: 55055 },
  { rank: 12, addr: 'Bt4q…M2uv', pnl: 4410, roi: 9.1, vol: 8210, value: 49320 },
  { rank: 13, addr: 'Gh2P…c9Rw', pnl: 3902, roi: 6.4, vol: 0, value: 61200 },
  { rank: 14, addr: 'Kp8s…Lz1d', pnl: 3511, roi: 12.8, vol: 5120, value: 27800 },
  { rank: 15, addr: 'Qw3N…y7Tb', pnl: 3180, roi: 3.1, vol: 0, value: 102800 },
]
const addrFor = (i: number) => { const c = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'; let s = i * 7919 + 13; const g = (n: number) => { let o = ''; for (let k = 0; k < n; k++) { s = (s * 1103515245 + 12345) % 2147483648; o += c[s % c.length] } return o }; return g(4) + '…' + g(4) }
// the live site paginates; extend the 15 captured rows with deterministic extras so sorting/search have something to chew on
export const ALL: Trader[] = [...TRADERS, ...Array.from({ length: 85 }, (_, i) => { const r = 16 + i; return { rank: r, addr: addrFor(r), pnl: Math.round(3100 * Math.pow(0.88, i + 1) + 40), roi: +(2 + ((r * 37) % 90) / 10).toFixed(2), vol: (r * 977) % 5 === 0 ? 0 : (r * 4231) % 90000, value: 9000 + ((r * 7717) % 60000) } })]

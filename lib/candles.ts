// Seeded candle history shaped like the live SOL 1h chart: a spike, a slide, a basing range, a late dip.
export type Candle = { o: number; h: number; l: number; c: number; v: number }
function rng(seed: number) { let s = seed; return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296) }
const SHAPE: [number, number][] = [[0, 0.0], [0.08, 0.9], [0.18, 1.6], [0.24, 0.9], [0.3, -0.5], [0.4, -0.7], [0.55, -0.55], [0.7, -0.6], [0.82, -0.5], [0.9, -1.0], [0.96, -0.9], [1, -0.85]]
function at(t: number) { for (let i = 1; i < SHAPE.length; i++) if (t <= SHAPE[i][0]) { const [a, va] = SHAPE[i - 1], [b, vb] = SHAPE[i]; return va + ((t - a) / (b - a)) * (vb - va) } return 0 }
// mix > 0 gives a market its own shape (a few seeded slow waves blended into the base curve), so compared markets differ; SOL keeps mix 0
export function buildCandles(n: number, last: number, vol: number, seed = 11, mix = 0): Candle[] {
  const r = rng(seed), out: Candle[] = []
  const r2 = rng(seed * 7 + 3), W = [0, 1, 2, 3].map(k => ({ f: k === 3 ? 7 + r2() * 4 : 1 + k * 1.3 + r2() * 1.5, p: r2() * Math.PI * 2, a: (k === 3 ? 0.12 : 0.9 - k * 0.25) * (r2() < 0.5 ? -1 : 1) }))
  const shape = (t: number) => at(t) * (1 - mix * 0.5) + mix * 0.45 * W.reduce((s2, w) => s2 + w.a * Math.sin(w.p + t * w.f * Math.PI * 2), 0)
  const scale = last * 0.05
  let prev = last + (shape(0) - shape(1)) * scale
  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n, c = i === n - 1 ? last : last + (shape(t) - shape(1)) * scale + (r() - 0.5) * vol * 2, o = prev
    const h = Math.max(o, c) + r() * vol * 0.8, l = Math.min(o, c) - r() * vol * 0.8
    out.push({ o, c, h, l, v: Math.round(60000 + r() * 240000 + Math.abs(c - o) / vol * 40000) }); prev = c
  }
  return out
}

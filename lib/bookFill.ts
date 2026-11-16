// The order book's own fill preview (average fill vs best price), shared so the order form shows the same slippage number as the book.
import { useSyncExternalStore } from 'react'
export type BookFill = { sym: string; pct: number; avg: number; long: boolean; full: boolean } | null
let cur: BookFill = null
const subs = new Set<() => void>()
export const setBookFill = (f: BookFill) => { if (cur?.sym === f?.sym && cur?.pct === f?.pct && cur?.avg === f?.avg && cur?.long === f?.long && cur?.full === f?.full) return; cur = f; subs.forEach(s => s()) }
export const useBookFill = () => useSyncExternalStore(f => { subs.add(f); return () => { subs.delete(f) } }, () => cur, () => cur)

'use client'
import { Check, Info, Loader2, X } from 'lucide-react'
import { useApp } from '@/lib/store'
export default function Toasts() {
  const { toast } = useApp()
  if (!toast) return null
  return (
    <div className="toasts"><div className={'toast ' + toast.kind}>
      {toast.kind === 'loading' ? <Loader2 size={16} className="spin" /> : toast.kind === 'ok' ? <Check size={16} /> : toast.kind === 'info' ? <Info size={16} /> : <X size={16} />}<span>{toast.text}</span>
    </div></div>
  )
}

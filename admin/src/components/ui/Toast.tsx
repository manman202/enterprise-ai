/**
 * Lightweight toast notification system — no external library.
 * Usage: const { toasts, toast, dismiss } = useToast()
 *        toast('success', 'File uploaded!')
 *        toast('error', 'Something went wrong')
 *        <ToastContainer toasts={toasts} dismiss={dismiss} />
 */

import { useState, useCallback, useRef } from 'react'
import { CheckCircle, XCircle, X } from 'lucide-react'

export interface ToastItem {
  id: string
  type: 'success' | 'error'
  message: string
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  const toast = useCallback(
    (type: ToastItem['type'], message: string) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, type, message }])
      // Success auto-dismisses after 4s; errors stay until dismissed
      if (type === 'success') {
        timers.current[id] = setTimeout(() => dismiss(id), 4000)
      }
    },
    [dismiss],
  )

  return { toasts, toast, dismiss }
}

export function ToastContainer({
  toasts,
  dismiss,
}: {
  toasts: ToastItem[]
  dismiss: (id: string) => void
}) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[200] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={[
            'pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg',
            'border text-sm font-medium min-w-[280px] max-w-[420px]',
            'animate-[slideIn_0.2s_ease-out]',
            t.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800',
          ].join(' ')}
        >
          {t.type === 'success' ? (
            <CheckCircle size={16} className="shrink-0 text-green-500" />
          ) : (
            <XCircle size={16} className="shrink-0 text-red-500" />
          )}
          <span className="flex-1">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 text-gray-400 hover:text-gray-600"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}

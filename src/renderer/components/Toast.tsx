import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { IconCheck } from './Icons'

interface ToastData {
  id: number
  message: string
  type: 'success' | 'error'
}

interface ToastCtx {
  toast: (message: string, type?: 'success' | 'error') => void
}

const Ctx = createContext<ToastCtx>({ toast: () => {} })
export const useToast = () => useContext(Ctx)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([])

  const toast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} data={t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </Ctx.Provider>
  )
}

function ToastItem({ data, onDismiss }: { data: ToastData; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 300)
    }, 3700)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const isOk = data.type === 'success'

  return (
    <div
      onClick={onDismiss}
      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-5 py-3 shadow-lg backdrop-blur transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      } ${
        isOk
          ? 'border-brand-200 bg-brand-50/95 text-brand-800'
          : 'border-red-200 bg-red-50/95 text-red-800'
      }`}
    >
      {isOk && <IconCheck className="text-brand-600" />}
      <span className="whitespace-pre-line text-sm font-medium">{data.message}</span>
    </div>
  )
}

import { useState, useRef, useEffect } from 'react'
import { IconKey } from './Icons'

interface Props {
  onActivated: () => void
  expired?: boolean
}

const GROUPS = [5, 5, 5, 5] // 4 grupos de 5 → 20 chars + 3 guiones

function formatInput(raw: string): string {
  // Siempre limpiar y reformatear desde cero
  const clean = raw.replace(/[^A-Z2-7]/gi, '').toUpperCase().slice(0, 20)

  const groups: string[] = []
  let i = 0
  for (const len of GROUPS) {
    if (i >= clean.length) break
    groups.push(clean.slice(i, i + len))
    i += len
  }
  const formatted = groups.join('-')

  // Si el usuario escribió un guión manualmente al final y está justo en un límite de grupo
  // (cada 5 caracteres), preservar el guión trailing para que se vea reflejado
  const rawEndsWithHyphen = raw.endsWith('-')
  const atGroupBoundary = clean.length > 0 && clean.length < 20 && clean.length % 5 === 0
  if (rawEndsWithHyphen && atGroupBoundary) {
    return formatted + '-'
  }

  return formatted
}

export default function ActivationScreen({ onActivated, expired = false }: Props) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null)
    setValue(formatInput(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const clean = value.replace(/-/g, '')
    if (clean.length !== 20) {
      setError('La clave debe tener 20 caracteres.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await window.curo.license.activate(value)
      if (result.ok) {
        onActivated()
      } else {
        setError(result.error ?? 'Error al activar la clave.')
      }
    } catch (err) {
      setError('No se pudo conectar con el sistema. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50">
            <IconKey className="h-7 w-7 text-brand-600" />
          </div>
          <h1 className="text-2xl font-semibold text-stone-800">Activar Curo</h1>
          <p className="mt-2 text-sm text-stone-500">
            {expired
              ? 'Tu licencia ha vencido. Ingresa una nueva clave para continuar.'
              : 'Ingresa la clave de activación que recibiste para comenzar a usar la aplicación.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-stone-700">
              Clave de activación
            </label>
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={handleChange}
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX"
              spellCheck={false}
              autoComplete="off"
              className={`w-full rounded-xl border px-4 py-3 text-center font-mono text-base tracking-widest outline-none transition-colors ${
                error
                  ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-2 focus:ring-red-100'
                  : 'border-stone-200 bg-white text-stone-900 focus:border-brand-400 focus:ring-2 focus:ring-brand-100'
              }`}
            />
            {error && <p className="mt-1.5 text-sm text-red-600">{error}</p>}
          </div>

          <button
            type="submit"
            disabled={loading || value.replace(/-/g, '').length < 20}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Verificando…' : 'Activar'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-stone-400">
          ¿Necesitas ayuda? Contacta a tu proveedor de soporte.
        </p>
      </div>
    </div>
  )
}

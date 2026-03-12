import { useState, useEffect } from 'react'
import { IconSave } from './Icons'
import { useToast } from './Toast'

export default function ConsultationForm({
  patientId,
  consultationId,
  onSaved,
  onCancel,
}: {
  patientId: number
  consultationId: number | null
  onSaved: () => void
  onCancel: () => void
}) {
  const isNew = consultationId === null
  const [date, setDate] = useState('')
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const { toast } = useToast()

  useEffect(() => {
    if (!isNew && consultationId !== null) {
      setLoading(true)
      window.curo.consultations.get(consultationId).then((c) => {
        if (c) {
          setDate(c.date.slice(0, 10))
          setText(c.text ?? '')
        }
        setLoading(false)
      })
    } else {
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      setDate(`${year}-${month}-${day}`)
      setText('')
      setLoading(false)
    }
  }, [consultationId, isNew])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) return
    const today = new Date()
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const timePart = date === todayStr
      ? `${String(today.getHours()).padStart(2, '0')}:${String(today.getMinutes()).padStart(2, '0')}`
      : date < todayStr
        ? '23:59'
        : '00:00'
    const dateValue = `${date}T${timePart}`
    setSaving(true)
    const action = isNew
      ? window.curo.consultations.create({ patient_id: patientId, date: dateValue, text: text || undefined })
      : window.curo.consultations.update(consultationId!, { date: dateValue, text: text || undefined })

    action
      .then(() => {
        toast(isNew ? 'Consulta registrada' : 'Consulta actualizada')
        onSaved()
      })
      .finally(() => setSaving(false))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <p className="text-sm text-stone-400">Cargando...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,11rem)_1fr]">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-stone-600">
            Fecha <span className="text-brand-600">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="input-field w-full min-w-0"
          />
        </div>
        <div className="min-w-0">
          <label className="mb-1.5 block text-sm font-medium text-stone-600">Notas de la consulta</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="Observaciones, diagnóstico, tratamiento..."
            className="input-field resize-none"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="btn-primary disabled:opacity-50">
          <IconSave />
          {saving ? 'Guardando...' : isNew ? 'Registrar' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}

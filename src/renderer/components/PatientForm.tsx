import { useState, useEffect } from 'react'
import { IconSave } from './Icons'
import { useToast } from './Toast'

const FIELDS = [
  { key: 'name', label: 'Nombre completo', required: true, type: 'text', half: false, placeholder: 'Ej: María García López' },
  { key: 'insurer', label: 'Aseguradora', required: false, type: 'text', half: true, placeholder: 'Ej: GNP, AXA...' },
  { key: 'insurer_number', label: 'Número de póliza', required: false, type: 'text', half: true, placeholder: 'Ej: 12345678' },
  { key: 'phone', label: 'Teléfono', required: false, type: 'tel', half: true, placeholder: 'Ej: 55 1234 5678' },
  { key: 'email', label: 'Correo electrónico', required: false, type: 'email', half: true, placeholder: 'correo@ejemplo.com' },
  { key: 'notes', label: 'Observaciones', required: false, type: 'textarea', half: false, placeholder: 'Notas generales, alergias, condiciones...' },
] as const

type FormData = Record<string, string>

export default function PatientForm({
  patientId,
  onSaved,
  onCancel,
}: {
  patientId: number | null
  onSaved: (newPatientId?: number) => void
  onCancel: () => void
}) {
  const isNew = patientId === null
  const [form, setForm] = useState<FormData>({ name: '' })
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const { toast } = useToast()

  useEffect(() => {
    if (patientId === null) {
      setForm({ name: '' })
      setLoading(false)
      return
    }
    setLoading(true)
    window.curo.patients
      .get(patientId)
      .then((p) => {
        if (p)
          setForm({
            name: p.name,
            insurer: p.insurer ?? '',
            insurer_number: p.insurer_number ?? '',
            phone: p.phone ?? '',
            email: p.email ?? '',
            notes: p.notes ?? '',
          })
      })
      .finally(() => setLoading(false))
  }, [patientId])

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const raw = (k: string) => (form[k] ?? '').trim()
    const data = {
      name: form.name.trim(),
      insurer: raw('insurer'),
      insurer_number: raw('insurer_number'),
      phone: raw('phone'),
      email: raw('email'),
      notes: raw('notes'),
    }
    if (isNew) {
      window.curo.patients
        .create(data)
        .then((newId) => {
          toast('Paciente creado correctamente')
          onSaved(newId)
        })
        .catch(() => {
          toast('No se pudo crear el paciente. Intenta de nuevo.', 'error')
        })
        .finally(() => setSaving(false))
    } else {
      window.curo.patients
        .update(patientId!, data)
        .then(() => {
          toast('Paciente actualizado')
          onSaved()
        })
        .catch(() => {
          toast('No se pudo actualizar el paciente. Intenta de nuevo.', 'error')
        })
        .finally(() => setSaving(false))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-stone-400">Cargando datos...</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={isNew ? 'card' : ''}>
      <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
        {FIELDS.map(({ key, label, required, type, half, placeholder }) => {
          const colSpan = half ? '' : 'sm:col-span-2'
          return (
            <div key={key} className={colSpan}>
              <label className="mb-1.5 block text-sm font-medium text-stone-600">
                {label}
                {required && <span className="ml-0.5 text-brand-600">*</span>}
              </label>
              {type === 'textarea' ? (
                <textarea
                  value={form[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  rows={3}
                  placeholder={placeholder}
                  className="input-field resize-none"
                />
              ) : (
                <input
                  type={type}
                  value={form[key] ?? ''}
                  onChange={(e) => handleChange(key, e.target.value)}
                  required={required}
                  placeholder={placeholder}
                  className="input-field"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className={`flex items-center justify-end gap-3 ${isNew ? 'mt-6 border-t border-stone-100 pt-5' : 'mt-5 pt-4'}`}>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancelar
        </button>
        <button type="submit" disabled={saving || !form.name.trim()} className="btn-primary disabled:opacity-50">
          <IconSave />
          {saving ? 'Guardando...' : isNew ? 'Crear paciente' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  )
}

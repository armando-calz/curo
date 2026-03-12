import { useState, useEffect, useCallback, useRef } from 'react'
import PatientForm from './PatientForm'
import ConsultationForm from './ConsultationForm'
import { IconArrowLeft, IconPencil, IconPlus, IconTrash, IconUser, IconCalendar, IconClipboard } from './Icons'
import { useToast } from './Toast'

const PATIENT_LABELS: Record<string, string> = {
  insurer: 'Aseguradora',
  insurer_number: 'Número de póliza',
  phone: 'Teléfono',
  email: 'Correo',
  notes: 'Observaciones',
}

export default function PatientDetail({
  patientId,
  onBack,
}: {
  patientId: number
  onBack: () => void
}) {
  const [patient, setPatient] = useState<Patient | null>(null)
  const [consultations, setConsultations] = useState<Consultation[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPatient, setEditingPatient] = useState(false)
  const [consultationFormId, setConsultationFormId] = useState<number | 'new' | null>(null)
  const [deletingConsultationId, setDeletingConsultationId] = useState<number | null>(null)
  const { toast } = useToast()
  const patientSectionRef = useRef<HTMLDivElement>(null)
  const consultationFormsRef = useRef<Map<number, HTMLDivElement>>(new Map())

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      window.curo.patients.get(patientId),
      window.curo.consultations.listByPatient(patientId),
    ])
      .then(([p, list]) => {
        setPatient(p ?? null)
        setConsultations(list)
      })
      .finally(() => setLoading(false))
  }, [patientId])

  useEffect(() => {
    load()
  }, [load])

  // Click fuera cierra edición si está en modo edición
  useEffect(() => {
    if (!editingPatient) return
    const handleClickOutside = (e: MouseEvent) => {
      if (patientSectionRef.current && !patientSectionRef.current.contains(e.target as Node)) {
        setEditingPatient(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [editingPatient])

  // Click fuera cierra edición de consulta
  useEffect(() => {
    if (consultationFormId === null || consultationFormId === 'new') return
    const handleClickOutside = (e: MouseEvent) => {
      const formEl = consultationFormsRef.current.get(consultationFormId)
      if (formEl && !formEl.contains(e.target as Node)) {
        setConsultationFormId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [consultationFormId])

  const handlePatientSaved = useCallback(() => {
    setEditingPatient(false)
    load()
  }, [load])

  const handleConsultationSaved = useCallback(() => {
    setConsultationFormId(null)
    window.curo.consultations.listByPatient(patientId).then(setConsultations)
  }, [patientId])

  const handleDeactivateConsultation = (id: number) => {
    if (!window.confirm('¿Está seguro de que desea eliminar la consulta?')) return
    setDeletingConsultationId(id)
    window.curo.consultations
      .deactivate(id)
      .then(() => {
        setConsultations((prev) => prev.filter((c) => c.id !== id))
        toast('Consulta desactivada')
      })
      .finally(() => setDeletingConsultationId(null))
  }

  const formatConsultationDate = (d: string) => {
    const datePart = d.includes('T') ? d.slice(0, 10) : d
    return new Date(datePart + 'T12:00:00').toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (loading && !patient) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-stone-400">Cargando...</p>
      </div>
    )
  }

  if (!patient) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="btn-ghost">
          <IconArrowLeft /> Volver a pacientes
        </button>
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-300 py-16">
          <p className="text-sm text-stone-500">Paciente no encontrado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button type="button" onClick={onBack} className="btn-ghost -ml-2">
        <IconArrowLeft /> Pacientes
      </button>

      {/* ─── Patient Section ─── */}
      <section className="card" ref={patientSectionRef}>
        <div className="mb-5 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-700">
              <IconUser />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-800">{patient.name}</h2>
              {patient.insurer && (
                <p className="text-sm text-stone-500">{patient.insurer}</p>
              )}
            </div>
          </div>
          {!editingPatient && (
            <button
              type="button"
              onClick={() => setEditingPatient(true)}
              className="btn-secondary text-sm"
            >
              <IconPencil /> Editar
            </button>
          )}
        </div>

        {editingPatient ? (
          <div className="rounded-xl border border-brand-200 bg-brand-50/30 p-5 -mx-1">
            <PatientForm
              patientId={patientId}
              onSaved={handlePatientSaved}
              onCancel={() => setEditingPatient(false)}
            />
          </div>
        ) : (
          <div
            className="grid cursor-pointer gap-4 sm:grid-cols-2 lg:grid-cols-3"
            onDoubleClick={() => setEditingPatient(true)}
          >
            {(Object.keys(PATIENT_LABELS) as Array<keyof typeof PATIENT_LABELS>).map((key) => {
              const value = patient[key as keyof Patient]
              if (value === undefined || value === '') return null
              return (
                <div
                  key={key}
                  className={`rounded-lg bg-stone-50 px-4 py-3 transition-colors hover:bg-stone-100 ${key === 'notes' ? 'sm:col-span-2 lg:col-span-3' : ''}`}
                >
                  <dt className="mb-0.5 text-xs font-medium uppercase tracking-wide text-stone-400">
                    {PATIENT_LABELS[key]}
                  </dt>
                  <dd className="text-sm text-stone-700">
                    {key === 'notes' ? (
                      <span className="whitespace-pre-wrap">{String(value)}</span>
                    ) : (
                      String(value)
                    )}
                  </dd>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ─── Consultations Section ─── */}
      <section className="card">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <IconClipboard />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-800">Consultas</h2>
              <p className="text-xs text-stone-400">
                {consultations.length} {consultations.length === 1 ? 'registro' : 'registros'}
              </p>
            </div>
          </div>
          {consultationFormId === null && (
            <button
              type="button"
              onClick={() => setConsultationFormId('new')}
              className="btn-primary"
            >
              <IconPlus /> Nueva consulta
            </button>
          )}
        </div>

        {/* Consultation Form (inline) - solo para nueva consulta */}
        {consultationFormId === 'new' && (
          <div className="mb-6 rounded-xl border border-brand-200 bg-brand-50/30 p-5">
            <h3 className="mb-3 text-sm font-semibold text-brand-800">Nueva consulta</h3>
            <ConsultationForm
              patientId={patientId}
              consultationId={null}
              onSaved={handleConsultationSaved}
              onCancel={() => setConsultationFormId(null)}
            />
          </div>
        )}

        {/* Consultation List */}
        {consultations.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-stone-200 py-12">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-stone-100">
              <IconCalendar className="text-stone-400" />
            </div>
            <p className="text-sm text-stone-400">Aún no hay consultas registradas</p>
          </div>
        ) : (
          <div className="space-y-3">
            {consultations.map((c) =>
              consultationFormId === c.id ? (
                <div
                  key={c.id}
                  ref={(el) => {
                    if (el) consultationFormsRef.current.set(c.id, el)
                    else consultationFormsRef.current.delete(c.id)
                  }}
                  className="rounded-xl border border-brand-200 bg-brand-50/30 p-5"
                >
                  <h3 className="mb-3 text-sm font-semibold text-brand-800">Editar consulta</h3>
                  <ConsultationForm
                    patientId={patientId}
                    consultationId={c.id}
                    onSaved={handleConsultationSaved}
                    onCancel={() => setConsultationFormId(null)}
                  />
                </div>
              ) : (
                <div
                  key={c.id}
                  onDoubleClick={() => setConsultationFormId(c.id)}
                  className="group cursor-pointer rounded-xl border border-stone-200 bg-stone-50/50 px-5 py-4 transition-colors hover:border-stone-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <IconCalendar className="text-brand-500" />
                        <span className="text-sm font-medium text-stone-700">{formatConsultationDate(c.date)}</span>
                      </div>
                      {c.text && (
                        <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-stone-600">
                          {c.text}
                        </p>
                      )}
                    </div>
                    <div
                      className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => setConsultationFormId(c.id)}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-stone-200 hover:text-stone-600"
                        title="Editar consulta"
                      >
                        <IconPencil />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeactivateConsultation(c.id)}
                        disabled={deletingConsultationId === c.id}
                        className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                        title="Desactivar consulta"
                      >
                        <IconTrash />
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </section>
    </div>
  )
}

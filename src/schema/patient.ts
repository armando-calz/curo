/**
 * Single source of truth for patient fields.
 * Used by: DB layer, forms, validation. UI labels in Spanish.
 */

export interface Patient {
  id?: number
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
  active?: boolean
}

export const PATIENT_FIELDS = [
  { key: 'name', label: 'Nombre completo', required: true, type: 'text' as const },
  { key: 'insurer', label: 'Aseguradora', required: false, type: 'text' as const },
  { key: 'insurer_number', label: 'Número de póliza', required: false, type: 'text' as const },
  { key: 'phone', label: 'Teléfono', required: false, type: 'tel' as const },
  { key: 'email', label: 'Correo', required: false, type: 'email' as const },
  { key: 'notes', label: 'Observaciones', required: false, type: 'textarea' as const },
] as const

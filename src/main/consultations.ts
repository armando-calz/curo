import { getDb } from './db'
import { logAction } from './activityLog'

export interface ConsultationRow {
  id: number
  patient_id: number
  date: string
  text: string | null
  active: number
}

export interface ConsultationInsert {
  patient_id: number
  date: string
  text?: string
}

function rowToConsultation(row: ConsultationRow) {
  return {
    id: row.id,
    patient_id: row.patient_id,
    date: row.date,
    text: row.text ?? undefined,
    active: Boolean(row.active),
  }
}

export function listConsultationsByPatient(patientId: number): ReturnType<typeof rowToConsultation>[] {
  const database = getDb()
  const rows = database
    .prepare('SELECT * FROM consultations WHERE patient_id = ? AND active = 1 ORDER BY date DESC')
    .all(patientId) as ConsultationRow[]
  return rows.map(rowToConsultation)
}

export function getConsultation(id: number): ReturnType<typeof rowToConsultation> | null {
  const database = getDb()
  const row = database.prepare('SELECT * FROM consultations WHERE id = ?').get(id) as ConsultationRow | undefined
  if (!row) return null
  return rowToConsultation(row)
}

export function createConsultation(data: ConsultationInsert): number {
  const database = getDb()
  const stmt = database.prepare(
    'INSERT INTO consultations (patient_id, date, text) VALUES (?, ?, ?)'
  )
  const result = stmt.run(data.patient_id, data.date, data.text ?? null)
  const id = result.lastInsertRowid as number
  
  const patientName = database.prepare('SELECT name FROM patients WHERE id = ?').get(data.patient_id) as { name: string } | undefined
  const desc = patientName 
    ? `Consulta registrada para ${patientName.name} (fecha: ${data.date})`
    : `Consulta registrada (fecha: ${data.date})`
  logAction('create', desc, 'consultation', id)
  return id
}

export function updateConsultation(
  id: number,
  data: Partial<Pick<ConsultationInsert, 'date' | 'text'>>
): void {
  const database = getDb()
  const current = getConsultation(id)
  if (!current) return

  const snapshot = { ...current }
  const patientName = database.prepare('SELECT name FROM patients WHERE id = ?').get(current.patient_id) as { name: string } | undefined
  const desc = patientName
    ? `Consulta editada de ${patientName.name} (fecha: ${data.date ?? current.date})`
    : `Consulta editada (fecha: ${data.date ?? current.date})`

  database
    .prepare('UPDATE consultations SET date = ?, text = ? WHERE id = ?')
    .run(
      data.date ?? current.date,
      data.text !== undefined ? data.text : current.text ?? null,
      id
    )
  logAction('update', desc, 'consultation', id, snapshot)
}

export function deactivateConsultation(id: number): void {
  const database = getDb()
  const current = getConsultation(id)
  if (!current) return
  const snapshot = { ...current }
  
  const patientName = database.prepare('SELECT name FROM patients WHERE id = ?').get(current.patient_id) as { name: string } | undefined
  const desc = patientName
    ? `Consulta eliminada de ${patientName.name} (fecha: ${current.date})`
    : `Consulta eliminada (fecha: ${current.date})`
  
  database.prepare('UPDATE consultations SET active = 0 WHERE id = ?').run(id)
  logAction('deactivate', desc, 'consultation', id, snapshot)
}

export function reactivateConsultation(id: number): void {
  const database = getDb()
  const row = database.prepare('SELECT * FROM consultations WHERE id = ?').get(id) as ConsultationRow | undefined
  if (!row) return
  if (row.active === 1) return
  
  const patientName = database.prepare('SELECT name FROM patients WHERE id = ?').get(row.patient_id) as { name: string } | undefined
  const desc = patientName
    ? `Consulta reactivada de ${patientName.name} (fecha: ${row.date})`
    : `Consulta reactivada (fecha: ${row.date})`
  
  database.prepare('UPDATE consultations SET active = 1 WHERE id = ?').run(id)
  logAction('reactivate', desc, 'consultation', id)
}

/** Aplica el snapshot completo (revertir): restaura valores y quita campos que no estaban. Sin log. */
export function revertConsultation(id: number, snapshot: Record<string, unknown>): void {
  const database = getDb()
  const current = getConsultation(id)
  if (!current) return
  const date = snapshot.date != null ? String(snapshot.date) : current.date
  const text = snapshot.text !== undefined && snapshot.text !== null ? String(snapshot.text) : null
  database.prepare('UPDATE consultations SET date = ?, text = ? WHERE id = ?').run(date, text, id)
}

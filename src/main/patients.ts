import { getDb, normalizeName } from './db'
import { logAction } from './activityLog'

export const PAGE_SIZE = 50

export interface PatientRow {
  id: number
  name: string
  name_search: string
  insurer: string | null
  insurer_number: string | null
  phone: string | null
  email: string | null
  notes: string | null
  active: number
}

export interface PatientListResult {
  patients: PatientWithLastConsultation[]
  total: number
  hasMore: boolean
}

export interface PatientInsert {
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
}

export interface PatientWithLastConsultation {
  id: number
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
  active: boolean
  last_consultation_date: string | null
}

function rowToPatient(row: PatientRow) {
  return {
    id: row.id,
    name: row.name,
    insurer: row.insurer ?? undefined,
    insurer_number: row.insurer_number ?? undefined,
    phone: row.phone ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
    active: Boolean(row.active),
  }
}

export type PatientSortBy = 'name' | 'lastConsultation'
export type PatientSortOrder = 'asc' | 'desc'

function getOrderClause(sortBy: PatientSortBy, order: PatientSortOrder): string {
  if (sortBy === 'name') return `ORDER BY p.name ${order.toUpperCase()}`
  return `ORDER BY MAX(c.date) IS NULL, MAX(c.date) ${order.toUpperCase()}`
}

export function listPatients(
  search?: string,
  sortBy: PatientSortBy = 'name',
  order: PatientSortOrder = 'asc',
  page: number = 0
): PatientListResult {
  const database = getDb()
  const orderClause = getOrderClause(sortBy, order)
  const offset = page * PAGE_SIZE

  const normalizedSearch = search ? normalizeName(search) : ''
  const hasSearch = normalizedSearch.length > 0
  const likeTerm = hasSearch ? `%${normalizedSearch}%` : null

  const whereClause = hasSearch
    ? `WHERE p.active = 1 AND (p.name_search LIKE ? OR p.insurer_number LIKE ? OR p.phone LIKE ?)`
    : `WHERE p.active = 1`

  const countParams = hasSearch ? [likeTerm, likeTerm, likeTerm] : []
  const queryParams = hasSearch
    ? [likeTerm, likeTerm, likeTerm, PAGE_SIZE, offset]
    : [PAGE_SIZE, offset]

  const total = (
    database
      .prepare(`SELECT COUNT(*) as count FROM patients p ${whereClause}`)
      .get(...countParams) as { count: number }
  ).count

  const rows = database
    .prepare(
      `SELECT p.*, MAX(c.date) as last_consultation_date
       FROM patients p
       LEFT JOIN consultations c ON c.patient_id = p.id AND c.active = 1
       ${whereClause}
       GROUP BY p.id
       ${orderClause}
       LIMIT ? OFFSET ?`
    )
    .all(...queryParams) as (PatientRow & { last_consultation_date: string | null })[]

  return {
    patients: rows.map((r) => ({
      ...rowToPatient(r),
      last_consultation_date: r.last_consultation_date ?? null,
    })),
    total,
    hasMore: offset + rows.length < total,
  }
}

export function getPatient(id: number): ReturnType<typeof rowToPatient> | null {
  const database = getDb()
  const row = database.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined
  if (!row) return null
  return rowToPatient(row)
}

export function createPatient(data: PatientInsert): number {
  const database = getDb()
  const stmt = database.prepare(
    `INSERT INTO patients (name, name_search, insurer, insurer_number, phone, email, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
  const opt = (v: string | undefined) => (v && v.trim() ? v.trim() : null)
  const trimmedName = data.name.trim()
  const result = stmt.run(
    trimmedName,
    normalizeName(trimmedName),
    opt(data.insurer),
    opt(data.insurer_number),
    opt(data.phone),
    opt(data.email),
    opt(data.notes)
  )
  const id = result.lastInsertRowid as number
  logAction('create', `Paciente creado: ${data.name}`, 'patient', id)
  return id
}

export function updatePatient(id: number, data: Partial<PatientInsert>): void {
  const database = getDb()
  const current = getPatient(id)
  if (!current) return

  const opt = (val: string | undefined, cur: string | undefined) =>
    val !== undefined ? (val.trim() || null) : (cur || null)

  const snapshot = { ...current }

  const newName = (data.name ?? current.name).trim()
  database
    .prepare(
      `UPDATE patients SET name = ?, name_search = ?, insurer = ?, insurer_number = ?, phone = ?, email = ?, notes = ?
       WHERE id = ?`
    )
    .run(
      newName,
      normalizeName(newName),
      opt(data.insurer, current.insurer),
      opt(data.insurer_number, current.insurer_number),
      opt(data.phone, current.phone),
      opt(data.email, current.email),
      opt(data.notes, current.notes),
      id
    )
  logAction('update', `Paciente editado: ${newName}`, 'patient', id, snapshot)
}

export function deactivatePatient(id: number): void {
  const database = getDb()
  const current = getPatient(id)
  if (!current) return
  const snapshot = { ...current }
  database.prepare('UPDATE patients SET active = 0 WHERE id = ?').run(id)
  logAction('deactivate', `Paciente eliminado: ${current.name}`, 'patient', id, snapshot)
}

export function reactivatePatient(id: number): void {
  const database = getDb()
  const row = database.prepare('SELECT * FROM patients WHERE id = ?').get(id) as PatientRow | undefined
  if (!row) return
  if (row.active === 1) return
  database.prepare('UPDATE patients SET active = 1 WHERE id = ?').run(id)
  logAction('reactivate', `Paciente reactivado: ${row.name}`, 'patient', id)
}

/** Aplica el snapshot completo (revertir): restaura valores y quita campos que no estaban. Sin log. */
export function revertPatient(id: number, snapshot: Record<string, unknown>): void {
  const database = getDb()
  const get = (key: string) => {
    const v = snapshot[key]
    return v === undefined || v === null ? null : String(v).trim() || null
  }
  database
    .prepare(
      `UPDATE patients SET name = ?, insurer = ?, insurer_number = ?, phone = ?, email = ?, notes = ?
       WHERE id = ?`
    )
    .run(
      (snapshot.name != null ? String(snapshot.name).trim() : '') || (getPatient(id)?.name ?? ''),
      get('insurer'),
      get('insurer_number'),
      get('phone'),
      get('email'),
      get('notes'),
      id
    )
}

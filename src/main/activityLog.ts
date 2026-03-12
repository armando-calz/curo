import { getDb } from './db'

export type EntityType = 'patient' | 'consultation'
export type ActionType = 'create' | 'update' | 'deactivate' | 'reactivate' | 'config'

export interface ActivityLogEntry {
  id: number
  created_at: number
  action: ActionType
  description: string
  entity_type: string | null
  entity_id: number | null
  snapshot: string | null
  revertible: boolean
}

export function logAction(
  action: ActionType,
  description: string,
  entityType?: EntityType,
  entityId?: number,
  snapshot?: Record<string, unknown>
): void {
  const database = getDb()
  const now = Date.now()
  database
    .prepare(
      `INSERT INTO activity_log (created_at, action, description, entity_type, entity_id, snapshot) VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      now,
      action,
      description,
      entityType ?? null,
      entityId ?? null,
      snapshot ? JSON.stringify(snapshot) : null
    )
}

export function listActivityLog(limit = 100): ActivityLogEntry[] {
  const database = getDb()
  const rows = database
    .prepare(
      `SELECT id, created_at, action, description, entity_type, entity_id, snapshot
       FROM activity_log ORDER BY created_at DESC LIMIT ?`
    )
    .all(limit) as {
    id: number
    created_at: number
    action: string
    description: string
    entity_type: string | null
    entity_id: number | null
    snapshot: string | null
  }[]
  return rows.map((r) => ({
    ...r,
    action: r.action as ActionType,
    revertible:
      r.action !== 'config' &&
      r.entity_type != null &&
      r.entity_id != null &&
      (r.action === 'deactivate' || (r.action === 'update' && r.snapshot != null)),
  }))
}

export function cleanOldLogs(retentionDays: number): void {
  const database = getDb()
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  database.prepare('DELETE FROM activity_log WHERE created_at < ?').run(cutoff)
}

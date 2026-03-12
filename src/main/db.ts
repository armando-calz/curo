import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'

let db: Database.Database | null = null

/** Normaliza un nombre para búsqueda: sin acentos, sin diacríticos, minúsculas. */
export function normalizeName(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export function getDbPath(): string {
  const userData = app.getPath('userData')
  return path.join(userData, 'curo.sqlite')
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath()
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    runMigrations(db)
  }
  return db
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      insurer TEXT,
      insurer_number TEXT,
      phone TEXT,
      email TEXT,
      notes TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS consultations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      patient_id INTEGER NOT NULL REFERENCES patients(id),
      date TEXT NOT NULL,
      text TEXT,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at INTEGER NOT NULL,
      action TEXT NOT NULL,
      description TEXT NOT NULL,
      entity_type TEXT,
      entity_id INTEGER,
      snapshot TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_patients_active ON patients(active);
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
    CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id);
    CREATE INDEX IF NOT EXISTS idx_consultations_active ON consultations(active);
    CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_consultations_patient_active_date ON consultations(patient_id, active, date);
  `)

  // Migration: add name_search column for accent-insensitive search
  try {
    const hasNameSearch = database
      .prepare(`SELECT COUNT(*) as count FROM pragma_table_info('patients') WHERE name = 'name_search'`)
      .get() as { count: number }
    if (hasNameSearch.count === 0) {
      database.exec(`ALTER TABLE patients ADD COLUMN name_search TEXT NOT NULL DEFAULT ''`)
      // Backfill existing rows
      const rows = database.prepare(`SELECT id, name FROM patients`).all() as { id: number; name: string }[]
      const upd = database.prepare(`UPDATE patients SET name_search = ? WHERE id = ?`)
      const backfill = database.transaction(() => {
        for (const row of rows) {
          upd.run(normalizeName(row.name), row.id)
        }
      })
      backfill()
      database.exec(`CREATE INDEX IF NOT EXISTS idx_patients_name_search ON patients(name_search)`)
    }
  } catch (_) {
    // Migration already applied or unsupported SQLite version
  }

  // Migration: drop address column from patients if it exists (SQLite 3.35+)
  try {
    const hasAddress = database
      .prepare(`SELECT COUNT(*) as count FROM pragma_table_info('patients') WHERE name = 'address'`)
      .get() as { count: number }
    if (hasAddress.count > 0) {
      database.exec('ALTER TABLE patients DROP COLUMN address')
    }
  } catch (_) {
    // SQLite < 3.35 or other error; column may still exist but we no longer use it
  }

  // Migration: convert old activity_log schema to new one
  try {
    const hasDescription = database
      .prepare(`SELECT COUNT(*) as count FROM pragma_table_info('activity_log') WHERE name = 'description'`)
      .get() as { count: number }
    
    if (hasDescription.count === 0) {
      // Old schema detected, migrate
      database.exec(`
        CREATE TABLE activity_log_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          created_at INTEGER NOT NULL,
          action TEXT NOT NULL,
          description TEXT NOT NULL,
          entity_type TEXT,
          entity_id INTEGER,
          snapshot TEXT
        );
        
        INSERT INTO activity_log_new (id, created_at, action, description, entity_type, entity_id, snapshot)
        SELECT 
          id,
          CAST((julianday(created_at) - 2440587.5) * 86400000 AS INTEGER) as created_at,
          'update' as action,
          action as description,
          entity_type,
          entity_id,
          NULL as snapshot
        FROM activity_log;
        
        DROP TABLE activity_log;
        ALTER TABLE activity_log_new RENAME TO activity_log;
        
        CREATE INDEX idx_activity_log_created_at ON activity_log(created_at);
      `)
    }
  } catch (err) {
    // Si la tabla no existe o hay otro error, se ignora (ya se creó arriba)
  }
}

export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

import fs from 'fs'
import path from 'path'
import Database from 'better-sqlite3'
import { getDbPath, getDb, closeDb } from './db'
import { loadConfig, saveConfig } from './config'
import { writeLog } from './logger'

let restoreInProgress = false

function userFriendlyError(raw: string): string {
  if (/ENOSPC|no space left|disk full/i.test(raw)) {
    return (
      'No se pudo guardar el respaldo.\n' +
      'El disco está lleno. Libere espacio o seleccione otra carpeta.'
    )
  }

  // Carpeta o unidad no disponible (USB desconectada, ruta eliminada, etc.)
  if (/ENOENT|no such file|not a directory/i.test(raw)) {
    return (
      'No se pudo guardar el respaldo.\n' +
      'La carpeta de respaldos ya no está disponible. ' +
      'Si está usando una memoria USB u otra unidad externa, verifique que siga conectada o seleccione otra carpeta.'
    )
  }

  // Permisos o bloqueo del sistema de archivos / memoria externa
  if (/EACCES|permission denied|EBUSY|EIO/i.test(raw)) {
    return (
      'No se pudo guardar el respaldo.\n' +
      'No se pudo escribir en la carpeta seleccionada. ' +
      'Verifique que la memoria esté conectada, elija otra carpeta o revise los permisos del sistema.'
    )
  }

  return (
    'No se pudo generar el respaldo.\n' +
    'Intente nuevamente. Si continúa, revise la carpeta de respaldos o contacte a soporte.'
  )
}

const BACKUP_PREFIX = 'curo_'
const PRE_RECOVERY_PREFIX = 'pre-recuperacion_'
const BACKUP_EXT = '.sqlite'

const PERIODIC_BACKUP_INTERVAL_MS =
  process.env.NODE_ENV === 'development' ? 2 * 60 * 1000 : 2 * 60 * 60 * 1000

let periodicBackupTimer: ReturnType<typeof setInterval> | null = null

export function schedulePeriodicBackup(): void {
  if (periodicBackupTimer) return
  periodicBackupTimer = setInterval(() => {
    const config = loadConfig()
    if (!config.backupsEnabled || !config.backupPath?.trim()) return
    runBackup('periodic')
  }, PERIODIC_BACKUP_INTERVAL_MS)
}

export function stopPeriodicBackup(): void {
  if (periodicBackupTimer) {
    clearInterval(periodicBackupTimer)
    periodicBackupTimer = null
  }
}

function formatBackupName(prefix: string): string {
  const now = new Date()
  const Y = now.getFullYear()
  const M = String(now.getMonth() + 1).padStart(2, '0')
  const D = String(now.getDate()).padStart(2, '0')
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${prefix}${Y}-${M}-${D}_${h}-${m}${BACKUP_EXT}`
}

function getBackupFilesInFolder(folderPath: string): { fullPath: string; name: string; mtime: Date }[] {
  if (!fs.existsSync(folderPath)) return []
  const names = fs.readdirSync(folderPath)
  const result: { fullPath: string; name: string; mtime: Date }[] = []
  for (const name of names) {
    if (!name.endsWith(BACKUP_EXT) || (!name.startsWith(BACKUP_PREFIX) && !name.startsWith(PRE_RECOVERY_PREFIX))) continue
    const fullPath = path.join(folderPath, name)
    try {
      const stat = fs.statSync(fullPath)
      if (stat.isFile()) result.push({ fullPath, name, mtime: stat.mtime })
    } catch {
      // skip
    }
  }
  return result
}

function applyRetention(folderPath: string, retentionDays: number): void {
  if (retentionDays <= 0) return
  const files = getBackupFilesInFolder(folderPath)
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000
  for (const f of files) {
    if (f.mtime.getTime() < cutoff) {
      try {
        fs.unlinkSync(f.fullPath)
      } catch {
        // ignore
      }
    }
  }
}

function applyPerDayLimit(folderPath: string, maxPerDay: number, keep?: string): void {
  if (maxPerDay <= 0) return
  const files = getBackupFilesInFolder(folderPath)
  const today = new Date().toDateString()
  const todayFiles = files.filter((f) => f.mtime.toDateString() === today)
  if (todayFiles.length <= maxPerDay) return
  const deletable = todayFiles
    .filter((f) => f.fullPath !== keep)
    .sort((a, b) => a.mtime.getTime() - b.mtime.getTime())
  let excess = todayFiles.length - maxPerDay
  for (const f of deletable) {
    if (excess <= 0) break
    try {
      fs.unlinkSync(f.fullPath)
      excess--
    } catch {
      break
    }
  }
}

/** Remove WAL and SHM sidecar files so a restored DB starts clean. */
function removeWalFiles(): void {
  const dbPath = getDbPath()
  for (const ext of ['-wal', '-shm']) {
    const p = dbPath + ext
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      throw new Error(
        `No se pudo eliminar ${ext}. Cierre otras aplicaciones que puedan estar usando la base de datos. (${msg})`
      )
    }
  }
}

/**
 * Create a consistent backup using VACUUM INTO. Unlike a raw file copy,
 * this works correctly regardless of WAL state and produces a standalone,
 * compact database file.  Falls back to checkpoint + file copy if the
 * VACUUM INTO path is rejected by SQLite (e.g. path-encoding edge cases).
 */
function safeDbCopy(destPath: string): void {
  if (fs.existsSync(destPath)) fs.unlinkSync(destPath)
  const db = getDb()
  const escaped = destPath.replace(/'/g, "''")
  try {
    db.exec(`VACUUM INTO '${escaped}'`)
  } catch {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)')
    fs.copyFileSync(getDbPath(), destPath)
  }
}

export type BackupSource = 'manual' | 'onClose' | 'periodic'

function backupSourceLabel(source: BackupSource): string {
  switch (source) {
    case 'manual':
      return 'manual'
    case 'onClose':
      return 'automático al cerrar'
    case 'periodic':
      return 'automático por tiempo'
  }
}

export function runBackup(source: BackupSource = 'manual'): { success: boolean; error?: string } {
  const config = loadConfig()
  if (!config.backupPath || !config.backupPath.trim()) {
    return { success: false, error: 'No hay carpeta de respaldos configurada.\nVaya a Configuración para seleccionarla.' }
  }
  try {
    if (!fs.existsSync(config.backupPath)) {
      fs.mkdirSync(config.backupPath, { recursive: true })
    }
    applyRetention(config.backupPath, config.retentionDays)
    const destName = formatBackupName(BACKUP_PREFIX)
    const destPath = path.join(config.backupPath, destName)
    safeDbCopy(destPath)
    applyPerDayLimit(config.backupPath, config.maxBackupsPerDay, destPath)
    writeLog('info', `Backup (${backupSourceLabel(source)}): ${destName}`)
    return { success: true }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    writeLog('error', `Backup (${backupSourceLabel(source)}) failed: ${raw}`)
    return { success: false, error: userFriendlyError(raw) }
  }
}

export function runBackupOnClose(): { success: boolean; error?: string } {
  const config = loadConfig()
  if (!config.backupsEnabled || !config.backupPath?.trim()) return { success: true }
  const result = runBackup('onClose')
  if (!result.success) {
    saveConfig({ lastAutoBackupError: result.error ?? 'Error desconocido' })
    writeLog('error', `Auto-backup on close failed: ${result.error}`)
  }
  return result
}

export function hasData(): boolean {
  try {
    const db = getDb()
    const row = db.prepare('SELECT COUNT(*) as n FROM patients').get() as { n: number }
    return row.n > 0
  } catch {
    return false
  }
}

export function restore(backupFilePath: string): { success: boolean; error?: string } {
  if (restoreInProgress) {
    return { success: false, error: 'Ya hay una operación de restauración en curso.' }
  }

  const config = loadConfig()
  try {
    restoreInProgress = true

    if (!fs.existsSync(backupFilePath)) {
      return { success: false, error: 'El archivo no existe.' }
    }

    // Validar que sea SQLite válido
    try {
      const testDb = new Database(backupFilePath, { readonly: true })
      testDb.close()
    } catch (e) {
      return {
        success: false,
        error: 'El archivo seleccionado no es una base de datos válida o está corrupto.',
      }
    }

    const dbPath = getDbPath()
    let preRecoveryPath: string | null = null

    if (hasData() && config.backupPath?.trim()) {
      const preName = formatBackupName(PRE_RECOVERY_PREFIX)
      preRecoveryPath = path.join(config.backupPath, preName)
      if (!fs.existsSync(config.backupPath)) {
        fs.mkdirSync(config.backupPath, { recursive: true })
      }
      safeDbCopy(preRecoveryPath)
      closeDb()
    } else {
      closeDb()
    }

    removeWalFiles()
    fs.copyFileSync(backupFilePath, dbPath)
    if (preRecoveryPath) {
      saveConfig({ lastPreRecoveryBackupPath: preRecoveryPath })
    }
    writeLog('info', `Restore completed: ${backupFilePath}`)
    return { success: true }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    writeLog('error', `Restore failed: ${raw}`)
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    restoreInProgress = false
  }
}

export function revertRecovery(): { success: boolean; error?: string } {
  if (restoreInProgress) {
    return { success: false, error: 'Ya hay una operación de restauración en curso.' }
  }

  const config = loadConfig()
  const pathToRestore = config.lastPreRecoveryBackupPath
  if (!pathToRestore || !fs.existsSync(pathToRestore)) {
    return { success: false, error: 'No hay respaldo previo para revertir.' }
  }
  try {
    restoreInProgress = true
    closeDb()
    removeWalFiles()
    const dbPath = getDbPath()
    fs.copyFileSync(pathToRestore, dbPath)
    saveConfig({ lastPreRecoveryBackupPath: null })
    writeLog('info', 'Revert recovery completed')
    return { success: true }
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e)
    writeLog('error', `Revert recovery failed: ${raw}`)
    return { success: false, error: e instanceof Error ? e.message : String(e) }
  } finally {
    restoreInProgress = false
  }
}

export function canRevert(): boolean {
  const config = loadConfig()
  return !!(config.lastPreRecoveryBackupPath && fs.existsSync(config.lastPreRecoveryBackupPath))
}

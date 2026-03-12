import { app } from 'electron'
import fs from 'fs'
import path from 'path'

export interface BackupConfig {
  backupPath: string
  backupsEnabled: boolean
  retentionDays: number
  maxBackupsPerDay: number
  activityLogRetentionDays: number
  lastPreRecoveryBackupPath: string | null
  lastAutoBackupError: string | null
}

const DEFAULT_CONFIG: BackupConfig = {
  backupPath: '',
  backupsEnabled: true,
  retentionDays: 10,
  maxBackupsPerDay: 3,
  activityLogRetentionDays: 90,
  lastPreRecoveryBackupPath: null,
  lastAutoBackupError: null,
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'curo-config.json')
}

export function loadConfig(): BackupConfig {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8')
    const parsed = JSON.parse(raw) as Partial<BackupConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(partial: Partial<BackupConfig>): BackupConfig {
  const current = loadConfig()
  const next = { ...current, ...partial }
  fs.writeFileSync(getConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

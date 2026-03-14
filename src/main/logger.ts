import log from 'electron-log/main'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

const LOG_RETENTION_DAYS = 7

let logsDir: string | null = null

function getLogsDir(): string {
  if (!logsDir) {
    logsDir = path.join(app.getPath('userData'), 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
  }
  return logsDir
}

export function initLogger(): void {
  log.transports.file.resolvePathFn = () => {
    const dir = getLogsDir()
    const now = new Date()
    const Y = now.getFullYear()
    const M = String(now.getMonth() + 1).padStart(2, '0')
    const D = String(now.getDate()).padStart(2, '0')
    return path.join(dir, `curo_${Y}-${M}-${D}.log`)
  }
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.console.level = false
}

export function writeLog(level: 'info' | 'warn' | 'error', message: string): void {
  log[level](message)
}

export function cleanOldLogFiles(): void {
  try {
    const dir = getLogsDir()
    const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
    for (const file of fs.readdirSync(dir)) {
      if (!file.startsWith('curo_') || !file.endsWith('.log')) continue
      const fullPath = path.join(dir, file)
      if (fs.statSync(fullPath).mtime.getTime() < cutoff) fs.unlinkSync(fullPath)
    }
  } catch {
    // ignore cleanup errors
  }
}

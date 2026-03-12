import log from 'electron-log/main'
import os from 'os'
import path from 'path'
import fs from 'fs'
import { loadConfig } from './config'

const LOG_RETENTION_DAYS = 3

export function initLogger(): void {
  log.transports.file.resolvePathFn = () => {
    const config = loadConfig()
    if (!config.backupPath?.trim()) return path.join(os.tmpdir(), 'curo-nolog.log')
    const logsDir = path.join(config.backupPath, '..', 'logs')
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })
    const now = new Date()
    const Y = now.getFullYear()
    const M = String(now.getMonth() + 1).padStart(2, '0')
    const D = String(now.getDate()).padStart(2, '0')
    return path.join(logsDir, `curo_${Y}-${M}-${D}.log`)
  }
  log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}] [{level}] {text}'
  log.transports.console.level = false
}

export function writeLog(level: 'info' | 'warn' | 'error', message: string): void {
  const config = loadConfig()
  if (!config.backupPath?.trim()) return
  log[level](message)
}

export function cleanOldLogFiles(): void {
  const config = loadConfig()
  if (!config.backupPath?.trim()) return
  const logsDir = path.join(config.backupPath, '..', 'logs')
  if (!fs.existsSync(logsDir)) return
  const cutoff = Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000
  try {
    for (const file of fs.readdirSync(logsDir)) {
      if (!file.startsWith('curo_') || !file.endsWith('.log')) continue
      const fullPath = path.join(logsDir, file)
      if (fs.statSync(fullPath).mtime.getTime() < cutoff) fs.unlinkSync(fullPath)
    }
  } catch {
    // ignore
  }
}

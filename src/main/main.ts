import { app, BrowserWindow, dialog } from 'electron'
import path from 'path'
import { registerIpc } from './ipc'
import { closeDb } from './db'
import * as backup from './backup'
import { cleanOldLogs } from './activityLog'
import { loadConfig } from './config'
import { initLogger, writeLog, cleanOldLogFiles } from './logger'
import { LicenseManager } from './license/LicenseManager'
import type { LicenseInfo } from './license/types'

const isDev = process.env.NODE_ENV === 'development'
let forceQuit = false
let backupDoneForQuit = false
let licenseCheckTimer: ReturnType<typeof setInterval> | null = null

function getIconPath(): string {
  const iconName = 'CuroLogoIcon.png'
  return isDev && __dirname.includes('dist')
    ? path.join(__dirname, '../../src/renderer/public', iconName)
    : path.join(__dirname, '../renderer', iconName)
}

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

app.whenReady().then(() => {
  initLogger()
  cleanOldLogFiles()
  writeLog('info', 'Aplicación iniciada')

  const licenseManager = new LicenseManager(app.getPath('userData'))
  registerIpc(licenseManager)

  const iconPath = getIconPath()
  if (app.dock && typeof app.dock.setIcon === 'function') {
    app.dock.setIcon(iconPath)
  }

  const licenseInfo = licenseManager.check()
  createWindow(licenseInfo)

  const config = loadConfig()
  cleanOldLogs(config.activityLogRetentionDays)
  backup.schedulePeriodicBackup()
  backupDoneForQuit = false

  // Re-verificar la licencia cada 24h y notificar al renderer
  licenseCheckTimer = setInterval(
    () => {
      const win = getWindow()
      if (!win) return
      const info = licenseManager.check()
      win.webContents.send('license:status', info)
    },
    24 * 60 * 60 * 1000
  )
})

app.on('window-all-closed', () => {
  if (!backupDoneForQuit) {
    backup.runBackupOnClose()
    if (process.platform === 'darwin') writeLog('info', 'Aplicación cerrada')
  }
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (event) => {
  if (licenseCheckTimer) clearInterval(licenseCheckTimer)
  backup.stopPeriodicBackup()
  if (forceQuit) {
    closeDb()
    return
  }
  event.preventDefault()
  backupDoneForQuit = true
  const result = backup.runBackupOnClose()
  if (result.success) {
    writeLog('info', 'Aplicación cerrada')
    closeDb()
    forceQuit = true
    app.quit()
  } else {
    const win = getWindow()
    const opts = {
      type: 'warning' as const,
      title: 'No se pudo guardar el respaldo',
      message: (result.error ?? 'No se pudo generar el respaldo automático.').replace(/\n/g, ' '),
      detail: 'Puede permanecer para intentar un respaldo manual desde Configuración, o cerrar de todas formas.',
      buttons: ['No, permanecer', 'Sí, cerrar'],
      defaultId: 0,
      cancelId: 0,
    }
    ;(win ? dialog.showMessageBox(win, opts) : dialog.showMessageBox(opts)).then(({ response }) => {
      if (response === 1) {
        writeLog('info', 'Aplicación cerrada')
        forceQuit = true
        app.quit()
      } else {
        backupDoneForQuit = false
      }
    })
  }
})

function createWindow(licenseInfo: LicenseInfo): void {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    title: 'curo',
    icon: getIconPath(),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev && process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  // Enviar el estado de la licencia en cuanto el renderer esté listo
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('license:status', licenseInfo)
  })
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    const lm = new LicenseManager(app.getPath('userData'))
    createWindow(lm.check())
  }
})

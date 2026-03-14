import { app, BrowserWindow, dialog, Menu, powerMonitor } from 'electron'
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

// En Windows/Linux: quitar la barra de menú por completo.
// En macOS: mantener un menú mínimo para que funcionen los atajos
// del sistema (Cmd+C, Cmd+V, Cmd+Z, Cmd+Q, etc.).
if (process.platform === 'darwin') {
  const macMenu = Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
  ])
  Menu.setApplicationMenu(macMenu)
} else {
  Menu.setApplicationMenu(null)
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

  // Re-verificar también al despertar del sleep, por si el interval fue throttled
  powerMonitor.on('resume', () => {
    const win = getWindow()
    if (!win) return
    const info = licenseManager.check()
    win.webContents.send('license:status', info)
  })
})

app.on('window-all-closed', () => {
  // Siempre salir cuando se cierra la última ventana.
  // Esta app no tiene caso de uso de "correr en segundo plano".
  app.quit()
})

app.on('before-quit', (event) => {
  // Si el backup ya fue procesado o ya estamos en modo forceQuit, proceder con limpieza.
  if (forceQuit || backupDoneForQuit) {
    if (licenseCheckTimer) clearInterval(licenseCheckTimer)
    backup.stopPeriodicBackup()
    closeDb()
    return
  }

  // Aún no se ha intentado el backup: prevenir el quit y delegar al win.on('close').
  event.preventDefault()
  const win = getWindow()
  if (win) {
    win.close()
  } else {
    // No hay ventana abierta — proceder directamente sin backup.
    forceQuit = true
    app.quit()
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

  // Interceptar el cierre de la ventana para intentar backup primero
  win.on('close', (event) => {
    // Único caso donde permitimos que la ventana cierre sin prevenir.
    if (forceQuit) return

    // Siempre prevenir primero — esto evita que la ventana se cierre
    // mientras el diálogo de backup fallido está visible.
    event.preventDefault()

    // Si ya está en progreso el intento de backup, no volver a intentarlo.
    if (backupDoneForQuit) return

    backupDoneForQuit = true
    const result = backup.runBackupOnClose()
    
    if (result.success) {
      writeLog('info', 'Aplicación cerrada')
      forceQuit = true
      win.close()
    } else {
      const opts = {
        type: 'warning' as const,
        title: 'No se pudo guardar el respaldo',
        message: (result.error ?? 'No se pudo generar el respaldo automático.').replace(/\n/g, ' '),
        detail: 'Puede permanecer para intentar un respaldo manual desde Configuración, o cerrar de todas formas.',
        buttons: ['No, permanecer', 'Sí, cerrar'],
        defaultId: 0,
        cancelId: 0,
      }
      dialog.showMessageBox(win, opts).then(({ response }) => {
        if (response === 1) {
          writeLog('info', 'Aplicación cerrada sin respaldo')
          forceQuit = true
          win.close()
        } else {
          backupDoneForQuit = false
        }
      })
    }
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
  // En macOS, recrear la ventana cuando se hace clic en el ícono del dock
  if (BrowserWindow.getAllWindows().length === 0) {
    backupDoneForQuit = false
    forceQuit = false
    const lm = new LicenseManager(app.getPath('userData'))
    createWindow(lm.check())
  }
})

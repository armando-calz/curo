import { ipcMain, dialog, BrowserWindow, app } from 'electron'
import * as patients from './patients'
import * as consultations from './consultations'
import { loadConfig, saveConfig, BackupConfig } from './config'
import * as backup from './backup'
import * as activityLog from './activityLog'
import { LicenseManager, LicenseError } from './license/LicenseManager'
import { CLIENT_NAME } from './license/buildSecrets'

function getWindow(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0] || null
}

export function registerIpc(licenseManager: LicenseManager): void {
  // License
  ipcMain.handle('license:check', () => licenseManager.check())
  ipcMain.handle('license:activate', (_event, rawKey: string) => {
    try {
      return { ok: true, data: licenseManager.activate(rawKey) }
    } catch (err) {
      const message = err instanceof LicenseError ? err.message : 'Error al activar la clave.'
      return { ok: false, error: message }
    }
  })
  ipcMain.handle('license:revoke', () => {
    licenseManager.revoke()
  })

  // Patients
  ipcMain.handle(
    'patients:list',
    (_, search?: string, sortBy?: 'name' | 'lastConsultation', order?: 'asc' | 'desc', page?: number) =>
      patients.listPatients(search, sortBy ?? 'name', order ?? 'asc', page ?? 0)
  )
  ipcMain.handle('patients:get', (_, id: number) => patients.getPatient(id))
  ipcMain.handle('patients:create', (_, data: patients.PatientInsert) => patients.createPatient(data))
  ipcMain.handle('patients:update', (_, id: number, data: Partial<patients.PatientInsert>) =>
    patients.updatePatient(id, data)
  )
  ipcMain.handle('patients:deactivate', (_, id: number) => patients.deactivatePatient(id))
  ipcMain.handle('patients:reactivate', (_, id: number) => patients.reactivatePatient(id))

  // Consultations
  ipcMain.handle('consultations:listByPatient', (_, patientId: number) =>
    consultations.listConsultationsByPatient(patientId)
  )
  ipcMain.handle('consultations:get', (_, id: number) => consultations.getConsultation(id))
  ipcMain.handle('consultations:create', (_, data: consultations.ConsultationInsert) =>
    consultations.createConsultation(data)
  )
  ipcMain.handle(
    'consultations:update',
    (_, id: number, data: Partial<{ date: string; text: string }>) =>
      consultations.updateConsultation(id, data)
  )
  ipcMain.handle('consultations:deactivate', (_, id: number) =>
    consultations.deactivateConsultation(id)
  )
  ipcMain.handle('consultations:reactivate', (_, id: number) =>
    consultations.reactivateConsultation(id)
  )

  // Activity log
  ipcMain.handle('activityLog:list', (_, limit?: number) => activityLog.listActivityLog(limit))
  ipcMain.handle('activityLog:revertUpdate', (_, entry: activityLog.ActivityLogEntry) => {
    if (entry.action !== 'update' || !entry.snapshot || entry.entity_type == null || entry.entity_id == null) {
      return { success: false, error: 'Esta acción no se puede revertir' }
    }
    try {
      const snapshot = JSON.parse(entry.snapshot) as Record<string, unknown>
      if (entry.entity_type === 'patient') {
        patients.revertPatient(entry.entity_id, snapshot)
        return { success: true }
      } else if (entry.entity_type === 'consultation') {
        consultations.revertConsultation(entry.entity_id, snapshot)
        return { success: true }
      }
      return { success: false, error: 'Tipo de entidad desconocido' }
    } catch (err) {
      return { success: false, error: 'Error al revertir la edición' }
    }
  })

  // Config (backup settings)
  ipcMain.handle('config:get', () => loadConfig())
  ipcMain.handle('config:set', (_, partial: Partial<BackupConfig>) => {
    const next = saveConfig(partial)
    if (partial.backupsEnabled !== undefined) {
      activityLog.logAction(
        'config',
        next.backupsEnabled ? 'Respaldos automáticos activados' : 'Respaldos automáticos desactivados'
      )
    }
    return next
  })
  ipcMain.handle('config:selectBackupFolder', async () => {
    const win = getWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openDirectory'],
      title: 'Elegir carpeta de respaldos',
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })

  // Backup
  ipcMain.handle('backup:runNow', () => backup.runBackup('manual'))
  ipcMain.handle('backup:selectFileForRestore', async () => {
    const win = getWindow()
    const { canceled, filePaths } = await dialog.showOpenDialog(win!, {
      properties: ['openFile'],
      title: 'Seleccionar archivo de respaldo',
      filters: [{ name: 'SQLite', extensions: ['sqlite'] }],
    })
    if (canceled || filePaths.length === 0) return null
    return filePaths[0]
  })
  ipcMain.handle('backup:restore', (_, filePath: string) => {
    const result = backup.restore(filePath)
    if (result.success) {
      const win = getWindow()
      if (win) win.webContents.reloadIgnoringCache()
    }
    return result
  })
  ipcMain.handle('backup:revertRecovery', () => {
    const result = backup.revertRecovery()
    if (result.success) {
      const win = getWindow()
      if (win) win.webContents.reloadIgnoringCache()
    }
    return result
  })
  ipcMain.handle('backup:canRevert', () => backup.canRevert())
  ipcMain.handle('backup:hasData', () => backup.hasData())
  ipcMain.handle('backup:getPendingError', () => loadConfig().lastAutoBackupError)
  ipcMain.handle('backup:clearPendingError', () => saveConfig({ lastAutoBackupError: null }))

  ipcMain.handle('app:quit', () => {
    const win = getWindow()
    if (win) win.close()
  })
  ipcMain.handle('app:getClientName', () => CLIENT_NAME)
  ipcMain.handle('app:getVersion', () => app.getVersion())
}

import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('curo', {
  ping: () => true,

  license: {
    check: (): Promise<LicenseInfo> => ipcRenderer.invoke('license:check'),
    activate: (rawKey: string): Promise<{ ok: boolean; data?: LicenseInfo; error?: string }> =>
      ipcRenderer.invoke('license:activate', rawKey),
    onStatus: (cb: (info: LicenseInfo) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: LicenseInfo) => cb(info)
      ipcRenderer.on('license:status', handler)
      return () => ipcRenderer.removeListener('license:status', handler)
    },
    revoke: (): Promise<void> => ipcRenderer.invoke('license:revoke'),
  },

  patients: {
    list: (search?: string, sortBy?: 'name' | 'lastConsultation', order?: 'asc' | 'desc', page?: number) =>
      ipcRenderer.invoke('patients:list', search, sortBy, order, page),
    get: (id: number) => ipcRenderer.invoke('patients:get', id),
    create: (data: PatientInsert) => ipcRenderer.invoke('patients:create', data),
    update: (id: number, data: Partial<PatientInsert>) =>
      ipcRenderer.invoke('patients:update', id, data),
    deactivate: (id: number) => ipcRenderer.invoke('patients:deactivate', id),
    reactivate: (id: number) => ipcRenderer.invoke('patients:reactivate', id),
  },

  consultations: {
    listByPatient: (patientId: number) =>
      ipcRenderer.invoke('consultations:listByPatient', patientId),
    get: (id: number) => ipcRenderer.invoke('consultations:get', id),
    create: (data: ConsultationInsert) =>
      ipcRenderer.invoke('consultations:create', data),
    update: (id: number, data: Partial<{ date: string; text: string }>) =>
      ipcRenderer.invoke('consultations:update', id, data),
    deactivate: (id: number) => ipcRenderer.invoke('consultations:deactivate', id),
    reactivate: (id: number) => ipcRenderer.invoke('consultations:reactivate', id),
  },

  activityLog: {
    list: (limit?: number) => ipcRenderer.invoke('activityLog:list', limit),
    revertUpdate: (entry: any) => ipcRenderer.invoke('activityLog:revertUpdate', entry),
  },

  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (partial: Partial<BackupConfig>) => ipcRenderer.invoke('config:set', partial),
    selectBackupFolder: () => ipcRenderer.invoke('config:selectBackupFolder'),
  },

  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    getClientName: (): Promise<string> => ipcRenderer.invoke('app:getClientName'),
    getVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  },

  backup: {
    runNow: () => ipcRenderer.invoke('backup:runNow'),
    selectFileForRestore: () => ipcRenderer.invoke('backup:selectFileForRestore'),
    restore: (filePath: string) => ipcRenderer.invoke('backup:restore', filePath),
    revertRecovery: () => ipcRenderer.invoke('backup:revertRecovery'),
    canRevert: () => ipcRenderer.invoke('backup:canRevert'),
    hasData: () => ipcRenderer.invoke('backup:hasData'),
    getPendingError: () => ipcRenderer.invoke('backup:getPendingError'),
    clearPendingError: () => ipcRenderer.invoke('backup:clearPendingError'),
  },
})

interface LicenseInfo {
  status: 'unlicensed' | 'expired' | 'expiring_soon' | 'valid' | 'permanent'
  expires: string | null
  days_left: number | null
}

interface BackupConfig {
  backupPath: string
  backupsEnabled: boolean
  retentionDays: number
  maxBackupsPerDay: number
  activityLogRetentionDays: number
  lastPreRecoveryBackupPath: string | null
  lastAutoBackupError: string | null
}

// Types for preload (not exposed to renderer; renderer will define its own or use shared types)
interface PatientInsert {
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
}

interface ConsultationInsert {
  patient_id: number
  date: string
  text?: string
}

/// <reference types="vite/client" />

interface PatientInsert {
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
}

interface Patient {
  id: number
  name: string
  insurer?: string
  insurer_number?: string
  phone?: string
  email?: string
  notes?: string
  active: boolean
}

interface PatientWithLastConsultation extends Patient {
  last_consultation_date: string | null
}

interface PatientListResult {
  patients: PatientWithLastConsultation[]
  total: number
  hasMore: boolean
}

interface ConsultationInsert {
  patient_id: number
  date: string
  text?: string
}

interface Consultation {
  id: number
  patient_id: number
  date: string
  text?: string
  active: boolean
}

interface ActivityLogEntry {
  id: number
  created_at: number
  action: 'create' | 'update' | 'deactivate' | 'reactivate' | 'config'
  description: string
  entity_type: string | null
  entity_id: number | null
  snapshot: string | null
  revertible: boolean
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

interface LicenseInfo {
  status: 'unlicensed' | 'expired' | 'expiring_soon' | 'valid' | 'permanent'
  expires: string | null
  days_left: number | null
}

interface Window {
  curo: {
    ping: () => boolean
    app: {
      quit: () => Promise<void>
      getClientName: () => Promise<string>
    }
    license: {
      check: () => Promise<LicenseInfo>
      activate: (rawKey: string) => Promise<{ ok: boolean; data?: LicenseInfo; error?: string }>
      onStatus: (cb: (info: LicenseInfo) => void) => () => void
      revoke: () => Promise<void>
    }
    patients: {
      list: (search?: string, sortBy?: 'name' | 'lastConsultation', order?: 'asc' | 'desc', page?: number) => Promise<PatientListResult>
      get: (id: number) => Promise<Patient | null>
      create: (data: PatientInsert) => Promise<number>
      update: (id: number, data: Partial<PatientInsert>) => Promise<void>
      deactivate: (id: number) => Promise<void>
      reactivate: (id: number) => Promise<void>
    }
    consultations: {
      listByPatient: (patientId: number) => Promise<Consultation[]>
      get: (id: number) => Promise<Consultation | null>
      create: (data: ConsultationInsert) => Promise<number>
      update: (id: number, data: Partial<{ date: string; text: string }>) => Promise<void>
      deactivate: (id: number) => Promise<void>
      reactivate: (id: number) => Promise<void>
    }
    activityLog: {
      list: (limit?: number) => Promise<ActivityLogEntry[]>
      revertUpdate: (entry: ActivityLogEntry) => Promise<{ success: boolean; error?: string }>
    }
    config: {
      get: () => Promise<BackupConfig>
      set: (partial: Partial<BackupConfig>) => Promise<BackupConfig>
      selectBackupFolder: () => Promise<string | null>
    }
    backup: {
      runNow: () => Promise<{ success: boolean; error?: string }>
      selectFileForRestore: () => Promise<string | null>
      restore: (filePath: string) => Promise<{ success: boolean; error?: string }>
      revertRecovery: () => Promise<{ success: boolean; error?: string }>
      canRevert: () => Promise<boolean>
      hasData: () => Promise<boolean>
      getPendingError: () => Promise<string | null>
      clearPendingError: () => Promise<void>
    }
  }
}

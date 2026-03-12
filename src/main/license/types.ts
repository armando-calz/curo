export type LicenseStatus =
  | 'unlicensed'    // sin clave guardada, o MAC inválido
  | 'expired'       // fecha de expiración pasada
  | 'expiring_soon' // válida pero vence en < WARN_DAYS días
  | 'valid'         // activa y no próxima a vencer
  | 'permanent'     // sin fecha de expiración (exp_days === 0xFFFF)

export const WARN_DAYS = 30
export const PERMANENT_SENTINEL = 0xffff
export const EPOCH = new Date('2024-01-01T00:00:00Z')

export interface StoredKey {
  raw_key: string      // "XXXXX-XXXXX-XXXXX-XXXXX"
  expires: string | null // "YYYY-MM-DD" o null si permanente
}

export interface LicenseInfo {
  status: LicenseStatus
  expires: string | null
  days_left: number | null // null si permanent o unlicensed
}

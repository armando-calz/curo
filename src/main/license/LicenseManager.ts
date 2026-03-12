import { createHmac, timingSafeEqual } from 'crypto'
import fs from 'fs'
import path from 'path'
import {
  EPOCH,
  PERMANENT_SENTINEL,
  WARN_DAYS,
  type LicenseInfo,
  type LicenseStatus,
  type StoredKey,
} from './types'
import { HMAC_SECRET } from './buildSecrets'

// ---------------------------------------------------------------------------
// Base32 decode (RFC 4648, uppercase, no padding required)
// ---------------------------------------------------------------------------
const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input: string): Buffer {
  const str = input.replace(/=+$/, '').toUpperCase()
  let bits = 0
  let value = 0
  const output: number[] = []
  for (const char of str) {
    const idx = B32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(output)
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------
function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base)
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function diffDays(expiresISO: string, todayISO: string): number {
  const exp = new Date(expiresISO).getTime()
  const now = new Date(todayISO).getTime()
  return Math.floor((exp - now) / 86_400_000)
}

// ---------------------------------------------------------------------------
// LicenseManager
// ---------------------------------------------------------------------------
export class LicenseManager {
  private readonly storedKeyPath: string

  constructor(userDataPath: string) {
    this.storedKeyPath = path.join(userDataPath, 'license.json')
  }

  // Verifica la clave guardada (sin comprobar ventana de activación).
  // Llamar al arrancar y cada 24h.
  check(): LicenseInfo {
    const stored = this.readStored()
    if (!stored) return this.unlicensed()
    return this.evaluate(stored)
  }

  // Activa una nueva clave. Suma días restantes si la clave es diferente a la
  // actual. Si es la misma clave, no cambia nada.
  activate(rawKey: string): LicenseInfo {
    const normalized = this.normalizeKey(rawKey)
    const decoded = this.decodeKey(normalized)

    if (!decoded) throw new LicenseError('Clave inválida. Verifica que la hayas copiado correctamente.')
    if (decoded.windowClosed) throw new LicenseError('Esta clave ya no puede activarse. Solicita una nueva clave a soporte.')

    const stored = this.readStored()

    // Misma clave → no cambiar nada
    if (stored && this.normalizeKey(stored.raw_key) === normalized) {
      return this.evaluate(stored)
    }

    // Nueva clave: calcular fecha ajustada con acumulación de días
    let finalExpires: string | null = decoded.expires
    if (finalExpires !== null && stored?.expires !== null && stored?.expires) {
      const remaining = Math.max(0, diffDays(stored.expires, todayISO()))
      if (remaining > 0) {
        finalExpires = addDays(new Date(finalExpires), remaining).toISOString().slice(0, 10)
      }
    }

    const next: StoredKey = { raw_key: rawKey, expires: finalExpires }
    this.writeStored(next)
    return this.evaluate(next)
  }

  // Elimina la licencia guardada (solo proveedor).
  revoke(): void {
    try {
      fs.unlinkSync(this.storedKeyPath)
    } catch {
      // ya no existía, no es error
    }
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private decodeKey(normalized: string): {
    expires: string | null
    windowClosed: boolean
  } | null {
    if (normalized.length !== 20) return null

    const bytes = base32Decode(normalized)
    if (bytes.length !== 12) return null

    const payload = bytes.slice(0, 6)
    const claimedMac = bytes.slice(6, 12)

    const expectedMac = createHmac('sha256', HMAC_SECRET).update(payload).digest().slice(0, 6)

    if (!timingSafeEqual(expectedMac, claimedMac)) return null

    const expDays = (payload[0] << 8) | payload[1]
    const issuedHours = (payload[2] << 8) | payload[3]
    const windowHours = payload[4]

    // Comprobar ventana de activación
    const issuedAt = new Date(EPOCH.getTime() + issuedHours * 3_600_000)
    const deadline = new Date(issuedAt.getTime() + windowHours * 3_600_000)
    const windowClosed = Date.now() > deadline.getTime()

    // Licencia permanente
    if (expDays === PERMANENT_SENTINEL) {
      return { expires: null, windowClosed }
    }

    const expires = addDays(EPOCH, expDays).toISOString().slice(0, 10)
    return { expires, windowClosed }
  }

  private evaluate(stored: StoredKey): LicenseInfo {
    // Re-verificar MAC (sin ventana: ya fue activado)
    const normalized = this.normalizeKey(stored.raw_key)
    const decoded = this.decodeKey(normalized)
    if (!decoded) return this.unlicensed()

    // Permanente
    if (stored.expires === null) {
      return { status: 'permanent', expires: null, days_left: null }
    }

    const today = todayISO()
    const daysLeft = diffDays(stored.expires, today)

    let status: LicenseStatus
    if (daysLeft < 0) status = 'expired'
    else if (daysLeft < WARN_DAYS) status = 'expiring_soon'
    else status = 'valid'

    return { status, expires: stored.expires, days_left: Math.max(0, daysLeft) }
  }

  private normalizeKey(rawKey: string): string {
    return rawKey.replace(/-/g, '').toUpperCase()
  }

  private unlicensed(): LicenseInfo {
    return { status: 'unlicensed', expires: null, days_left: null }
  }

  private readStored(): StoredKey | null {
    try {
      const raw = fs.readFileSync(this.storedKeyPath, 'utf-8')
      const parsed = JSON.parse(raw) as StoredKey
      if (typeof parsed.raw_key !== 'string') return null
      
      // Validar expires: debe ser null o fecha ISO válida (YYYY-MM-DD)
      if (parsed.expires !== null) {
        if (typeof parsed.expires !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(parsed.expires)) {
          return null
        }
      }
      
      return parsed
    } catch {
      return null
    }
  }

  private writeStored(stored: StoredKey): void {
    fs.writeFileSync(this.storedKeyPath, JSON.stringify(stored, null, 2), 'utf-8')
  }
}

export class LicenseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LicenseError'
  }
}

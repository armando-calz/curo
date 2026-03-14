/**
 * Generador de claves de licencia (desarrollo y producción).
 * Usa el mismo formato y lógica que LicenseManager en la app.
 *
 * Uso:
 *   node scripts/gen-dev-key.mjs [validity_days] [window_hours]
 *
 * Ejemplos:
 *   node scripts/gen-dev-key.mjs           → 365 días, 24h ventana
 *   node scripts/gen-dev-key.mjs 730 2     → 2 años, 2h ventana
 *   node scripts/gen-dev-key.mjs 0 48      → permanente (0xFFFF), 48h ventana
 *
 * Secreto HMAC:
 *   - Desarrollo (en repo): si no defines HMAC_SECRET_HEX se usa un secreto
 *     de prueba. Para que las claves funcionen en tu build local, tu
 *     buildSecrets.ts debe usar el mismo secreto (o define HMAC_SECRET_HEX).
 *   - Producción / equipo portable: define la variable HMAC_SECRET_HEX con
 *     el secreto del cliente (64 caracteres hex = 32 bytes). Ejemplo:
 *     HMAC_SECRET_HEX=6c32a545cc9e8b3f... node scripts/gen-dev-key.mjs 365 24
 *     En el equipo portable solo necesitas: Node.js instalado + este script
 *     + el valor de HMAC_SECRET_HEX (guárdalo en un .env o script que no
 *     subas a git).
 */

import { createHmac } from 'crypto'

// Secreto: env (producción/portable) o dev por defecto (64 hex = 32 bytes)
const DEV_SECRET_HEX = '6465763064657630646576306465763064657630646576306465763064657630' // "dev0"×8
const hex = process.env.HMAC_SECRET_HEX || DEV_SECRET_HEX
if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
  console.error('Error: HMAC_SECRET_HEX debe ser 64 caracteres hexadecimales (32 bytes).')
  process.exit(1)
}
const HMAC_SECRET = Buffer.from(hex, 'hex')
const EPOCH = new Date('2024-01-01T00:00:00Z')
const PERMANENT_SENTINEL = 0xffff

// ── Base32 (RFC 4648, sin padding) ──────────────────────────────────────────
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Encode(buf) {
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += B32[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) output += B32[(value << (5 - bits)) & 0x1f]
  return output
}

function formatKey(raw) {
  return raw.match(/.{1,5}/g).join('-')
}

// ── Args ─────────────────────────────────────────────────────────────────────
const validityDays = parseInt(process.argv[2] ?? '365', 10)
const windowHours  = Math.min(255, parseInt(process.argv[3] ?? '24', 10))
const isPermanent  = validityDays === 0

// ── Calcular campos ──────────────────────────────────────────────────────────
const now = Date.now()

const issuedHours = Math.floor((now - EPOCH.getTime()) / 3_600_000)
if (issuedHours > 0xffff) {
  console.error('Error: issuedHours overflow. Actualiza EPOCH en buildSecrets.ts.')
  process.exit(1)
}

let expDays
if (isPermanent) {
  expDays = PERMANENT_SENTINEL
} else {
  const expiresAt = new Date(now + validityDays * 86_400_000)
  expDays = Math.floor((expiresAt.getTime() - EPOCH.getTime()) / 86_400_000)
  if (expDays > 0xfffe) {
    console.error('Error: exp_days overflow. Reduce validity_days.')
    process.exit(1)
  }
}

const nonce = Math.floor(Math.random() * 256)

// ── Construir payload (6 bytes) ───────────────────────────────────────────────
const payload = Buffer.alloc(6)
payload[0] = (expDays >> 8) & 0xff
payload[1] = expDays & 0xff
payload[2] = (issuedHours >> 8) & 0xff
payload[3] = issuedHours & 0xff
payload[4] = windowHours & 0xff
payload[5] = nonce & 0xff

// ── MAC (primeros 6 bytes del HMAC-SHA256) ───────────────────────────────────
const mac = createHmac('sha256', HMAC_SECRET).update(payload).digest().slice(0, 6)

// ── Clave final (12 bytes → 20 chars Base32) ──────────────────────────────────
const keyBytes = Buffer.concat([payload, mac])
const rawKey   = base32Encode(keyBytes)
const formatted = formatKey(rawKey)

// ── Output ────────────────────────────────────────────────────────────────────
const expiresLabel = isPermanent
  ? 'Permanente'
  : new Date(EPOCH.getTime() + expDays * 86_400_000).toISOString().slice(0, 10)

const deadline = new Date(now + windowHours * 3_600_000).toISOString().replace('T', ' ').slice(0, 19)

console.log('')
console.log('  Clave generada:', formatted)
console.log('  Expira:        ', expiresLabel)
console.log('  Activar antes: ', deadline, 'UTC')
console.log('  Ventana:       ', windowHours, 'h')
console.log('')

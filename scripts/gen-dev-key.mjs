/**
 * Script de desarrollo para generar claves de licencia.
 * Usa el mismo HMAC_SECRET y lógica que LicenseManager.
 *
 * Uso:
 *   node scripts/gen-dev-key.mjs [validity_days] [window_hours]
 *
 * Ejemplos:
 *   node scripts/gen-dev-key.mjs           → 365 días, 24h ventana
 *   node scripts/gen-dev-key.mjs 730 2     → 2 años, 2h ventana
 *   node scripts/gen-dev-key.mjs 0 48      → permanente (0xFFFF), 48h ventana
 */

import { createHmac } from 'crypto'

// ── Debe coincidir exactamente con buildSecrets.ts ──────────────────────────
const HMAC_SECRET = Buffer.from(
  'dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0dev0',
  'hex'
)
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

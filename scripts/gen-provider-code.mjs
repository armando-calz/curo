/**
 * Genera el código de acceso al Panel de proveedor de hoy (UTC).
 * Debe coincidir con src/main/license/providerCode.ts.
 *
 * Uso:
 *   HMAC_SECRET_HEX=<secreto del cliente> node scripts/gen-provider-code.mjs
 *
 * Sin HMAC_SECRET_HEX usa el secreto de desarrollo (igual que gen-dev-key.mjs).
 * El código vale hoy y mañana hasta que cambie el día UTC siguiente.
 */

import { createHmac } from 'crypto'

const DEV_SECRET_HEX = '6465763064657630646576306465763064657630646576306465763064657630' // "dev0"×8
const hex = process.env.HMAC_SECRET_HEX || DEV_SECRET_HEX
if (hex.length !== 64 || !/^[0-9a-fA-F]+$/.test(hex)) {
  console.error('Error: HMAC_SECRET_HEX debe ser 64 caracteres hexadecimales (32 bytes).')
  process.exit(1)
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
function base32(buf) {
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
  return output
}

const day = new Date().toISOString().slice(0, 10)
const mac = createHmac('sha256', Buffer.from(hex, 'hex')).update(`curo-provider:${day}`).digest()
const code = base32(mac).slice(0, 10)

console.log('')
console.log('  Código de proveedor:', `${code.slice(0, 5)}-${code.slice(5)}`)
console.log('  Día (UTC):          ', day)
console.log('')

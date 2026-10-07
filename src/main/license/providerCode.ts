import { createHmac, timingSafeEqual } from 'crypto'

// Código de acceso al Panel de proveedor.
//
// Se deriva del HMAC_SECRET de cada cliente y cambia cada día (UTC), así que no hay una
// contraseña fija en el código fuente ni compartida entre clientes. Se genera con
// scripts/gen-provider-code.mjs. Se acepta el código de hoy y el de ayer para tolerar
// diferencias de zona horaria.

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const CODE_LENGTH = 10

function base32(buf: Buffer): string {
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

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

export function providerCodeFor(secret: Buffer, date: Date): string {
  const mac = createHmac('sha256', secret).update(`curo-provider:${utcDay(date)}`).digest()
  return base32(mac).slice(0, CODE_LENGTH)
}

function normalize(input: string): string {
  return input.replace(/[\s-]/g, '').toUpperCase()
}

export function verifyProviderCode(secret: Buffer, input: string, now: Date = new Date()): boolean {
  const candidate = Buffer.from(normalize(input))
  if (candidate.length !== CODE_LENGTH) return false
  const yesterday = new Date(now.getTime() - 86_400_000)
  return [now, yesterday].some((day) => timingSafeEqual(candidate, Buffer.from(providerCodeFor(secret, day))))
}

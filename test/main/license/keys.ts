import { createHmac } from 'crypto'
import { EPOCH, PERMANENT_SENTINEL } from '../../../src/main/license/types'

// Builds activation keys the same way scripts/gen-dev-key.mjs does.

export const DEMO_SECRET = Buffer.from('6465763064657630646576306465763064657630646576306465763064657630', 'hex')
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 0x1f]
      bits -= 5
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 0x1f]
  return out
}

export interface KeyOptions {
  /** Days of validity from `issuedAt`; 0 = permanent. */
  validityDays: number
  issuedAt: Date
  windowHours?: number
  nonce?: number
  secret?: Buffer
}

export function makeKey({ validityDays, issuedAt, windowHours = 24, nonce = 7, secret = DEMO_SECRET }: KeyOptions): string {
  const issuedHours = Math.floor((issuedAt.getTime() - EPOCH.getTime()) / 3_600_000)
  const expDays =
    validityDays === 0
      ? PERMANENT_SENTINEL
      : Math.floor((issuedAt.getTime() + validityDays * 86_400_000 - EPOCH.getTime()) / 86_400_000)
  const payload = Buffer.from([expDays >> 8, expDays & 0xff, issuedHours >> 8, issuedHours & 0xff, windowHours, nonce])
  const mac = createHmac('sha256', secret).update(payload).digest().subarray(0, 6)
  return base32(Buffer.concat([payload, mac])).match(/.{5}/g)!.join('-')
}

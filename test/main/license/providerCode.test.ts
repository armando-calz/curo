import { describe, expect, it } from 'vitest'
import { providerCodeFor, verifyProviderCode } from '../../../src/main/license/providerCode'
import { DEMO_SECRET } from './keys'

const NOW = new Date('2026-10-07T12:00:00Z')
const DAY = 86_400_000

describe('provider code', () => {
  it('is 10 Base32 characters and changes every UTC day', () => {
    const today = providerCodeFor(DEMO_SECRET, NOW)

    expect(today).toMatch(/^[A-Z2-7]{10}$/)
    expect(providerCodeFor(DEMO_SECRET, new Date('2026-10-07T23:59:59Z'))).toBe(today)
    expect(providerCodeFor(DEMO_SECRET, new Date('2026-10-08T00:00:00Z'))).not.toBe(today)
  })

  it("accepts today's and yesterday's code only", () => {
    expect(verifyProviderCode(DEMO_SECRET, providerCodeFor(DEMO_SECRET, NOW), NOW)).toBe(true)
    expect(verifyProviderCode(DEMO_SECRET, providerCodeFor(DEMO_SECRET, new Date(NOW.getTime() - DAY)), NOW)).toBe(true)
    expect(verifyProviderCode(DEMO_SECRET, providerCodeFor(DEMO_SECRET, new Date(NOW.getTime() - 2 * DAY)), NOW)).toBe(
      false
    )
    expect(verifyProviderCode(DEMO_SECRET, providerCodeFor(DEMO_SECRET, new Date(NOW.getTime() + DAY)), NOW)).toBe(false)
  })

  it('ignores case, spaces and dashes', () => {
    const code = providerCodeFor(DEMO_SECRET, NOW)

    expect(verifyProviderCode(DEMO_SECRET, ` ${code.slice(0, 5).toLowerCase()}-${code.slice(5)} `, NOW)).toBe(true)
  })

  it('differs between clients', () => {
    const otherClient = Buffer.alloc(32, 1)

    expect(providerCodeFor(otherClient, NOW)).not.toBe(providerCodeFor(DEMO_SECRET, NOW))
    expect(verifyProviderCode(otherClient, providerCodeFor(DEMO_SECRET, NOW), NOW)).toBe(false)
  })

  it('rejects empty and wrong-length input', () => {
    expect(verifyProviderCode(DEMO_SECRET, '', NOW)).toBe(false)
    expect(verifyProviderCode(DEMO_SECRET, 'ABC', NOW)).toBe(false)
    expect(verifyProviderCode(DEMO_SECRET, providerCodeFor(DEMO_SECRET, NOW) + 'A', NOW)).toBe(false)
  })
})

import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LicenseError, LicenseManager } from '../../../src/main/license/LicenseManager'
import { makeKey } from './keys'

const NOW = new Date('2026-10-07T12:00:00Z')

describe('LicenseManager', () => {
  let dir: string
  let manager: LicenseManager

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'curo-license-'))
    manager = new LicenseManager(dir)
  })

  afterEach(() => {
    vi.useRealTimers()
    fs.rmSync(dir, { recursive: true, force: true })
  })

  it('starts unlicensed', () => {
    expect(manager.check()).toEqual({ status: 'unlicensed', expires: null, days_left: null })
  })

  it('activates a valid key and persists it', () => {
    const info = manager.activate(makeKey({ validityDays: 365, issuedAt: NOW }))

    expect(info.status).toBe('valid')
    expect(info.expires).toBe('2027-10-07')
    expect(new LicenseManager(dir).check()).toEqual(info)
  })

  it('accepts keys typed in lowercase or without dashes', () => {
    const key = makeKey({ validityDays: 365, issuedAt: NOW })

    expect(manager.activate(key.replace(/-/g, '').toLowerCase()).status).toBe('valid')
  })

  it('rejects a key with a tampered character', () => {
    const key = makeKey({ validityDays: 365, issuedAt: NOW })
    const tampered = (key[0] === 'A' ? 'B' : 'A') + key.slice(1)

    expect(() => manager.activate(tampered)).toThrow(LicenseError)
    expect(manager.check().status).toBe('unlicensed')
  })

  it('rejects a key signed with another client secret', () => {
    const otherClient = Buffer.alloc(32, 1)

    expect(() => manager.activate(makeKey({ validityDays: 365, issuedAt: NOW, secret: otherClient }))).toThrow(
      'Clave inválida'
    )
  })

  it('rejects a key whose activation window has closed', () => {
    const issued = new Date(NOW.getTime() - 25 * 3_600_000)

    expect(() => manager.activate(makeKey({ validityDays: 365, issuedAt: issued, windowHours: 24 }))).toThrow(
      'ya no puede activarse'
    )
  })

  it('supports permanent keys', () => {
    expect(manager.activate(makeKey({ validityDays: 0, issuedAt: NOW }))).toEqual({
      status: 'permanent',
      expires: null,
      days_left: null,
    })
  })

  it('warns when fewer than 30 days remain and expires afterwards', () => {
    manager.activate(makeKey({ validityDays: 40, issuedAt: NOW }))
    expect(manager.check().status).toBe('valid')

    vi.setSystemTime(new Date(NOW.getTime() + 20 * 86_400_000))
    expect(manager.check()).toMatchObject({ status: 'expiring_soon', days_left: 20 })

    vi.setSystemTime(new Date(NOW.getTime() + 41 * 86_400_000))
    expect(manager.check().status).toBe('expired')
  })

  it('adds the remaining days of the current key when a new key is activated', () => {
    manager.activate(makeKey({ validityDays: 30, issuedAt: NOW, nonce: 1 }))
    vi.setSystemTime(new Date(NOW.getTime() + 10 * 86_400_000))
    const later = new Date()

    const info = manager.activate(makeKey({ validityDays: 365, issuedAt: later, nonce: 2 }))

    // 365 days from the renewal + the 20 days left on the old key
    expect(info.expires).toBe('2027-11-06')
  })

  it('does not change anything when the same key is activated twice', () => {
    const key = makeKey({ validityDays: 30, issuedAt: NOW })
    const first = manager.activate(key)

    expect(manager.activate(key)).toEqual(first)
  })

  it('treats a hand-edited license file as unlicensed', () => {
    manager.activate(makeKey({ validityDays: 30, issuedAt: NOW }))
    const file = path.join(dir, 'license.json')
    const stored = JSON.parse(fs.readFileSync(file, 'utf-8'))

    fs.writeFileSync(file, JSON.stringify({ ...stored, raw_key: 'AAAAA-AAAAA-AAAAA-AAAAA' }))
    expect(manager.check().status).toBe('unlicensed')

    fs.writeFileSync(file, '{ not json')
    expect(manager.check().status).toBe('unlicensed')
  })

  it('revokes the license', () => {
    manager.activate(makeKey({ validityDays: 30, issuedAt: NOW }))

    manager.revoke()

    expect(manager.check().status).toBe('unlicensed')
    expect(() => manager.revoke()).not.toThrow()
  })
})

/**
 * Secrets for the public DEMO build (used by the Build Windows workflow).
 *
 * The HMAC secret is the development one ("dev0" x 8), already public in
 * scripts/gen-dev-key.mjs, so anyone can generate demo license keys. Client builds
 * use their own buildSecrets.ts, which is never committed.
 */
export const CLIENT_ID = 'demo'
export const CLIENT_NAME = 'Consultorio Demo'
export const HMAC_SECRET = Buffer.from('6465763064657630646576306465763064657630646576306465763064657630', 'hex')

/**
 * Build secrets template — copy to buildSecrets.ts and fill in real values.
 * buildSecrets.ts is intentionally excluded from git (.gitignore).
 *
 * Each client build must have a unique HMAC_SECRET so licenses are not
 * transferable between clients.
 */

export const CLIENT_ID = 'client-001'
export const CLIENT_NAME = 'Dr. Nombre Apellido'

// 32 random bytes, hex-encoded. Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
export const HMAC_SECRET = Buffer.from(
  'REPLACE_WITH_64_HEX_CHARS_OF_RANDOM_DATA',
  'hex'
)

#!/usr/bin/env node
/**
 * Generates the app icon from the logo: smaller (with padding) and rounded corners.
 * Output: src/renderer/public/CuroLogoIcon.png
 */
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const srcLogo = path.join(root, 'src/renderer/public/logo.png')
const outIcon = path.join(root, 'src/renderer/public/CuroLogoIcon.png')

const SIZE = 1024
// Logo casi a tamaño completo para que la máscara redonda recorte las esquinas del logo (no solo el margen)
const LOGO_SCALE = 0.80
const RADIUS = 480

async function main() {
  const logoSize = Math.round(SIZE * LOGO_SCALE)
  const logo = await sharp(srcLogo)
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .ensureAlpha()
    .toBuffer()

  const x = Math.round((SIZE - logoSize) / 2)
  const y = Math.round((SIZE - logoSize) / 2)

  const composed = await sharp({
    create: {
      width: SIZE,
      height: SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, top: y, left: x }])
    .raw()
    .toBuffer({ resolveWithObject: true })

  const roundedRectSvg = Buffer.from(
    `<svg width="${SIZE}" height="${SIZE}">
      <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="white"/>
    </svg>`
  )

  const mask = await sharp(roundedRectSvg)
    .resize(SIZE, SIZE)
    .raw()
    .toBuffer({ resolveWithObject: true })

  const maskCh = mask.info.channels || 4
  const outPixels = Buffer.allocUnsafe(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) {
    const a = mask.data[i * maskCh] / 255
    outPixels[i * 4] = composed.data[i * 4]
    outPixels[i * 4 + 1] = composed.data[i * 4 + 1]
    outPixels[i * 4 + 2] = composed.data[i * 4 + 2]
    outPixels[i * 4 + 3] = Math.round(composed.data[i * 4 + 3] * a)
  }

  await sharp(outPixels, {
    raw: { width: SIZE, height: SIZE, channels: 4 },
  })
    .png()
    .toFile(outIcon)

  console.log('App icon written to', outIcon)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

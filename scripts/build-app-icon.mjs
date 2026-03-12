#!/usr/bin/env node
/**
 * Generates app icons from the logo:
 *   - CuroLogoIcon.png (1024x1024, rounded, for macOS)
 *   - build/icon.ico  (multi-size ICO, for Windows)
 */
import sharp from 'sharp'
import path from 'path'
import fs from 'fs'
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

  // Generate ICO for Windows (multi-size: 16, 32, 48, 64, 128, 256)
  const icoSizes = [16, 32, 48, 64, 128, 256]
  const buildDir = path.join(root, 'build')
  if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir)
  const icoOut = path.join(buildDir, 'icon.ico')

  const pngBuffers = await Promise.all(
    icoSizes.map((s) =>
      sharp(outPixels, { raw: { width: SIZE, height: SIZE, channels: 4 } })
        .resize(s, s)
        .png()
        .toBuffer()
    )
  )

  // Build ICO file manually (ICO format: header + directory + image data)
  const count = pngBuffers.length
  const headerSize = 6
  const dirEntrySize = 16
  const dirOffset = headerSize + count * dirEntrySize

  // Calculate offsets for each image
  const offsets = []
  let currentOffset = dirOffset
  for (const buf of pngBuffers) {
    offsets.push(currentOffset)
    currentOffset += buf.length
  }

  const totalSize = currentOffset
  const icoBuffer = Buffer.alloc(totalSize)

  // ICO header
  icoBuffer.writeUInt16LE(0, 0)       // reserved
  icoBuffer.writeUInt16LE(1, 2)       // type: 1 = ICO
  icoBuffer.writeUInt16LE(count, 4)   // number of images

  // Directory entries
  for (let i = 0; i < count; i++) {
    const s = icoSizes[i]
    const base = headerSize + i * dirEntrySize
    icoBuffer.writeUInt8(s === 256 ? 0 : s, base)       // width (0 = 256)
    icoBuffer.writeUInt8(s === 256 ? 0 : s, base + 1)   // height
    icoBuffer.writeUInt8(0, base + 2)                    // color palette
    icoBuffer.writeUInt8(0, base + 3)                    // reserved
    icoBuffer.writeUInt16LE(1, base + 4)                 // color planes
    icoBuffer.writeUInt16LE(32, base + 6)                // bits per pixel
    icoBuffer.writeUInt32LE(pngBuffers[i].length, base + 8)  // image size
    icoBuffer.writeUInt32LE(offsets[i], base + 12)           // image offset
  }

  // Image data
  for (let i = 0; i < count; i++) {
    pngBuffers[i].copy(icoBuffer, offsets[i])
  }

  fs.writeFileSync(icoOut, icoBuffer)
  console.log('Windows ICO written to', icoOut)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

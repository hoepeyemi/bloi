import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

const iconSvg = readFileSync(join(root, 'src/app/icon.svg'))
const logoSvg = readFileSync(join(root, 'public/logo.svg'))

mkdirSync(join(root, 'public'), { recursive: true })

// favicon 32x32
await sharp(iconSvg).resize(32, 32).png().toFile(join(root, 'public/favicon.png'))
console.log('favicon.png done')

// logo 200x200
await sharp(logoSvg).resize(200, 200).png().toFile(join(root, 'public/logo.png'))
console.log('logo.png done')

// Twitter cover 1500x500 — logo centered on dark gradient background
const twitterW = 1500
const twitterH = 500
const logoSize = 160

const logoPng = await sharp(logoSvg).resize(logoSize, logoSize).png().toBuffer()

// Compose: dark background with centered logo + "bloi" wordmark
const background = {
  create: {
    width: twitterW,
    height: twitterH,
    channels: 4,
    background: { r: 10, g: 10, b: 18, alpha: 1 },
  },
}

// SVG overlay for the gradient bar and text
const overlaySvg = Buffer.from(`
<svg width="${twitterW}" height="${twitterH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8B5CF6" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#06B6D4" stop-opacity="0.15"/>
    </linearGradient>
  </defs>
  <rect width="${twitterW}" height="${twitterH}" fill="url(#g)"/>
  <text
    x="${twitterW / 2 + logoSize / 2 + 24}"
    y="${twitterH / 2 + 28}"
    font-family="system-ui, sans-serif"
    font-size="96"
    font-weight="700"
    fill="white"
    text-anchor="start"
    opacity="0.95"
  >bloi</text>
  <text
    x="${twitterW / 2 + logoSize / 2 + 28}"
    y="${twitterH / 2 + 60}"
    font-family="system-ui, sans-serif"
    font-size="22"
    font-weight="400"
    fill="#8B5CF6"
    text-anchor="start"
    letter-spacing="4"
  >INVOICE YIELD PROTOCOL</text>
</svg>
`)

await sharp(background)
  .composite([
    { input: overlaySvg, top: 0, left: 0 },
    {
      input: logoPng,
      top: Math.round((twitterH - logoSize) / 2),
      left: Math.round(twitterW / 2 - logoSize / 2 - 140),
    },
  ])
  .png()
  .toFile(join(root, 'public/twitter-cover.png'))

console.log('twitter-cover.png done')
console.log('\nAll assets generated in app/public/')

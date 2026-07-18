// سكربت لمرة واحدة: يولّد أيقونتي PWA (192×192 و512×512) من public/logo.jpg
// — يقصّ الشعار دائريًا (نفس منطق القص بـCSS بمكوّن Logo.tsx) ثم يضعه على
// خلفية مربعة بيضاء نظيفة، فتختفي زوايا الخلفية الرمادية الأصلية تمامًا.
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const SOURCE = 'public/logo.jpg'
const OUT_DIR = 'public/icons'

async function generateIcon(size) {
  const logoSize = Math.round(size * 0.92)
  const circleMask = Buffer.from(
    `<svg width="${logoSize}" height="${logoSize}"><circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" fill="#fff"/></svg>`,
  )

  const circularLogo = await sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: 'cover' })
    .composite([{ input: circleMask, blend: 'dest-in' }])
    .png()
    .toBuffer()

  const offset = Math.round((size - logoSize) / 2)

  await sharp({
    create: { width: size, height: size, channels: 4, background: '#ffffff' },
  })
    .composite([{ input: circularLogo, left: offset, top: offset }])
    .png()
    .toFile(`${OUT_DIR}/icon-${size}.png`)

  console.log(`تم إنشاء ${OUT_DIR}/icon-${size}.png`)
}

mkdirSync(OUT_DIR, { recursive: true })
await generateIcon(192)
await generateIcon(512)

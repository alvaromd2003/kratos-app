import 'server-only'
import path from 'path'
import QRCode from 'qrcode'
import sharp from 'sharp'

// 512px (not the old 200px) and 'H' error correction — a QR can absorb
// losing up to ~30% of its modules to damage/overlay at that level,
// which is what lets the logo badge sit in the middle without breaking
// the scan, and gives a print shop enough resolution for a physical
// table sign (a 200px source looks visibly pixelated once printed at a
// real card size).
const QR_SIZE = 512
const LOGO_SIZE = Math.round(QR_SIZE * 0.22)

let logoBufferPromise: Promise<Buffer> | null = null
function getLogoBuffer(): Promise<Buffer> {
  if (!logoBufferPromise) {
    logoBufferPromise = sharp(path.join(process.cwd(), 'src/app/icon.png'))
      .resize(LOGO_SIZE, LOGO_SIZE)
      .png()
      .toBuffer()
  }
  return logoBufferPromise
}

export async function generateTableQrDataUrl(url: string): Promise<string> {
  const qrBuffer = await QRCode.toBuffer(url, {
    errorCorrectionLevel: 'H',
    margin: 1,
    width: QR_SIZE,
  })
  const logo = await getLogoBuffer()

  const composited = await sharp(qrBuffer)
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer()

  return `data:image/png;base64,${composited.toString('base64')}`
}

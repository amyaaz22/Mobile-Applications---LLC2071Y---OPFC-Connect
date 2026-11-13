import QRCode from 'qrcode'

// Single source of truth for what a player card's QR encodes and how it is
// drawn. The card generators and the bulk QR checker all go through here, so
// "the code we verified" is byte-for-byte the code that gets printed.
export const PLAYER_QR_PREFIX = 'opfc://player/'
export const playerQrPayload = (playerId: string) => `${PLAYER_QR_PREFIX}${playerId}`

// Returns the player id if the scanned text is one of our player codes
// (also accepts a bare id, which is what older scanner code tolerated).
export function playerIdFromQr(text: string): string {
  return text.startsWith(PLAYER_QR_PREFIX) ? text.slice(PLAYER_QR_PREFIX.length) : text
}

// Dark modules on a light tile — the polarity every scanner reads. The previous
// teal-on-navy (light-on-dark) version only decoded in scanners that retry
// inverted, which is exactly the failure you cannot see until a card is
// scanned at the pitch. The payload is unchanged, so cards printed earlier
// keep working.
export function playerQrDataUrl(playerId: string, width = 240): Promise<string> {
  return QRCode.toDataURL(playerQrPayload(playerId), {
    color: { dark: '#0D1B2A', light: '#FFFFFF' },
    errorCorrectionLevel: 'M', width, margin: 2,
  })
}

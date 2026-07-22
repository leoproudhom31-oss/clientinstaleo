// Generateurs d'images 100% locales (data-URI SVG).
// Aucune requete reseau => aucun tracker, meme pour les images de demo.

function hashString(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i)
  }
  return h >>> 0
}

// Deux couleurs vives et harmonieuses derivees d'une graine.
function palette(seed: string): [string, string] {
  const h = hashString(seed)
  const hue1 = h % 360
  const hue2 = (hue1 + 40 + ((h >> 8) % 80)) % 360
  return [`hsl(${hue1} 65% 55%)`, `hsl(${hue2} 70% 45%)`]
}

function toDataUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function initials(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9\s]/g, ' ').trim()
  const parts = clean.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

// Avatar rond avec initiales sur degrade.
export function generateAvatar(seed: string, label?: string): string {
  const [c1, c2] = palette(seed)
  const text = initials(label ?? seed)
  const id = hashString(seed).toString(36)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
</linearGradient></defs>
<rect width="96" height="96" fill="url(#g${id})"/>
<text x="48" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="38" font-weight="600" fill="rgba(255,255,255,0.92)" text-anchor="middle" dominant-baseline="central">${text}</text>
</svg>`
  return toDataUri(svg)
}

// Image de post : degrade + formes abstraites, deterministe selon la graine.
export function generatePostImage(seed: string): string {
  const [c1, c2] = palette(seed)
  const h = hashString(seed)
  const id = h.toString(36)
  const cx = 40 + (h % 320)
  const cy = 60 + ((h >> 4) % 260)
  const r = 80 + ((h >> 8) % 160)
  const [c3] = palette(seed + 'x')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
<defs><linearGradient id="b${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
</linearGradient></defs>
<rect width="400" height="500" fill="url(#b${id})"/>
<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c3}" opacity="0.35"/>
<circle cx="${400 - cx}" cy="${500 - cy}" r="${r * 0.6}" fill="rgba(255,255,255,0.12)"/>
<rect x="${cx - 40}" y="${cy - 40}" width="120" height="120" rx="20" fill="rgba(0,0,0,0.10)" transform="rotate(${h % 45} ${cx} ${cy})"/>
</svg>`
  return toDataUri(svg)
}

// Icone de "serveur" (rail de gauche) — pastille arrondie avec un glyphe.
export function generateSpaceIcon(seed: string, letter: string): string {
  const [c1, c2] = palette(seed)
  const id = hashString(seed).toString(36)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
<defs><linearGradient id="s${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
</linearGradient></defs>
<rect width="96" height="96" fill="url(#s${id})"/>
<text x="48" y="50" font-family="Segoe UI, Arial, sans-serif" font-size="46" font-weight="700" fill="#fff" text-anchor="middle" dominant-baseline="central">${letter}</text>
</svg>`
  return toDataUri(svg)
}

// Renvoie une URL d'avatar utilisable : celle fournie, sinon un avatar genere.
export function avatarFor(seed: string, url?: string | null, label?: string): string {
  if (url && url.length > 0) return url
  return generateAvatar(seed, label)
}

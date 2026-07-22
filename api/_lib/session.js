// Chiffrement + stockage de la session Instagram dans des cookies httpOnly.
// La session serialisee peut depasser la taille d'un cookie : on la decoupe
// en plusieurs morceaux (igsess0, igsess1, ...).

const crypto = require('crypto')
const zlib = require('zlib')

const COOKIE_PREFIX = 'igsess'
const MAX_CHUNKS = 12
const CHUNK_SIZE = 3400
const MAX_AGE = 60 * 60 * 24 * 30 // 30 jours

function getKey() {
  const secret =
    process.env.SESSION_SECRET ||
    'instaleo-secret-par-defaut-a-changer-imperativement'
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(obj) {
  const gz = zlib.gzipSync(Buffer.from(JSON.stringify(obj), 'utf8'))
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
  const enc = Buffer.concat([cipher.update(gz), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc]).toString('base64url')
}

function decrypt(b64) {
  const buf = Buffer.from(b64, 'base64url')
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
  decipher.setAuthTag(tag)
  const gz = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(zlib.gunzipSync(gz).toString('utf8'))
}

function parseCookies(req) {
  const header = req.headers.cookie || ''
  const out = {}
  header.split(';').forEach((part) => {
    const i = part.indexOf('=')
    if (i > -1) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
    }
  })
  return out
}

function readSession(req) {
  const cookies = parseCookies(req)
  let combined = ''
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const c = cookies[`${COOKIE_PREFIX}${i}`]
    if (c === undefined || c === '') break
    combined += c
  }
  if (!combined) return null
  try {
    return decrypt(combined)
  } catch {
    return null
  }
}

function cookieAttrs(maxAge) {
  return [
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Secure',
    `Max-Age=${maxAge}`,
  ].join('; ')
}

function appendSetCookie(res, cookies) {
  const prev = res.getHeader('Set-Cookie')
  let all = []
  if (Array.isArray(prev)) all = prev.slice()
  else if (prev) all = [prev]
  res.setHeader('Set-Cookie', all.concat(cookies))
}

function writeSession(res, obj) {
  const data = encrypt(obj)
  const chunks = []
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE))
  }
  const cookies = []
  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (i < chunks.length) {
      cookies.push(`${COOKIE_PREFIX}${i}=${chunks[i]}; ${cookieAttrs(MAX_AGE)}`)
    } else {
      cookies.push(`${COOKIE_PREFIX}${i}=; ${cookieAttrs(0)}`)
    }
  }
  appendSetCookie(res, cookies)
}

function clearSession(res) {
  const cookies = []
  for (let i = 0; i < MAX_CHUNKS; i++) {
    cookies.push(`${COOKIE_PREFIX}${i}=; ${cookieAttrs(0)}`)
  }
  appendSetCookie(res, cookies)
}

module.exports = { readSession, writeSession, clearSession, parseCookies }

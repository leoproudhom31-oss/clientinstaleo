// Chiffrement + stockage d'objets dans des cookies httpOnly.
// Un objet peut depasser la taille d'un cookie : on le decoupe en morceaux
// (<prefix>0, <prefix>1, ...). Deux "blobs" sont utilises :
//   - igsess : la session Instagram (30 jours)
//   - igch   : l'etat temporaire d'un challenge de securite (15 min)

const crypto = require('crypto')
const zlib = require('zlib')

const MAX_CHUNKS = 12
const CHUNK_SIZE = 3400
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 jours
const CHALLENGE_MAX_AGE = 60 * 15 // 15 min

const SESSION_PREFIX = 'igsess'
const CHALLENGE_PREFIX = 'igch'

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

function readBlob(req, prefix) {
  const cookies = parseCookies(req)
  let combined = ''
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const c = cookies[`${prefix}${i}`]
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
  const attrs = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAge}`]
  // En local (http://localhost), l'attribut Secure empecherait le cookie.
  // Le serveur local definit COOKIE_INSECURE=1 ; sur Vercel (https) il reste absent.
  if (process.env.COOKIE_INSECURE !== '1') attrs.push('Secure')
  return attrs.join('; ')
}

function appendSetCookie(res, cookies) {
  const prev = res.getHeader('Set-Cookie')
  let all = []
  if (Array.isArray(prev)) all = prev.slice()
  else if (prev) all = [prev]
  res.setHeader('Set-Cookie', all.concat(cookies))
}

function writeBlob(res, prefix, obj, maxAge) {
  const data = encrypt(obj)
  const chunks = []
  for (let i = 0; i < data.length; i += CHUNK_SIZE) {
    chunks.push(data.slice(i, i + CHUNK_SIZE))
  }
  const cookies = []
  for (let i = 0; i < MAX_CHUNKS; i++) {
    if (i < chunks.length) {
      cookies.push(`${prefix}${i}=${chunks[i]}; ${cookieAttrs(maxAge)}`)
    } else {
      cookies.push(`${prefix}${i}=; ${cookieAttrs(0)}`)
    }
  }
  appendSetCookie(res, cookies)
}

function clearBlob(res, prefix) {
  const cookies = []
  for (let i = 0; i < MAX_CHUNKS; i++) {
    cookies.push(`${prefix}${i}=; ${cookieAttrs(0)}`)
  }
  appendSetCookie(res, cookies)
}

module.exports = {
  parseCookies,
  readSession: (req) => readBlob(req, SESSION_PREFIX),
  writeSession: (res, obj) => writeBlob(res, SESSION_PREFIX, obj, SESSION_MAX_AGE),
  clearSession: (res) => clearBlob(res, SESSION_PREFIX),
  readChallenge: (req) => readBlob(req, CHALLENGE_PREFIX),
  writeChallenge: (res, obj) =>
    writeBlob(res, CHALLENGE_PREFIX, obj, CHALLENGE_MAX_AGE),
  clearChallenge: (res) => clearBlob(res, CHALLENGE_PREFIX),
}

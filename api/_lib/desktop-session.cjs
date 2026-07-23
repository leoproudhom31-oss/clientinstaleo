// Stocke la session Instagram capturee via la fenetre de connexion Electron
// (sessionid + cookies). Vit en memoire (Electron et le serveur local sont
// dans le MEME process) et est persistee, chiffree, sur disque pour survivre
// aux redemarrages de l'app.

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

function dataDir() {
  return process.env.INSTALEO_DATA_DIR || path.join(__dirname, '..', '..')
}
function filePath() {
  return path.join(dataDir(), '.instaleo-session.enc')
}

function key() {
  const secret = process.env.SESSION_SECRET || 'instaleo-desktop-secret-par-defaut'
  return crypto.createHash('sha256').update(secret).digest()
}

function encrypt(obj) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv)
  const enc = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, enc])
}

function decrypt(buf) {
  const iv = buf.subarray(0, 12)
  const tag = buf.subarray(12, 28)
  const enc = buf.subarray(28)
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(enc), decipher.final()])
  return JSON.parse(dec.toString('utf8'))
}

let current = null

function get() {
  if (current) return current
  try {
    current = decrypt(fs.readFileSync(filePath()))
  } catch {
    current = null
  }
  return current
}

function set(session) {
  current = { ...session, savedAt: Date.now() }
  try {
    fs.writeFileSync(filePath(), encrypt(current), { mode: 0o600 })
  } catch {
    /* si l'ecriture echoue, on garde au moins la session en memoire */
  }
  return current
}

function clear() {
  current = null
  try {
    fs.unlinkSync(filePath())
  } catch {
    /* deja absent */
  }
}

module.exports = { get, set, clear }

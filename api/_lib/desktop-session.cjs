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
  if (!current) {
    try {
      current = decrypt(fs.readFileSync(filePath()))
    } catch {
      current = null
    }
  }
  // Une session capturee par une version anterieure a l'ajout du User-Agent
  // (voir web-ig.cjs) declenche systematiquement un blocage "useragent
  // mismatch" cote Instagram. Plutot que de rester coince en silence, on
  // l'invalide : l'app retombe en mode demo et propose une reconnexion
  // (qui recapturera une session complete).
  if (current && !current.userAgent) {
    clear()
    return null
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

// Fusionne des champs dans la session courante (ex : profil recupere apres
// coup) sans perdre les cookies/UA deja captures.
function update(patch) {
  if (!current) return null
  return set({ ...current, ...patch })
}

function clear() {
  current = null
  try {
    fs.unlinkSync(filePath())
  } catch {
    /* deja absent */
  }
}

module.exports = { get, set, update, clear }

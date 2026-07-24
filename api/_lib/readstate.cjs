// Etat de lecture LOCAL des conversations (client lourd uniquement).
//
// Objectif : marquer une conversation « lue » dans NOTRE app quand on l'ouvre,
// sans jamais le signaler a Instagram (pas d'accuse de lecture cote compte).
// On memorise, par conversation, l'horodatage du message le plus recent qu'on
// a affiche. Persiste sur disque pour survivre aux redemarrages de l'app.

const fs = require('fs')
const path = require('path')

function filePath() {
  const dir = process.env.INSTALEO_DATA_DIR || path.join(__dirname, '..', '..')
  return path.join(dir, '.instaleo-read.json')
}

let cache = null
function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(fs.readFileSync(filePath(), 'utf8')) || {}
  } catch {
    cache = {}
  }
  return cache
}

function save() {
  try {
    fs.writeFileSync(filePath(), JSON.stringify(cache), { mode: 0o600 })
  } catch (e) {
    console.warn('[readstate] echec ecriture disque :', e.message)
  }
}

function get() {
  return { ...load() }
}

// Marque une conversation vue jusqu'a l'horodatage `ts` (en secondes). On ne
// recule jamais : on garde le max.
function markSeen(threadId, ts) {
  const m = load()
  const t = Number(ts) || Math.floor(Date.now() / 1000)
  if (t > Number(m[threadId] || 0)) {
    m[threadId] = t
    save()
    console.log(`[readstate] conversation ${threadId} vue jusqu'a ${t}`)
  }
  return { ...m }
}

module.exports = { get, markSeen }

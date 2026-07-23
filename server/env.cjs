// Mini-chargeur de fichier .env (sans dependance externe).
// Charge les variables du .env racine dans process.env, sans ecraser
// celles deja definies par le systeme.

const fs = require('fs')
const path = require('path')

function loadEnv() {
  const file = path.join(__dirname, '..', '.env')
  let txt
  try {
    txt = fs.readFileSync(file, 'utf8')
  } catch {
    return // pas de .env : on ignore
  }
  for (const line of txt.split('\n')) {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const key = m[1]
    let val = m[2]
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (val !== '' && process.env[key] === undefined) {
      process.env[key] = val
    }
  }
}

module.exports = { loadEnv }

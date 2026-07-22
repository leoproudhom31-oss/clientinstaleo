// Adaptateur : fait tourner les handlers "/api/*.js" (ecrits pour Vercel) dans
// n'importe quel serveur Node local (serveur autonome, dev Vite, Electron).
// C'est ce qui permet aux requetes Instagram de partir de TON IP (client),
// et non plus de l'IP datacenter de Vercel.

const path = require('path')
const { parse } = require('url')

const API_DIR = path.join(__dirname, '..', 'api')

// Ajoute les proprietes que Vercel fournit et que le http natif de Node n'a pas.
function shim(req, res) {
  const parsed = parse(req.url, true)
  if (!req.query) req.query = parsed.query
  if (typeof res.status !== 'function') {
    res.status = (code) => {
      res.statusCode = code
      return res
    }
  }
  return parsed
}

// Route une requete /api/<nom> vers le handler correspondant.
// Renvoie true si la requete a ete prise en charge, false sinon.
async function handleApi(req, res) {
  const parsed = shim(req, res)
  const pathname = parsed.pathname || ''
  if (!pathname.startsWith('/api/')) return false

  const name = pathname.slice('/api/'.length).replace(/\/+$/, '')
  // Liste blanche stricte : uniquement des noms simples (pas de _lib, pas de "..").
  if (!/^[a-z]+$/.test(name)) {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Endpoint introuvable' }))
    return true
  }

  let handler
  try {
    handler = require(path.join(API_DIR, `${name}.js`))
  } catch {
    res.statusCode = 404
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ error: 'Endpoint introuvable' }))
    return true
  }

  try {
    await handler(req, res)
  } catch (e) {
    if (!res.headersSent) {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e?.message || 'Erreur serveur' }))
    }
  }
  return true
}

module.exports = { handleApi, shim }

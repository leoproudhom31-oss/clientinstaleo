// Petits utilitaires HTTP pour les fonctions serverless Vercel.

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return JSON.parse(req.body)
    } catch {
      return {}
    }
  }
  // Lecture manuelle du flux si le body n'a pas ete parse.
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  if (!chunks.length) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    return {}
  }
}

function json(res, status, payload) {
  res.status(status)
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(payload))
}

// Traduit une erreur { code } (voie session web) en reponse HTTP.
function apiError(res, e) {
  const code = e?.code
  const status = code === 'expired' || code === 'checkpoint' ? 401 : 502
  return json(res, status, {
    error: e?.message || 'Erreur cote Instagram.',
    code: code || 'error',
  })
}

module.exports = { readJson, json, apiError }

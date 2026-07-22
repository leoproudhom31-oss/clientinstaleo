// GET /api/img?u=<url encodee>
// Proxy d'images : le navigateur ne contacte jamais directement les serveurs
// de Meta. Seul TON serveur va chercher l'image, sans cookie ni referer.
// Liste blanche de domaines pour eviter tout proxy ouvert / SSRF.

const { json } = require('./_lib/http')

const ALLOWED = [
  /(^|\.)cdninstagram\.com$/i,
  /(^|\.)fbcdn\.net$/i,
  /(^|\.)instagram\.com$/i,
]

module.exports = async (req, res) => {
  const u = req.query?.u
  if (!u) return json(res, 400, { error: 'Parametre u manquant' })

  let url
  try {
    url = new URL(u)
  } catch {
    return json(res, 400, { error: 'URL invalide' })
  }

  if (url.protocol !== 'https:' || !ALLOWED.some((re) => re.test(url.hostname))) {
    return json(res, 403, { error: 'Domaine non autorise' })
  }

  try {
    const upstream = await fetch(url.toString(), {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'image/*' },
    })
    if (!upstream.ok) return json(res, 502, { error: 'Image indisponible' })

    const buf = Buffer.from(await upstream.arrayBuffer())
    res.status(200)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'image/jpeg',
    )
    res.setHeader('Cache-Control', 'public, max-age=86400, immutable')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.end(buf)
  } catch {
    return json(res, 502, { error: "Echec de recuperation de l'image" })
  }
}

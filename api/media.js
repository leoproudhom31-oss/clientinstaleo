// GET /api/media?u=<url encodee>
// Proxy de medias (images ET videos) : le navigateur ne contacte jamais
// directement les serveurs de Meta. Supporte le streaming par plages (Range),
// indispensable pour la lecture/le seek des videos de stories.
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
    console.warn(`[api:media] domaine refuse : ${url.hostname}`)
    return json(res, 403, { error: 'Domaine non autorise' })
  }

  try {
    const range = req.headers['range']
    const upstream = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: '*/*',
        ...(range ? { Range: range } : {}),
      },
    })
    if (!upstream.ok && upstream.status !== 206) {
      console.warn(`[api:media] ${upstream.status} pour ${url.hostname}${url.pathname}`)
      return json(res, 502, { error: 'Media indisponible' })
    }

    const buf = Buffer.from(await upstream.arrayBuffer())
    res.status(upstream.status === 206 ? 206 : 200)
    res.setHeader(
      'Content-Type',
      upstream.headers.get('content-type') || 'application/octet-stream',
    )
    // Rejoue les en-tetes de plage pour que <video> puisse chercher/streamer.
    const contentRange = upstream.headers.get('content-range')
    if (contentRange) res.setHeader('Content-Range', contentRange)
    res.setHeader('Accept-Ranges', upstream.headers.get('accept-ranges') || 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    return res.end(buf)
  } catch {
    return json(res, 502, { error: 'Echec de recuperation du media' })
  }
}

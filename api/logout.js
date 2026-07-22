// POST /api/logout — supprime la session cote client (efface les cookies).

const { json } = require('./_lib/http')
const { clearSession } = require('./_lib/session')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Methode non autorisee' })
  }
  clearSession(res)
  return json(res, 200, { ok: true })
}

// POST /api/logout — supprime la session (cookies + session web Electron).

const { json } = require('./_lib/http')
const { clearSession } = require('./_lib/session')
const desktop = require('./_lib/desktop-session.cjs')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Methode non autorisee' })
  }
  clearSession(res)
  desktop.clear()
  return json(res, 200, { ok: true })
}

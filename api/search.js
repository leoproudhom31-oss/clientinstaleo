// GET /api/search?q=<texte> — recherche de comptes Instagram.
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const q = (req.query?.q || '').trim()
  logRoute('search', Boolean(sess), `q=${q}`)
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  if (!q) return json(res, 200, { users: [] })

  try {
    return json(res, 200, { users: await web.searchUsers(sess, q) })
  } catch (e) {
    console.warn(`[api:search] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

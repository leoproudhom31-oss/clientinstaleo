// GET /api/saved[?maxId=<curseur>] — les publications enregistrees.
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const maxId = req.query?.maxId
  logRoute('saved', Boolean(sess), maxId ? `maxId=${maxId}` : 'premiere page')
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    return json(res, 200, await web.saved(sess, { maxId }))
  } catch (e) {
    console.warn(`[api:saved] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

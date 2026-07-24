// GET /api/highlights?userId=<pk> — les stories a la une (highlights) d'un compte.
// Les items d'un highlight se recuperent via /api/stories?reel=<highlight:id>.
//
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const userId = req.query?.userId
  logRoute('highlights', Boolean(sess), `userId=${userId || '?'}`)
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  if (!userId) return json(res, 400, { error: 'userId requis' })

  try {
    return json(res, 200, { highlights: await web.highlights(sess, String(userId)) })
  } catch (e) {
    console.warn(`[api:highlights] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

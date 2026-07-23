// GET /api/stories            -> le carrousel des stories (comptes suivis)
// GET /api/stories?reel=<pk>  -> les items (photos/videos) d'une story precise
//
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const reel = req.query?.reel
  logRoute('stories', Boolean(sess), reel ? `reel=${reel}` : 'carrousel')
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    if (reel) {
      return json(res, 200, { items: await web.storyReel(sess, String(reel)) })
    }
    return json(res, 200, { trays: await web.stories(sess) })
  } catch (e) {
    console.warn(`[api:stories] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

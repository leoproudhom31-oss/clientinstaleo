// GET /api/notifications — le fil d'activite (j'aime, commentaires, abonnements).
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  logRoute('notifications', Boolean(sess))
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    return json(res, 200, { notifications: await web.notifications(sess) })
  } catch (e) {
    console.warn(`[api:notifications] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

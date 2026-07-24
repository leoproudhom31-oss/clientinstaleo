// POST /api/startdm { usernames: [...] } — cree/ouvre une conversation.
// Ecriture : passe par la vraie page Instagram (app de bureau uniquement).

const { readJson, json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'Methode non autorisee' })
  const sess = desktop.get()
  const body = await readJson(req)
  const usernames = Array.isArray(body.usernames) ? body.usernames.filter(Boolean) : []
  logRoute('startdm', Boolean(sess), `avec ${usernames.join(',')}`)
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  if (!usernames.length) return json(res, 400, { error: 'usernames requis' })

  try {
    return json(res, 200, await web.startThread(sess, usernames))
  } catch (e) {
    console.warn(`[api:startdm] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

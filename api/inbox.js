// GET /api/inbox — la liste des conversations privees (Direct).

const { json, apiError, logRoute } = require('./_lib/http')
const {
  clientFromSession,
  persist,
  mapThreadPreview,
  handleError,
} = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  logRoute('inbox', Boolean(sess))
  if (sess) {
    try {
      return json(res, 200, { threads: await web.inbox(sess) })
    } catch (e) {
      console.warn(`[api:inbox] echec (${e?.code || e?.message})`)
      return apiError(res, e)
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  try {
    const selfPk = ig.state.cookieUserId
    const inbox = ig.feed.directInbox()
    const threads = await inbox.items()
    const mapped = threads
      .map((t) => mapThreadPreview(t, selfPk))
      .sort((a, b) => b.lastActivity - a.lastActivity)
    await persist(res, ig)
    return json(res, 200, { threads: mapped })
  } catch (e) {
    return handleError(res, e)
  }
}

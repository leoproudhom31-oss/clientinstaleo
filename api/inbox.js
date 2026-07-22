// GET /api/inbox — la liste des conversations privees (Direct).

const { json } = require('./_lib/http')
const {
  clientFromSession,
  persist,
  mapThreadPreview,
  handleError,
} = require('./_lib/ig')

module.exports = async (req, res) => {
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

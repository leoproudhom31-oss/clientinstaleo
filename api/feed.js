// GET /api/feed[?maxId=...] — le fil d'actualite (timeline), avec pagination
// (defilement infini) via maxId / nextMaxId.

const { json, apiError } = require('./_lib/http')
const {
  clientFromSession,
  persist,
  extractMedia,
  mapPost,
  handleError,
} = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const maxId = req.query?.maxId ? String(req.query.maxId) : undefined

  const sess = desktop.get()
  if (sess) {
    try {
      const { posts, hasMore, nextMaxId } = await web.feed(sess, { maxId })
      return json(res, 200, { posts, hasMore, nextMaxId })
    } catch (e) {
      return apiError(res, e)
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  try {
    const feed = ig.feed.timeline()
    const items = await feed.items()
    const posts = items.map(extractMedia).filter(Boolean).map(mapPost)
    await persist(res, ig)
    return json(res, 200, { posts, hasMore: false, nextMaxId: null })
  } catch (e) {
    return handleError(res, e)
  }
}

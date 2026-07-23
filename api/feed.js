// GET /api/feed — le fil d'actualite (timeline) mappe en "publications".

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
  const sess = desktop.get()
  if (sess) {
    try {
      return json(res, 200, { posts: await web.feed(sess) })
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
    return json(res, 200, { posts })
  } catch (e) {
    return handleError(res, e)
  }
}

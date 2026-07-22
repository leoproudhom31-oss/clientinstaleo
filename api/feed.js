// GET /api/feed — le fil d'actualite (timeline) mappe en "publications".

const { json } = require('./_lib/http')
const {
  clientFromSession,
  persist,
  extractMedia,
  mapPost,
  handleError,
} = require('./_lib/ig')

module.exports = async (req, res) => {
  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  try {
    const feed = ig.feed.timeline()
    const items = await feed.items()
    const posts = items
      .map(extractMedia)
      .filter(Boolean)
      .map(mapPost)
    await persist(res, ig)
    return json(res, 200, { posts })
  } catch (e) {
    return handleError(res, e)
  }
}

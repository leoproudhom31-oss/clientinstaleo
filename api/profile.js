// GET /api/profile — les publications du compte connecte (grille du profil).

const { json, apiError, logRoute } = require('./_lib/http')
const { clientFromSession, persist, mapPost, handleError } = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const maxId = req.query?.maxId
  logRoute('profile', Boolean(sess), maxId ? `maxId=${maxId}` : 'premiere page')
  if (sess) {
    try {
      return json(res, 200, await web.userFeed(sess, sess.dsUserId, { maxId }))
    } catch (e) {
      console.warn(`[api:profile] echec (${e?.code || e?.message})`)
      return apiError(res, e)
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  try {
    const userId = ig.state.cookieUserId
    const feed = ig.feed.user(userId)
    const items = await feed.items()
    await persist(res, ig)
    return json(res, 200, { posts: items.map(mapPost), hasMore: false, nextMaxId: null })
  } catch (e) {
    return handleError(res, e)
  }
}

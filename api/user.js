// GET /api/user?username=<pseudo>       -> profil complet + 1re page de posts
// GET /api/user?userId=<pk>&maxId=<cur>  -> page suivante des publications
//
// Permet d'ouvrir la fiche de N'IMPORTE quel compte Instagram (clic sur un
// pseudo/avatar dans l'app). Reserve au mode connecte (session web).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const username = req.query?.username
  const userId = req.query?.userId
  const maxId = req.query?.maxId
  logRoute('user', Boolean(sess), username ? `username=${username}` : `userId=${userId || '?'}`)
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    // Pagination des publications d'un profil deja ouvert.
    if (userId) {
      return json(res, 200, await web.userFeed(sess, String(userId), { maxId }))
    }

    if (!username) return json(res, 400, { error: 'username requis' })
    const user = await web.userInfo(sess, String(username))

    // Les publications peuvent etre inaccessibles (compte prive non suivi) :
    // on renvoie quand meme l'entete du profil.
    let posts = []
    let hasMore = false
    let nextMaxId = null
    try {
      const r = await web.userFeed(sess, user.pk, {})
      posts = r.posts
      hasMore = r.hasMore
      nextMaxId = r.nextMaxId
    } catch (e) {
      console.warn(`[api:user] publications indisponibles pour ${username} (${e?.code || e?.message})`)
    }

    return json(res, 200, { user, posts, hasMore, nextMaxId })
  } catch (e) {
    console.warn(`[api:user] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

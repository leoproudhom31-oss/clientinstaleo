// GET /api/post?id=<mediaId>            -> detail + likers + commentaires
// GET /api/post?id=<mediaId>&what=comments&minId=<>  -> commentaires suivants
//
// Reserve au mode connecte (session web capturee via Electron).

const { json, apiError, logRoute } = require('./_lib/http')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  const id = req.query?.id
  const what = req.query?.what
  logRoute('post', Boolean(sess), `id=${id || '?'}${what ? ' what=' + what : ''}`)
  if (!sess) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  if (!id) return json(res, 400, { error: 'id requis' })

  try {
    // Pagination des commentaires.
    if (what === 'comments') {
      return json(res, 200, await web.comments(sess, String(id), { minId: req.query?.minId }))
    }

    // Detail complet : on charge en parallele et on tolere l'echec des parties
    // secondaires (likers/comments peuvent etre restreints).
    const [post, likersRes, commentsRes] = await Promise.all([
      web.postInfo(sess, String(id)),
      web.likers(sess, String(id)).catch(() => []),
      web.comments(sess, String(id)).catch(() => ({ comments: [], hasMore: false, nextMinId: null })),
    ])
    return json(res, 200, {
      post,
      likers: likersRes,
      comments: commentsRes.comments,
      commentsHasMore: commentsRes.hasMore,
      commentsNextMinId: commentsRes.nextMinId,
    })
  } catch (e) {
    console.warn(`[api:post] echec (${e?.code || e?.message})`)
    return apiError(res, e)
  }
}

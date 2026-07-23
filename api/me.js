// GET /api/me — renvoie l'utilisateur connecte (session web Electron ou private-api).

const { json, apiError } = require('./_lib/http')
const { clientFromSession, persist, mapUser, handleError } = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const sess = desktop.get()
  if (sess) {
    try {
      return json(res, 200, { user: await web.me(sess) })
    } catch (e) {
      // Session valide (capturee) mais le profil n'a pas charge : on ne bloque
      // PAS la connexion. On renvoie un profil minimal derive de la session.
      if (e?.code === 'expired') return apiError(res, e)
      return json(res, 200, {
        user: {
          pk: String(sess.dsUserId || ''),
          username: sess.username || 'mon compte',
          fullName: '',
          avatarUrl: null,
        },
      })
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })
  try {
    const user = await ig.account.currentUser()
    await persist(res, ig)
    return json(res, 200, { user: mapUser(user) })
  } catch (e) {
    return handleError(res, e)
  }
}

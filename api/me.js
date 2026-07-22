// GET /api/me — renvoie l'utilisateur connecte si une session valide existe.

const { json } = require('./_lib/http')
const { clientFromSession, persist, mapUser, handleError } = require('./_lib/ig')

module.exports = async (req, res) => {
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

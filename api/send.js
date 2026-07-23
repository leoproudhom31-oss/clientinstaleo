// POST /api/send — envoie un message texte dans une conversation.
// Corps : { threadId, text }

const { readJson, json, apiError, logRoute } = require('./_lib/http')
const { clientFromSession, persist, handleError } = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Methode non autorisee' })
  }
  const body = await readJson(req)
  const threadId = body.threadId
  const text = (body.text || '').trim()
  if (!threadId || !text) {
    return json(res, 400, { error: 'threadId et text sont requis' })
  }

  const sess = desktop.get()
  logRoute('send', Boolean(sess), `threadId=${threadId} longueur=${text.length}`)
  if (sess) {
    try {
      return json(res, 200, { message: await web.send(sess, String(threadId), text) })
    } catch (e) {
      console.warn(`[api:send] echec (${e?.code || e?.message})`)
      return apiError(res, e)
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    const thread = ig.entity.directThread(String(threadId))
    const result = await thread.broadcastText(text)
    await persist(res, ig)
    return json(res, 200, {
      message: {
        id: String(result?.item_id ?? Date.now()),
        senderId: String(ig.state.cookieUserId),
        text,
        timestamp: Math.floor(Date.now() / 1000),
        itemType: 'text',
      },
    })
  } catch (e) {
    return handleError(res, e)
  }
}

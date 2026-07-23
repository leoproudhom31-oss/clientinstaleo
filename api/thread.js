// GET /api/thread?id=<thread_id> — les messages d'une conversation.

const { json, apiError } = require('./_lib/http')
const {
  clientFromSession,
  persist,
  mapUser,
  mapMessage,
  previewText,
  handleError,
} = require('./_lib/ig')
const desktop = require('./_lib/desktop-session.cjs')
const web = require('./_lib/web-ig.cjs')

module.exports = async (req, res) => {
  const id = req.query?.id
  if (!id) return json(res, 400, { error: 'Parametre id manquant' })

  const sess = desktop.get()
  if (sess) {
    try {
      return json(res, 200, { thread: await web.thread(sess, String(id)) })
    } catch (e) {
      return apiError(res, e)
    }
  }

  const ig = await clientFromSession(req)
  if (!ig) return json(res, 401, { error: 'Non connecte', code: 'no_session' })

  try {
    const selfPk = ig.state.cookieUserId
    const feed = ig.feed.directThread({ thread_id: String(id) })
    const body = await feed.request()
    const t = body.thread || {}
    const others = (t.users || []).filter((u) => String(u.pk) !== String(selfPk))
    const users = others.map(mapUser)
    const rawItems = t.items || []
    const messages = rawItems.map(mapMessage).reverse()
    const last = rawItems[0]

    const thread = {
      id: String(id),
      title:
        t.thread_title || users.map((u) => u.username).join(', ') || 'Conversation',
      users,
      isGroup: Boolean(t.is_group) || users.length > 1,
      unread: false,
      lastActivity: messages.length
        ? messages[messages.length - 1].timestamp
        : Math.floor(Date.now() / 1000),
      lastMessage: previewText(last),
      messages,
    }

    await persist(res, ig)
    return json(res, 200, { thread })
  } catch (e) {
    return handleError(res, e)
  }
}

// GET  /api/readstate            -> { seen: { threadId: ts } }
// POST /api/readstate { threadId, ts } -> marque la conversation lue localement
//
// Etat de lecture LOCAL (jamais transmis a Instagram). Voir readstate.cjs.

const { readJson, json, logRoute } = require('./_lib/http')
const readstate = require('./_lib/readstate.cjs')

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const body = await readJson(req)
    if (!body.threadId) return json(res, 400, { error: 'threadId requis' })
    logRoute('readstate', true, `seen ${body.threadId}`)
    return json(res, 200, { seen: readstate.markSeen(String(body.threadId), body.ts) })
  }
  logRoute('readstate', true, 'lecture')
  return json(res, 200, { seen: readstate.get() })
}

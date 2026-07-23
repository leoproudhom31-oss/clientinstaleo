// Client de l'API WEB d'Instagram (celle qu'utilise instagram.com), a partir
// d'une session capturee dans la fenetre de connexion Electron.
//
// Pourquoi cette voie ? La connexion par mot de passe (instagram-private-api)
// est souvent bloquee par l'anti-bot. Ici, la connexion a eu lieu dans une
// VRAIE page Instagram : aucun robot detecte. On reutilise juste la session.
//
// IMPORTANT : Instagram lie la session au User-Agent utilise a la connexion et
// renvoie 400 "useragent mismatch" si un autre UA est utilise ensuite. On
// reutilise donc TOUJOURS le UA capture (session.userAgent) plutot qu'un UA
// invente.

const map = require('./map.cjs')

const APP_ID = '936619743392459'
// Repli seulement pour d'anciennes sessions capturees avant l'ajout de cette
// capture d'UA (elles echoueront probablement quand meme : reconnecte-toi).
const FALLBACK_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
const BASE = 'https://www.instagram.com'

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

// "fetch failed" (TypeError de Node/undici) signifie que la requete n'a MEME
// PAS atteint Instagram : DNS, coupure reseau, blip momentane... Ce n'est pas
// un rejet d'Instagram, donc pas la peine de demander une reconnexion — on
// retente automatiquement quelques fois avant d'abandonner, et on journalise
// la cause precise (ENOTFOUND, ECONNRESET, ETIMEDOUT...) pour diagnostic.
async function fetchResilient(url, opts, attempts = 3, delayMs = 900) {
  let lastErr
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, opts)
    } catch (e) {
      lastErr = e
      const cause = e?.cause?.code || e?.cause?.message || e?.message || 'inconnue'
      console.warn(
        `[web-ig] echec reseau (essai ${i + 1}/${attempts}) vers ${url} : ${cause}`,
      )
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  const cause = lastErr?.cause?.code || lastErr?.cause?.message || lastErr?.message || 'inconnue'
  const e = new Error(
    `Connexion a Instagram impossible (${cause}). Verifie ta connexion internet, puis reessaie.`,
  )
  e.code = 'network'
  throw e
}

async function webRequest(session, pathOrUrl, { method = 'GET', form } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`
  const headers = {
    'User-Agent': session.userAgent || FALLBACK_UA,
    'X-IG-App-ID': APP_ID,
    'X-CSRFToken': session.csrftoken || '',
    'X-Requested-With': 'XMLHttpRequest',
    // Instagram emet ce "claim" apres chaque requete et attend qu'on le
    // renvoie tel quel ensuite ; c'est requis par les endpoints qui MODIFIENT
    // quelque chose (envoi de message, etc.) — sans lui, ils peuvent echouer
    // silencieusement (reponse 200 avec status "fail").
    'X-IG-WWW-Claim': session.wwwClaim || '0',
    Referer: `${BASE}/`,
    Origin: BASE,
    Cookie: session.cookieHeader,
    Accept: '*/*',
  }
  let body
  if (form) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams(form).toString()
  }

  const res = await fetchResilient(url, { method, headers, body })

  // Instagram renvoie un nouveau claim a chaque reponse : on le memorise pour
  // les appels suivants (mutation directe de l'objet session, qui est la meme
  // reference que celle conservee par desktop-session tant que le process vit).
  const claim = res.headers.get('x-ig-set-www-claim')
  if (claim && claim !== '0') session.wwwClaim = claim

  const text = await res.text()
  let data = null
  try {
    data = JSON.parse(text)
  } catch {
    /* reponse non-JSON (page de login, etc.) */
  }

  // "fail" peut arriver avec un statut HTTP 200 : Instagram signale l'echec
  // dans le corps de la reponse, pas via le code HTTP. Sans cette detection,
  // un envoi refuse par Instagram serait pris pour une reussite.
  const appFailed = data?.status === 'fail'

  // Journalise les echecs dans le terminal (npm start) pour diagnostic.
  if (!res.ok || !data || appFailed) {
    console.warn(
      `[web-ig] ${method} ${url} -> ${res.status} ${res.statusText}${appFailed ? ' (status=fail)' : ''} | ${text.slice(0, 220)}`,
    )
  }

  if (res.status === 401 || res.status === 403 || data?.message === 'login_required') {
    const e = new Error('Session Instagram expiree. Reconnecte-toi.')
    e.code = 'expired'
    throw e
  }
  if (data?.message === 'checkpoint_required' || data?.checkpoint_url) {
    const e = new Error('Instagram demande une verification (checkpoint).')
    e.code = 'checkpoint'
    throw e
  }
  if (data?.message === 'useragent mismatch') {
    const e = new Error(
      'Instagram a refuse la requete (useragent mismatch). Deconnecte-toi puis reconnecte-toi pour recapturer une session a jour.',
    )
    e.code = 'ua_mismatch'
    throw e
  }
  if (!res.ok || !data || appFailed) {
    const e = new Error(data?.message || `Erreur Instagram (${res.status})`)
    e.code = 'ig_error'
    throw e
  }
  return data
}

// Renvoie le profil BRUT (forme attendue par map.mapUser), pas encore mappe :
// permet a l'appelant de le mettre en cache dans la session sans double mapping.
async function meRaw(session) {
  // Profil deja capture dans la page Instagram (le plus fiable : pas d'appel
  // reseau supplementaire, donc aucun risque de mismatch).
  if (session.user && session.user.username) return session.user

  // Repli reseau (session sans profil capture au login).
  const data = await webRequest(session, '/api/v1/accounts/current_user/?edit=false')
  if (data?.user) return data.user
  throw new Error('Profil indisponible')
}

async function me(session) {
  return map.mapUser(await meRaw(session))
}

// Publications d'un utilisateur (par defaut, le compte connecte).
async function userFeed(session, userId, count = 12) {
  const id = userId || session.dsUserId
  const data = await webRequest(session, `/api/v1/feed/user/${id}/?count=${count}`)
  const items = data.items || []
  return items.map(map.mapPost)
}

async function feed(session) {
  const data = await webRequest(session, '/api/v1/feed/timeline/', {
    method: 'POST',
    form: { reason: 'cold_start_fetch', is_pull_to_refresh: '0' },
  })
  const items = data.feed_items || data.items || []
  return items.map(map.extractMedia).filter(Boolean).map(map.mapPost)
}

async function inbox(session) {
  const data = await webRequest(
    session,
    '/api/v1/direct_v2/inbox/?visual_message_return_type=unseen&thread_message_limit=1&persistentBadging=true&limit=20',
  )
  const threads = data.inbox?.threads || []
  const selfPk = session.dsUserId
  return threads
    .map((t) => map.mapThreadPreview(t, selfPk))
    .sort((a, b) => b.lastActivity - a.lastActivity)
}

// direction=older + cursor permet de remonter dans l'historique. Sans cursor,
// Instagram renvoie la page la plus recente (~20 messages).
async function thread(session, id, { cursor } = {}) {
  let url =
    `/api/v1/direct_v2/threads/${encodeURIComponent(id)}/` +
    `?visual_message_return_type=unseen&direction=older&media_count=0&limit=25`
  if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`

  const data = await webRequest(session, url)
  const t = data.thread || {}
  const selfPk = session.dsUserId
  const others = (t.users || []).filter((u) => String(u.pk) !== String(selfPk))
  const users = others.map(map.mapUser)
  const rawItems = t.items || []
  const messages = rawItems.map(map.mapMessage).reverse()
  return {
    id: String(id),
    title:
      t.thread_title || users.map((u) => u.username).join(', ') || 'Conversation',
    users,
    isGroup: Boolean(t.is_group) || users.length > 1,
    unread: false,
    lastActivity: messages.length
      ? messages[messages.length - 1].timestamp
      : Math.floor(Date.now() / 1000),
    lastMessage: map.previewText(rawItems[0]),
    messages,
    hasOlder: Boolean(t.has_older),
    oldestCursor: t.oldest_cursor || null,
  }
}

async function send(session, threadId, text) {
  const ctx = uuid()
  const data = await webRequest(session, '/api/v1/direct_v2/threads/broadcast/text/', {
    method: 'POST',
    form: {
      action: 'send_item',
      thread_ids: `[${threadId}]`,
      text,
      client_context: ctx,
      offline_threading_id: ctx,
    },
  })
  // webRequest a deja leve une erreur si data.status === 'fail' : arriver ici
  // signifie qu'Instagram a accepte et diffuse le message.
  const item = data?.payload || data?.payload?.[0]
  return {
    id: String(item?.item_id || ctx),
    senderId: String(session.dsUserId || ''),
    text,
    timestamp: Math.floor(Date.now() / 1000),
    itemType: 'text',
  }
}

module.exports = { me, meRaw, feed, inbox, thread, send, userFeed }

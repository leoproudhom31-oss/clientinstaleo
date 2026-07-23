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
const pageBridge = require('./page-bridge.cjs')

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

// Utilitaires de journalisation : donnent assez de detail pour diagnostiquer
// sans jamais afficher une valeur secrete en entier (le terminal peut etre
// copie-colle dans une conversation).
function mask(v) {
  if (!v) return '(absent)'
  const s = String(v)
  return s.length <= 10 ? `${s.slice(0, 2)}…` : `${s.slice(0, 4)}…${s.slice(-4)}`
}
function cookieNames(cookieHeader) {
  return (cookieHeader || '')
    .split(/;\s*/)
    .map((p) => p.split('=')[0])
    .filter(Boolean)
}
let reqSeq = 0

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

// Instagram pose des cookies de routage regional (rur, ig-u-rur...) via des
// redirections. fetch() de Node ne conserve PAS les Set-Cookie a travers une
// redirection : sans intervention, la meme redirection se repete a l'infini
// ("redirect count exceeded"). On fusionne donc nous-memes chaque Set-Cookie
// dans la session, comme le ferait un navigateur.
function mergeSetCookie(session, res) {
  let list = []
  if (typeof res.headers.getSetCookie === 'function') list = res.headers.getSetCookie()
  else {
    const sc = res.headers.get('set-cookie')
    if (sc) list = [sc]
  }
  if (!list.length) return

  const jar = new Map()
  for (const part of (session.cookieHeader || '').split(/;\s*/)) {
    const i = part.indexOf('=')
    if (i > 0) jar.set(part.slice(0, i).trim(), part.slice(i + 1))
  }
  for (const sc of list) {
    const first = sc.split(';')[0]
    const i = first.indexOf('=')
    if (i > 0) {
      const k = first.slice(0, i).trim()
      const v = first.slice(i + 1).trim()
      // Une valeur vide ("deleted"/'""') signifie suppression du cookie.
      if (v && v !== '""') jar.set(k, v)
      else jar.delete(k)
    }
  }
  session.cookieHeader = [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
  if (jar.has('csrftoken')) session.csrftoken = jar.get('csrftoken')
}

const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308])
const MAX_REDIRECTS = 6

async function webRequest(session, pathOrUrl, { method = 'GET', form, referer } = {}) {
  const url = pathOrUrl.startsWith('http') ? pathOrUrl : `${BASE}${pathOrUrl}`
  let body
  const buildHeaders = () => {
    const h = {
      'User-Agent': session.userAgent || FALLBACK_UA,
      'X-IG-App-ID': APP_ID,
      // ID anti-scraping qu'Instagram exige sur ses requetes. Valeur par defaut
      // au cas ou la capture (voir plus bas) n'aurait rien recupere ; elle sera
      // ecrasee par la vraie valeur de la page si on l'a interceptee.
      'X-ASBD-ID': '129477',
      'X-CSRFToken': session.csrftoken || '',
      'X-Requested-With': 'XMLHttpRequest',
      // Instagram emet ce "claim" apres chaque requete et attend qu'on le
      // renvoie tel quel ensuite ; requis par les endpoints qui MODIFIENT
      // quelque chose (envoi de message...) — sans lui, ils peuvent echouer
      // silencieusement (reponse 200 avec status "fail").
      'X-IG-WWW-Claim': session.wwwClaim || '0',
      // Pour une action precise (ex : envoyer un message dans une
      // conversation), pointer le Referer sur la vraie page concernee plutot
      // que sur l'accueil colle davantage au comportement d'un navigateur, ce
      // qu'Instagram verifie parfois pour les requetes qui modifient quelque chose.
      Referer: referer || `${BASE}/`,
      Origin: BASE,
      Cookie: session.cookieHeader,
      Accept: '*/*',
    }
    // Rejoue les en-tetes de securite interceptes sur la VRAIE page Instagram
    // (X-ASBD-ID, X-Instagram-AJAX, X-Web-Session-ID, X-Bloks-Version-Id...).
    // Les LECTURES passent sans eux, mais les ECRITURES (envoi de message) sont
    // renvoyees vers /accounts/login sans ce jeu d'en-tetes complet. On saute
    // csrftoken et www-claim : ils sont geres dynamiquement ci-dessus (leur
    // valeur evolue au fil des requetes et des redirections).
    const managed = new Set(['x-csrftoken', 'x-ig-www-claim'])
    const canonical = { 'x-ig-app-id': 'X-IG-App-ID', 'x-asbd-id': 'X-ASBD-ID' }
    for (const [k, v] of Object.entries(session.igHeaders || {})) {
      if (!v || managed.has(k)) continue
      h[canonical[k] || k] = v
    }
    if (form) h['Content-Type'] = 'application/x-www-form-urlencoded'
    return h
  }
  if (form) body = new URLSearchParams(form).toString()

  const seq = ++reqSeq
  const t0 = Date.now()
  console.log(
    `[web-ig #${seq}] -> ${method} ${url}` +
      `${form ? ` | form=${Object.keys(form).join(',')}` : ''}` +
      ` | cookies=[${cookieNames(session.cookieHeader).join(',')}]` +
      ` | csrftoken=${mask(session.csrftoken)} claim=${mask(session.wwwClaim)}`,
  )

  // Boucle de redirection geree a la main : sur un 3xx, on absorbe les cookies
  // de routage puis on rejoue la MEME requete (methode + corps preserves) avec
  // les cookies a jour, jusqu'a obtenir une vraie reponse.
  let res
  for (let redirects = 0; ; redirects++) {
    res = await fetchResilient(url, {
      method,
      headers: buildHeaders(),
      body,
      redirect: 'manual',
    })

    const claim = res.headers.get('x-ig-set-www-claim')
    if (claim && claim !== '0') session.wwwClaim = claim
    mergeSetCookie(session, res)

    if (!REDIRECT_STATUS.has(res.status)) break

    const location = res.headers.get('location') || ''
    console.log(
      `[web-ig #${seq}]    redirection ${res.status} -> ${location.slice(0, 140)} (essai ${redirects + 1}/${MAX_REDIRECTS})`,
    )

    if (/\/challenge/i.test(location)) {
      console.warn(
        `[web-ig #${seq}] <- CHECKPOINT apres ${Date.now() - t0}ms : ${method} ${url} redirige vers un challenge (${location.slice(0, 100)})`,
      )
      const e = new Error(
        'Instagram demande une verification pour cette action (checkpoint). Ouvre l’app officielle, confirme, puis reessaie.',
      )
      e.code = 'checkpoint'
      throw e
    }
    if (/\/accounts\/login/i.test(location)) {
      console.warn(
        `[web-ig #${seq}] <- SESSION EXPIREE apres ${Date.now() - t0}ms : ${method} ${url} redirige vers la connexion (${location.slice(0, 100)}) ` +
          `| cookies=[${cookieNames(session.cookieHeader).join(',')}] csrftoken=${mask(session.csrftoken)} claim=${mask(session.wwwClaim)}`,
      )
      const e = new Error('Session Instagram expiree. Deconnecte-toi puis reconnecte-toi.')
      e.code = 'expired'
      throw e
    }
    if (redirects >= MAX_REDIRECTS) {
      console.warn(`[web-ig #${seq}] <- BOUCLE DE REDIRECTION apres ${Date.now() - t0}ms : ${method} ${url}`)
      const e = new Error(
        'Instagram redirige la requete en boucle (routage de session). Deconnecte-toi puis reconnecte-toi.',
      )
      e.code = 'redirect_loop'
      throw e
    }
    // On consomme le corps de la redirection pour liberer la connexion.
    await res.arrayBuffer().catch(() => {})
  }

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
  const ms = Date.now() - t0

  // Journalise TOUTES les reponses (pas seulement les echecs) : c'est ce qui
  // permet de voir immediatement ce qu'Instagram a vraiment renvoye.
  console.log(
    `[web-ig #${seq}] <- ${res.status} ${res.statusText} en ${ms}ms${appFailed ? ' (status=fail)' : ''} | ${text.slice(0, 400)}`,
  )

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
  if (session.user && session.user.username) {
    console.log(`[web-ig] me() : profil deja en cache (${session.user.username}), pas d'appel reseau`)
    return session.user
  }

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

// maxId (renvoye par Instagram sous next_max_id) permet de demander la suite
// du fil : sans lui, on obtient toujours la meme premiere page.
async function feed(session, { maxId } = {}) {
  const form = maxId
    ? { reason: 'pagination', max_id: maxId, is_pull_to_refresh: '0' }
    : { reason: 'cold_start_fetch', is_pull_to_refresh: '0' }
  const data = await webRequest(session, '/api/v1/feed/timeline/', {
    method: 'POST',
    form,
  })
  const items = data.feed_items || data.items || []
  const posts = items.map(map.extractMedia).filter(Boolean).map(map.mapPost)
  console.log(
    `[web-ig] feed() : ${items.length} elements bruts -> ${posts.length} publications retenues ` +
      `(${items.length - posts.length} filtrees : pub/suggestion/format non gere) | hasMore=${Boolean(data.more_available)}`,
  )
  return {
    posts,
    hasMore: Boolean(data.more_available),
    nextMaxId: data.next_max_id || null,
  }
}

async function inbox(session) {
  const data = await webRequest(
    session,
    '/api/v1/direct_v2/inbox/?visual_message_return_type=unseen&thread_message_limit=1&persistentBadging=true&limit=20',
  )
  const threads = data.inbox?.threads || []
  const selfPk = session.dsUserId
  console.log(`[web-ig] inbox() : ${threads.length} conversations recues`)
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

  const data = await webRequest(session, url, {
    referer: `${BASE}/direct/t/${encodeURIComponent(id)}/`,
  })
  const t = data.thread || {}
  const selfPk = session.dsUserId
  const others = (t.users || []).filter((u) => String(u.pk) !== String(selfPk))
  const users = others.map(map.mapUser)
  const rawItems = t.items || []
  const messages = rawItems.map(map.mapMessage).reverse()
  console.log(
    `[web-ig] thread(${id}) : ${rawItems.length} elements -> ${messages.length} messages | ` +
      `hasOlder=${Boolean(t.has_older)} oldestCursor=${t.oldest_cursor ? mask(t.oldest_cursor) : '(aucun)'}`,
  )
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

// Envoi en pilotant le VRAI composeur d'Instagram dans la fenetre cachee.
// C'est la seule voie fiable : le POST /broadcast/text/ est refuse (redirige
// vers login) pour une session WEB, meme execute depuis la page — c'est un
// endpoint mobile. En laissant le JS d'Instagram envoyer, on utilise l'endpoint
// reel qu'il emploie. Renvoie le message mappe, ou lance une erreur codee.
async function sendViaPage(session, threadId, text) {
  console.log(`[web-ig] send() : via le composeur de la page Instagram thread=${threadId}`)
  const res = await pageBridge.send(String(threadId), text)
  console.log(`[web-ig] send() : reponse UI -> ${JSON.stringify(res).slice(0, 260)}`)

  if (res?.ok) {
    console.log(`[web-ig] send() : accepte par Instagram (composeur, ${res.method || '?'})`)
    return {
      // L'UI ne renvoie pas l'item_id ; on genere un identifiant local. La liste
      // se resynchronisera au prochain rafraichissement du fil de la conversation.
      id: `page_${Date.now()}`,
      senderId: String(session.dsUserId || ''),
      text,
      timestamp: Math.floor(Date.now() / 1000),
      itemType: 'text',
    }
  }
  // Composeur introuvable + URL de login = la page n'est plus authentifiee.
  if (/accounts\/login/i.test(res?.url || '')) {
    const e = new Error('Session Instagram expiree. Deconnecte-toi puis reconnecte-toi.')
    e.code = 'expired'
    throw e
  }
  const e = new Error(res?.error || 'Envoi non confirme par Instagram.')
  e.code = 'ig_error'
  throw e
}

async function send(session, threadId, text) {
  // Dans Electron, la seule voie fiable est le composeur de la page reelle.
  if (pageBridge.hasSender()) {
    return await sendViaPage(session, threadId, text)
  }

  // Hors Electron (serveur local/Vercel sans fenetre) : repli requete serveur.
  const ctx = uuid()
  console.log(`[web-ig] send() : repli serveur vers le thread ${threadId} (client_context=${ctx})`)
  const data = await webRequest(session, '/api/v1/direct_v2/threads/broadcast/text/', {
    method: 'POST',
    form: {
      action: 'send_item',
      thread_ids: `[${threadId}]`,
      text,
      client_context: ctx,
      offline_threading_id: ctx,
    },
    referer: `${BASE}/direct/t/${encodeURIComponent(threadId)}/`,
  })
  // webRequest a deja leve une erreur si data.status === 'fail' : arriver ici
  // signifie qu'Instagram a accepte et diffuse le message.
  const item = data?.payload || data?.payload?.[0]
  console.log(`[web-ig] send() : accepte par Instagram, item_id=${item?.item_id || '(absent, repli sur ' + ctx + ')'}`)
  return {
    id: String(item?.item_id || ctx),
    senderId: String(session.dsUserId || ''),
    text,
    timestamp: Math.floor(Date.now() / 1000),
    itemType: 'text',
  }
}

module.exports = { me, meRaw, feed, inbox, thread, send, userFeed }

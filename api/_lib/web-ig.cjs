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

async function webRequest(session, pathOrUrl, { method = 'GET', form, referer, accept } = {}) {
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
      Accept: accept || '*/*',
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

// Publications d'un utilisateur (par defaut, le compte connecte), paginees via
// max_id/next_max_id (comme le fil). Renvoie { posts, hasMore, nextMaxId }.
async function userFeed(session, userId, { maxId, count = 12 } = {}) {
  const id = userId || session.dsUserId
  let url = `/api/v1/feed/user/${id}/?count=${count}`
  if (maxId) url += `&max_id=${encodeURIComponent(maxId)}`
  const data = await webRequest(session, url)
  const items = data.items || []
  console.log(
    `[web-ig] userFeed(${id}) : ${items.length} publications | hasMore=${Boolean(data.more_available)}`,
  )
  return {
    posts: items.map(map.mapPost),
    hasMore: Boolean(data.more_available),
    nextMaxId: data.next_max_id || null,
  }
}

// Profil complet d'un compte (bio, compteurs, avatar HD) via l'endpoint web
// utilise par les pages de profil instagram.com.
async function userInfo(session, username) {
  const data = await webRequest(
    session,
    `/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
    { referer: `${BASE}/${encodeURIComponent(username)}/` },
  )
  const u = data?.data?.user
  if (!u) {
    const e = new Error('Profil Instagram introuvable.')
    e.code = 'not_found'
    throw e
  }
  console.log(
    `[web-ig] userInfo(${username}) : pk=${u.id} abonnes=${u.edge_followed_by?.count} publications=${u.edge_owner_to_timeline_media?.count} prive=${!!u.is_private}`,
  )
  return map.mapProfile(u)
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

// Carrousel des stories (comptes suivis ayant des stories actives). Endpoint de
// LECTURE : GET reels_tray. Chaque entree contient l'utilisateur et, souvent,
// deja ses items ; sinon on les recharge a la demande via storyReel().
async function stories(session) {
  const data = await webRequest(session, '/api/v1/feed/reels_tray/')
  const tray = data.tray || []
  const mapped = tray
    .map(map.mapStoryTray)
    .filter((t) => t.user && t.user.pk)
    // Tri : non vues d'abord, puis les plus recentes.
    .sort((a, b) => Number(a.seen) - Number(b.seen) || b.takenAt - a.takenAt)
  const withItems = mapped.filter((t) => t.items.length).length
  console.log(
    `[web-ig] stories() : ${tray.length} entrees -> ${mapped.length} comptes (${withItems} avec items deja charges)`,
  )
  return mapped
}

// Recupere les items (photos/videos) d'une story precise. reelId = pk du compte.
async function storyReel(session, reelId) {
  const id = String(reelId)
  const data = await webRequest(
    session,
    `/api/v1/feed/reels_media/?reel_ids=${encodeURIComponent(id)}`,
  )
  const reel =
    data.reels?.[id] ||
    (Array.isArray(data.reels_media) ? data.reels_media.find((r) => String(r.id) === id) : null)
  const items = reel?.items || []
  console.log(`[web-ig] storyReel(${id}) : ${items.length} elements`)
  return items.map(map.mapStoryItem)
}

// Fil des reels (onglet Reels). L'endpoint clips/home n'existe pas cote WEB
// (404) ; en revanche le fil timeline contient DEJA des reels (suggestions
// clips). On reutilise donc cet endpoint EPROUVE et on n'en garde que les
// videos/clips — pagination identique au fil (next_max_id).
async function reels(session, { maxId } = {}) {
  const form = maxId
    ? { reason: 'pagination', max_id: maxId, is_pull_to_refresh: '0' }
    : { reason: 'cold_start_fetch', is_pull_to_refresh: '0' }
  const data = await webRequest(session, '/api/v1/feed/timeline/', { method: 'POST', form })
  const items = data.feed_items || data.items || []
  const list = items.map(map.extractClip).filter(Boolean).map(map.mapReel).filter(Boolean)
  console.log(
    `[web-ig] reels() : ${items.length} elements bruts -> ${list.length} reels | hasMore=${Boolean(data.more_available)}`,
  )
  return {
    reels: list,
    hasMore: Boolean(data.more_available),
    nextMaxId: data.next_max_id || null,
  }
}

// Publications enregistrees (onglet Enregistres). GET feed/saved/posts.
async function saved(session, { maxId } = {}) {
  let url = '/api/v1/feed/saved/posts/?'
  if (maxId) url += `max_id=${encodeURIComponent(maxId)}`
  const data = await webRequest(session, url)
  const items = data.items || []
  const posts = items
    .map((i) => i.media || i)
    .filter((m) => m && m.user)
    .map(map.mapPost)
  console.log(
    `[web-ig] saved() : ${items.length} elements -> ${posts.length} publications | hasMore=${Boolean(data.more_available)}`,
  )
  return {
    posts,
    hasMore: Boolean(data.more_available),
    nextMaxId: data.next_max_id || null,
  }
}

// Collecte recursivement les objets "media" dans une reponse (utilise pour
// l'explore, dont la structure sectionnee est imbriquee et variable).
function collectMedia(node, out, seen, depth = 0) {
  if (!node || typeof node !== 'object' || depth > 7) return
  if (Array.isArray(node)) {
    for (const x of node) collectMedia(x, out, seen, depth + 1)
    return
  }
  // Un media a un identifiant, un auteur et des versions d'image.
  if (node.image_versions2 && node.user && (node.pk || node.id)) {
    const id = String(node.id || node.pk)
    if (!seen.has(id)) {
      seen.add(id)
      out.push(node)
    }
    return
  }
  for (const k of Object.keys(node)) collectMedia(node[k], out, seen, depth + 1)
}

// Grille "Explorer" (decouverte). L'API renvoie des sections imbriquees ; on
// en extrait tous les medias.
async function explore(session, { maxId } = {}) {
  let url =
    '/api/v1/discover/web/explore_grid/?is_prefetch=false&omit_cover_media=true' +
    '&use_sectional_payload=true&timezone_offset=0&include_fixed_destinations=false'
  if (maxId) url += `&max_id=${encodeURIComponent(maxId)}`
  const data = await webRequest(session, url)
  const medias = []
  collectMedia(data.sectional_items || data.items || data, medias, new Set())
  const posts = medias.map(map.mapPost)
  console.log(
    `[web-ig] explore() : ${medias.length} medias -> ${posts.length} publications | hasMore=${Boolean(data.more_available)}`,
  )
  return {
    posts,
    hasMore: Boolean(data.more_available),
    nextMaxId: data.next_max_id || data.max_id || null,
  }
}

function mapNotifs(data) {
  const stories = [...(data?.new_stories || []), ...(data?.old_stories || [])]
  return stories
    .map(map.mapNotification)
    .filter((n) => n.text)
    .sort((a, b) => b.timestamp - a.timestamp)
}

// Fil d'activite (j'aime, commentaires, abonnements) via news/inbox. Cet
// endpoint renvoie souvent 500 a une requete Node pour une session WEB ; on
// retente alors DANS la page Instagram (comme pour l'envoi de messages), ou il
// est normalement servi.
async function notifications(session) {
  const path = '/api/v1/news/inbox/?mark_as_seen=false'
  try {
    const data = await webRequest(session, path)
    const list = mapNotifs(data)
    console.log(`[web-ig] notifications() : ${list.length} affichees (voie serveur)`)
    return list
  } catch (e) {
    if (pageBridge.hasFetcher()) {
      console.log('[web-ig] notifications() : voie serveur en echec, repli via la page Instagram')
      const res = await pageBridge.get(path)
      if (res?.data) {
        const list = mapNotifs(res.data)
        console.log(`[web-ig] notifications() : ${list.length} affichees (voie page)`)
        return list
      }
    }
    throw e
  }
}

// Detail complet d'une publication (media/info). L'objet media embarque deja
// quelques commentaires (comments / preview_comments) : on les renvoie comme
// base fiable, car l'endpoint /comments/ dedie repond parfois en HTML.
async function postInfo(session, mediaId) {
  const data = await webRequest(session, `/api/v1/media/${encodeURIComponent(mediaId)}/info/`)
  const item = (data.items || [])[0]
  if (!item) {
    const e = new Error('Publication introuvable.')
    e.code = 'not_found'
    throw e
  }
  const raw = item.comments || item.preview_comments || []
  return { post: map.mapPost(item), comments: raw.map(map.mapComment) }
}

// Comptes ayant aime une publication.
async function likers(session, mediaId) {
  const data = await webRequest(session, `/api/v1/media/${encodeURIComponent(mediaId)}/likers/`)
  const users = (data.users || []).map(map.mapUser)
  console.log(`[web-ig] likers(${mediaId}) : ${users.length} comptes`)
  return users
}

// Commentaires d'une publication (page la plus pertinente). L'endpoint repond
// parfois en HTML au lieu de JSON pour une session web : on force donc
// Accept: application/json. En cas d'echec, l'appelant retombe sur les
// commentaires embarques dans media/info.
async function comments(session, mediaId, { minId } = {}) {
  let url =
    `/api/v1/media/${encodeURIComponent(mediaId)}/comments/` +
    '?can_support_threading=true&permalink_enabled=false'
  if (minId) url += `&min_id=${encodeURIComponent(minId)}`
  const data = await webRequest(session, url, { accept: 'application/json' })
  const list = (data.comments || []).map(map.mapComment)
  console.log(`[web-ig] comments(${mediaId}) : ${list.length} commentaires`)
  return {
    comments: list,
    hasMore: Boolean(data.has_more_comments),
    nextMinId: data.next_min_id || null,
  }
}

// Recherche de comptes (pour demarrer une nouvelle conversation).
async function searchUsers(session, query) {
  const data = await webRequest(
    session,
    `/api/v1/users/search/?q=${encodeURIComponent(query)}&count=20&context=blended`,
  )
  const users = (data.users || []).map(map.mapUser)
  console.log(`[web-ig] searchUsers("${query}") : ${users.length} comptes`)
  return users
}

// Cree (ou ouvre) une conversation avec un ou plusieurs comptes. Comme l'envoi,
// c'est une ECRITURE : on pilote la vraie page Instagram (page-bridge). Renvoie
// l'identifiant du thread cree.
async function startThread(session, usernames) {
  if (!pageBridge.hasCreator()) {
    const e = new Error('La creation de conversation n’est disponible que dans l’app de bureau.')
    e.code = 'no_page'
    throw e
  }
  console.log(`[web-ig] startThread() : creation avec [${usernames.join(', ')}]`)
  const res = await pageBridge.createThread(usernames)
  if (res?.ok && res.threadId) return { threadId: String(res.threadId) }
  if (/accounts\/login/i.test(res?.url || '')) {
    const e = new Error('Session Instagram expiree. Deconnecte-toi puis reconnecte-toi.')
    e.code = 'expired'
    throw e
  }
  const e = new Error(
    `Impossible de creer la conversation (etape : ${res?.stage || 'inconnue'}).`,
  )
  e.code = 'ig_error'
  throw e
}

// Stories a la une (highlights) d'un compte.
async function highlights(session, userId) {
  const data = await webRequest(
    session,
    `/api/v1/highlights/${encodeURIComponent(userId)}/highlights_tray/`,
  )
  const tray = data.tray || []
  const list = tray.map(map.mapHighlight).filter((h) => h.id)
  console.log(`[web-ig] highlights(${userId}) : ${list.length} a la une`)
  return list
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

module.exports = {
  me,
  meRaw,
  feed,
  inbox,
  thread,
  send,
  userFeed,
  userInfo,
  stories,
  storyReel,
  reels,
  saved,
  explore,
  notifications,
  postInfo,
  likers,
  comments,
  highlights,
  searchUsers,
  startThread,
}

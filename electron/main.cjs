// Application de bureau InstaLeo.
// - Embarque le serveur local (les requetes Instagram partent de TON IP).
// - Propose une connexion via une VRAIE fenetre Instagram : la connexion a lieu
//   sur la page officielle (aucun robot detecte), puis on reutilise la session.

const { app, BrowserWindow, ipcMain, session, shell } = require('electron')
const path = require('path')

// Dossier de donnees (session chiffree) + cookies http local.
app.setName('InstaLeo')
process.env.INSTALEO_DATA_DIR = app.getPath('userData')
process.env.COOKIE_INSECURE = '1'

require(path.join(__dirname, '..', 'server', 'env.cjs')).loadEnv()
const { start } = require(path.join(__dirname, '..', 'server.cjs'))
const desktop = require(path.join(__dirname, '..', 'api', '_lib', 'desktop-session.cjs'))
const pageBridge = require(path.join(__dirname, '..', 'api', '_lib', 'page-bridge.cjs'))

const IG_PARTITION = 'persist:instagram'
let mainWindow = null
// Fenetre cachee, chargee sur instagram.com et deja connectee (meme partition) :
// sert a executer les ECRITURES (envoi de message) dans le vrai contexte de la
// page, la ou le navigateur ajoute le signal same-origin qu'Instagram exige.
let igWorker = null

// En-tetes de securite qu'Instagram exige sur ses requetes d'ecriture (envoi de
// message...). Les LECTURES passent avec les seuls cookies + X-IG-App-ID, mais
// les ECRITURES sont renvoyees vers /accounts/login si ces en-tetes manquent —
// Instagram considere alors la requete comme non authentifiee et SUPPRIME le
// cookie sessionid dans sa reponse. Plutot que de deviner leurs valeurs (elles
// changent a chaque deploiement d'Instagram : X-ASBD-ID, hash X-Instagram-AJAX,
// identifiant X-Web-Session-ID...), on INTERCEPTE ceux que la vraie page envoie
// et on les rejoue tels quels sur nos appels serveur.
const IG_HEADER_ALLOWLIST = new Set([
  'x-ig-app-id',
  'x-asbd-id',
  'x-instagram-ajax',
  'x-web-session-id',
  'x-ig-www-claim',
  'x-bloks-version-id',
])
let capturedIgHeaders = {}

// Installe l'ecoute des requetes de la page Instagram : chaque appel que la page
// fait vers son API interne (/api/...) porte les en-tetes de securite a jour ;
// on retient les derniers vus. A poser AVANT toute navigation.
function setupIgHeaderCapture() {
  try {
    const igSession = session.fromPartition(IG_PARTITION)
    igSession.webRequest.onBeforeSendHeaders(
      { urls: ['*://*.instagram.com/api/*', '*://i.instagram.com/*'] },
      (details, callback) => {
        let changed = false
        for (const [name, value] of Object.entries(details.requestHeaders || {})) {
          const key = name.toLowerCase()
          if (IG_HEADER_ALLOWLIST.has(key) && value && capturedIgHeaders[key] !== value) {
            capturedIgHeaders[key] = value
            changed = true
          }
        }
        if (changed) {
          console.log(
            `[ig-headers] en-tetes captures depuis la page : [${Object.keys(capturedIgHeaders).join(', ')}]`,
          )
        }
        callback({ requestHeaders: details.requestHeaders })
      },
    )
    console.log('[ig-headers] interception des en-tetes Instagram active')
  } catch (e) {
    console.warn('[ig-headers] impossible d’activer l’interception :', e?.message || e)
  }
}

// Cree (ou reutilise) la fenetre cachee connectee a Instagram et attend qu'elle
// soit chargee. Elle partage la partition persist:instagram : si la session est
// valide, la page est deja authentifiee.
async function getIgWorker() {
  if (igWorker && !igWorker.isDestroyed()) return igWorker
  console.log('[ig-send] creation de la fenetre worker Instagram (cachee)')
  igWorker = new BrowserWindow({
    show: false,
    webPreferences: {
      partition: IG_PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  igWorker.on('closed', () => {
    igWorker = null
  })
  await igWorker.loadURL('https://www.instagram.com/')
  console.log('[ig-send] fenetre worker prete')
  return igWorker
}

// Envoie un message DANS le contexte de la page Instagram. Le navigateur ajoute
// lui-meme les en-tetes same-origin (Sec-Fetch-Site...) qu'Instagram exige sur
// les ecritures et que Node ne peut pas falsifier. On complete avec les x-*
// captures (asbd, claim, web-session...) pour coller au plus pres.
async function igPageSend(threadId, text, writeHeaders) {
  const win = await getIgWorker()
  const js = `(async () => {
    try {
      const csrftoken = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
      const ctx = String(Date.now()) + String(Math.floor(Math.random() * 1e9));
      const params = new URLSearchParams();
      params.set('action', 'send_item');
      params.set('thread_ids', '[' + ${JSON.stringify(String(threadId))} + ']');
      params.set('text', ${JSON.stringify(String(text))});
      params.set('client_context', ctx);
      params.set('offline_threading_id', ctx);
      const headers = Object.assign({}, ${JSON.stringify(writeHeaders || {})}, {
        'content-type': 'application/x-www-form-urlencoded',
        'x-requested-with': 'XMLHttpRequest',
        'x-ig-app-id': '936619743392459',
        'x-csrftoken': csrftoken,
      });
      const r = await fetch('/api/v1/direct_v2/threads/broadcast/text/', {
        method: 'POST',
        headers,
        body: params.toString(),
        credentials: 'include',
      });
      const raw = await r.text();
      let data = null;
      try { data = JSON.parse(raw); } catch (e) {}
      return { ok: r.ok, status: r.status, url: r.url, redirected: r.redirected, data, raw: raw.slice(0, 200), ctx };
    } catch (e) {
      return { error: String(e && e.message || e) };
    }
  })()`
  try {
    const res = await win.webContents.executeJavaScript(js)
    console.log(
      `[ig-send] resultat page : status=${res?.status} ok=${res?.ok} redirected=${res?.redirected} ` +
        `igStatus=${res?.data?.status || '?'}${res?.error ? ' error=' + res.error : ''}`,
    )
    return res
  } catch (e) {
    console.warn('[ig-send] executeJavaScript a echoue :', e?.message || e)
    return { error: String(e?.message || e) }
  }
}

function destroyIgWorker() {
  if (igWorker && !igWorker.isDestroyed()) {
    igWorker.destroy()
  }
  igWorker = null
}

async function createWindow() {
  const server = await start(0) // port libre aleatoire
  const { port } = server.address()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    backgroundColor: '#313338',
    title: 'InstaLeo',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(`http://localhost:${port}`)
}

// Lit les cookies Instagram de la fenetre de connexion et en fait une session.
// On capture aussi le VRAI User-Agent de cette fenetre : Instagram lie la
// session au User-Agent utilise a la connexion, et rejette (« useragent
// mismatch ») toute requete ulterieure envoyee avec un autre UA. En reutilisant
// exactement celui-ci pour tous les appels serveur, on evite ce blocage.
async function captureSession(ses, webContents) {
  const cookies = await ses.cookies.get({ url: 'https://www.instagram.com/' })
  const value = (name) => {
    const c = cookies.find((x) => x.name === name)
    return c ? c.value : undefined
  }
  const sessionid = value('sessionid')
  const dsUserId = value('ds_user_id')
  if (!sessionid || !dsUserId) return null
  console.log(
    `[ig-login] cookies captures : [${cookies.map((c) => c.name).join(', ')}] | UA=${webContents.getUserAgent().slice(0, 60)}…`,
  )
  const igHeaders = { ...capturedIgHeaders }
  console.log(
    `[ig-login] en-tetes de securite rejoues : [${Object.keys(igHeaders).join(', ') || 'aucun (la page n’a pas encore appele l’API)'}]`,
  )
  return {
    sessionid,
    dsUserId,
    csrftoken: value('csrftoken') || '',
    username: value('ds_user') || '', // Instagram expose parfois le pseudo ici
    cookieHeader: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    userAgent: webContents.getUserAgent(),
    // En-tetes d'ecriture interceptes sur la vraie page (voir setupIgHeaderCapture).
    igHeaders,
  }
}

// Recupere le profil connecte DEPUIS la page Instagram (same-origin, meme UA,
// meme cookies). Deux strategies, dans l'ordre :
//  1) l'API interne current_user (donnees completes : nom, verifie, prive) ;
//  2) repli SANS reseau : Instagram affiche toujours l'avatar du compte
//     connecte dans sa barre de navigation, avec un attribut alt du type
//     "<pseudo>'s profile picture" — on le lit directement dans le DOM. Ca ne
//     peut pas declencher de blocage anti-bot puisque ce n'est pas une requete.
async function fetchViewer(webContents) {
  const js = `(async () => {
    const result = { ok: false };
    try {
      const csrftoken = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
      const r = await fetch('https://www.instagram.com/api/v1/accounts/current_user/?edit=false', {
        headers: { 'x-ig-app-id': '936619743392459', 'x-csrftoken': csrftoken },
        credentials: 'include',
      });
      const d = await r.json().catch(() => null);
      const u = d && d.user;
      if (u) {
        return { ok: true, source: 'api', user: {
          pk: String(u.pk || u.pk_id || ''),
          username: u.username || '',
          full_name: u.full_name || '',
          profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || '',
          is_verified: !!u.is_verified,
          is_private: !!u.is_private,
        } };
      }
      result.apiStatus = r.status;
      result.apiBody = d;
    } catch (e) { result.apiError = String(e && e.message || e); }

    try {
      const imgs = Array.from(document.querySelectorAll('img[alt]'));
      const mine = imgs.find((img) => /profile picture|photo de profil/i.test(img.alt));
      if (mine) {
        const m = mine.alt.match(/^(.+?)['’]s profile picture$/i) ||
                  mine.alt.match(/^Photo de profil de (.+)$/i);
        return { ok: true, source: 'dom', user: {
          pk: '',
          username: m ? m[1] : '',
          full_name: '',
          profile_pic_url: mine.currentSrc || mine.src || '',
          is_verified: false,
          is_private: false,
        } };
      }
      result.domHint = 'aucune image avec alt "profile picture" trouvee';
    } catch (e) { result.domError = String(e && e.message || e); }

    return result;
  })()`
  try {
    return await webContents.executeJavaScript(js)
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

// La page peut encore etre en transition juste apres la connexion (redirection,
// dialogue "enregistrer les identifiants", etc.) : on retente quelques fois
// avant d'abandonner.
async function fetchViewerWithRetries(webContents, attempts = 5, delayMs = 900) {
  for (let i = 0; i < attempts; i++) {
    const r = await fetchViewer(webContents)
    if (r?.ok && r.user && (r.user.username || r.user.profile_pic_url)) {
      console.log(`[ig-login] profil recupere via "${r.source}" :`, r.user.username)
      return r.user
    }
    console.warn(`[ig-login] recuperation du profil (essai ${i + 1}/${attempts}) :`, r)
    if (i < attempts - 1) await new Promise((r2) => setTimeout(r2, delayMs))
  }
  return null
}

// Ouvre la vraie page de connexion Instagram et capture la session une fois
// l'utilisateur connecte.
ipcMain.handle('ig-login', async () => {
  console.log('[ig-login] ouverture de la fenetre de connexion Instagram')
  return await new Promise((resolve) => {
    const authWin = new BrowserWindow({
      width: 540,
      height: 740,
      parent: mainWindow,
      modal: true,
      title: 'Connexion Instagram',
      autoHideMenuBar: true,
      webPreferences: {
        partition: IG_PARTITION,
        contextIsolation: true,
        nodeIntegration: false,
      },
    })
    const ses = authWin.webContents.session
    let done = false

    const tryCapture = async () => {
      if (done) return
      const s = await captureSession(ses, authWin.webContents)
      if (!s) return
      done = true
      clearInterval(poll)
      // Recupere le profil dans le contexte de la page (pseudo, nom, photo).
      const viewer = await fetchViewerWithRetries(authWin.webContents)
      if (viewer) {
        // Le repli DOM ne connait pas le pk : on utilise celui du cookie.
        s.user = { ...viewer, pk: viewer.pk || s.dsUserId }
        if (!s.username) s.username = viewer.username
      } else {
        console.warn(
          '[ig-login] profil non recupere ; la session reste utilisable (pk =',
          s.dsUserId,
          ')',
        )
      }
      // Les en-tetes d'ecriture n'arrivent parfois qu'apres le chargement du
      // feed (Instagram appelle son API en differe). L'attente du profil
      // ci-dessus a laisse le temps a ces appels de partir : on re-capture donc
      // ici pour prendre le jeu d'en-tetes le plus complet.
      s.igHeaders = { ...capturedIgHeaders }
      console.log(
        `[ig-login] en-tetes finaux enregistres : [${Object.keys(s.igHeaders).join(', ') || 'aucun'}]`,
      )
      desktop.set(s)
      // Repart d'une page worker fraiche (authentifiee) pour les prochains envois.
      destroyIgWorker()
      console.log('[ig-login] session complete, fenetre fermee')
      if (!authWin.isDestroyed()) authWin.close()
      resolve({ ok: true })
    }

    // Certains changements de cookie ne declenchent pas d'evenement de
    // navigation : on verifie aussi periodiquement.
    const poll = setInterval(tryCapture, 1500)

    authWin.webContents.on('did-navigate', (_e, url) => {
      console.log(`[ig-login] navigation -> ${url.slice(0, 100)}`)
      tryCapture()
    })
    authWin.webContents.on('did-frame-navigate', tryCapture)
    authWin.webContents.on('did-finish-load', tryCapture)
    authWin.on('closed', () => {
      clearInterval(poll)
      if (!done) {
        console.log('[ig-login] fenetre fermee sans session capturee (annule ?)')
        resolve({ ok: false, cancelled: true })
      }
    })

    authWin.loadURL('https://www.instagram.com/accounts/login/')
  })
})

ipcMain.handle('ig-logout', async () => {
  console.log('[ig-login] deconnexion demandee')
  desktop.clear()
  capturedIgHeaders = {}
  destroyIgWorker() // la page cachee doit repartir de zero a la prochaine connexion
  try {
    await session.fromPartition(IG_PARTITION).clearStorageData()
  } catch {
    /* rien a nettoyer */
  }
  return { ok: true }
})

app.whenReady().then(() => {
  console.log('[instaleo] application prete, ouverture de la fenetre principale')
  setupIgHeaderCapture()
  // Les envois de message passeront par la page reelle (voir page-bridge.cjs).
  pageBridge.setSender(igPageSend)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

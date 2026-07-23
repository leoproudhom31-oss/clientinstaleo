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
    // Journalise les requetes POST de messagerie que la page declenche : c'est
    // ainsi qu'on VOIT le vrai endpoint d'envoi utilise par Instagram (et son
    // code HTTP), quand on pilote le composeur.
    igSession.webRequest.onCompleted(
      { urls: ['*://*.instagram.com/api/*', '*://*.instagram.com/graphql*', '*://*.instagram.com/ajax/*'] },
      (details) => {
        if (details.method !== 'POST') return
        if (!/direct|broadcast|message|thread|send/i.test(details.url)) return
        console.log(`[ig-net] POST ${details.url.slice(0, 130)} -> ${details.statusCode}`)
      },
    )
    console.log('[ig-headers] interception des en-tetes Instagram active')
  } catch (e) {
    console.warn('[ig-headers] impossible d’activer l’interception :', e?.message || e)
  }
}

// Cree (ou reutilise) la fenetre cachee connectee a Instagram, et l'amene sur
// l'URL demandee. Elle partage la partition persist:instagram : si la session
// est valide, la page est deja authentifiee.
async function getIgWorker(targetUrl) {
  if (!igWorker || igWorker.isDestroyed()) {
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
  }
  if (targetUrl && !igWorker.webContents.getURL().startsWith(targetUrl)) {
    await igWorker.webContents.loadURL(targetUrl)
    console.log(`[ig-send] worker sur ${targetUrl}`)
  }
  return igWorker
}

// Envoie un message en PILOTANT le vrai composeur d'Instagram dans la page.
//
// Pourquoi ne pas rejouer nous-memes la requete ? Parce que le POST
// /broadcast/text/ est renvoye vers /accounts/login/ pour une session WEB,
// meme execute depuis la page (endpoint reserve a l'app mobile). La seule voie
// fiable est donc de laisser le JavaScript d'Instagram construire et envoyer la
// requete qu'il utilise vraiment : on ouvre la conversation, on ecrit dans le
// champ, et on declenche l'envoi. On confirme ensuite que le champ s'est vide
// (Instagram ne le vide qu'apres avoir accepte l'envoi).
async function igPageSend(threadId, text) {
  const target = `https://www.instagram.com/direct/t/${encodeURIComponent(threadId)}/`
  const win = await getIgWorker(target)
  const wc = win.webContents

  const js = `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const TEXT = ${JSON.stringify(String(text))};
    const log = [];

    // 1) Attendre le composeur (textarea ou div contenteditable).
    const findBox = () => document.querySelector(
      'textarea[placeholder]'
      + ', div[contenteditable="true"][role="textbox"]'
      + ', div[aria-label][contenteditable="true"]'
      + ', textarea[aria-label]'
    );
    let box = null;
    for (let i = 0; i < 80; i++) { box = findBox(); if (box) break; await sleep(250); }
    if (!box) {
      // Peut-etre bloque par login / onetap.
      const url = location.href;
      return { ok: false, stage: 'composer', error: 'champ de saisie introuvable', url };
    }

    // 2) Ecrire le texte de facon a ce que React le prenne en compte.
    box.focus();
    const isTextarea = box.tagName === 'TEXTAREA';
    if (isTextarea) {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
      setter.call(box, TEXT);
      box.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      try { document.execCommand('selectAll', false, null); } catch (e) {}
      try { document.execCommand('insertText', false, TEXT); } catch (e) {}
      box.dispatchEvent(new InputEvent('input', { bubbles: true, data: TEXT, inputType: 'insertText' }));
    }
    await sleep(350);
    const readBox = () => (isTextarea ? box.value : box.textContent) || '';
    log.push('texte ecrit len=' + readBox().length);

    // 3) Declencher l'envoi : bouton "Envoyer"/"Send" si present, sinon Entree.
    const clickSend = () => {
      const cands = Array.from(document.querySelectorAll('div[role="button"], button, [role="button"]'));
      const send = cands.find((b) => /^(envoyer|send)$/i.test((b.textContent || '').trim()));
      if (send) { send.click(); return true; }
      return false;
    };
    let method = 'button';
    if (!clickSend()) {
      method = 'enter';
      for (const type of ['keydown', 'keypress', 'keyup']) {
        box.dispatchEvent(new KeyboardEvent(type, {
          key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true,
        }));
      }
    }
    log.push('envoi declenche via ' + method);

    // 4) Confirmer : le composeur se vide quand Instagram a accepte l'envoi.
    for (let i = 0; i < 40; i++) {
      await sleep(250);
      if (readBox().trim() === '') return { ok: true, method, log };
    }
    return { ok: false, stage: 'confirm', error: 'le champ ne s\\'est pas vide (envoi non confirme)', method, log, box: readBox().slice(0, 40) };
  })()`

  try {
    const res = await wc.executeJavaScript(js)
    console.log(
      `[ig-send] resultat UI : ok=${res?.ok} stage=${res?.stage || '-'} method=${res?.method || '-'}` +
        `${res?.error ? ' error=' + res.error : ''}${res?.url ? ' url=' + res.url : ''}` +
        `${res?.log ? ' | ' + res.log.join(' > ') : ''}`,
    )
    return res
  } catch (e) {
    console.warn('[ig-send] executeJavaScript a echoue :', e?.message || e)
    return { ok: false, error: String(e?.message || e) }
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

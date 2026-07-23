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

const IG_PARTITION = 'persist:instagram'
let mainWindow = null

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
  return {
    sessionid,
    dsUserId,
    csrftoken: value('csrftoken') || '',
    username: value('ds_user') || '', // Instagram expose parfois le pseudo ici
    cookieHeader: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
    userAgent: webContents.getUserAgent(),
  }
}

// Recupere le profil connecte DEPUIS la page Instagram (same-origin, meme UA,
// meme cookies) : c'est la facon la plus fiable d'obtenir pseudo, nom et photo
// de profil, sans jamais declencher de blocage anti-bot.
async function fetchViewer(webContents) {
  const js = `(async () => {
    try {
      const csrftoken = (document.cookie.match(/csrftoken=([^;]+)/) || [])[1] || '';
      const r = await fetch('https://www.instagram.com/api/v1/accounts/current_user/?edit=false', {
        headers: { 'x-ig-app-id': '936619743392459', 'x-csrftoken': csrftoken },
        credentials: 'include',
      });
      const status = r.status;
      const d = await r.json().catch(() => null);
      const u = d && d.user;
      if (!u) return { ok: false, status, body: d };
      return { ok: true, user: {
        pk: String(u.pk || u.pk_id || ''),
        username: u.username || '',
        full_name: u.full_name || '',
        profile_pic_url: u.profile_pic_url_hd || u.profile_pic_url || '',
        is_verified: !!u.is_verified,
        is_private: !!u.is_private,
      } };
    } catch (e) { return { ok: false, error: String(e && e.message || e) }; }
  })()`
  try {
    return await webContents.executeJavaScript(js)
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
}

// La page peut encore etre en transition juste apres la connexion : on retente
// quelques fois avant d'abandonner.
async function fetchViewerWithRetries(webContents, attempts = 4, delayMs = 800) {
  for (let i = 0; i < attempts; i++) {
    const r = await fetchViewer(webContents)
    if (r?.ok) return r.user
    console.warn(`[ig-login] recuperation du profil (essai ${i + 1}/${attempts}) :`, r)
    if (i < attempts - 1) await new Promise((r2) => setTimeout(r2, delayMs))
  }
  return null
}

// Ouvre la vraie page de connexion Instagram et capture la session une fois
// l'utilisateur connecte.
ipcMain.handle('ig-login', async () => {
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
        s.user = viewer
        if (!s.username) s.username = viewer.username
        console.log('[ig-login] profil recupere :', viewer.username)
      } else {
        console.warn(
          '[ig-login] profil non recupere ; la session reste utilisable (pk =',
          s.dsUserId,
          ')',
        )
      }
      desktop.set(s)
      if (!authWin.isDestroyed()) authWin.close()
      resolve({ ok: true })
    }

    // Certains changements de cookie ne declenchent pas d'evenement de
    // navigation : on verifie aussi periodiquement.
    const poll = setInterval(tryCapture, 1500)

    authWin.webContents.on('did-navigate', tryCapture)
    authWin.webContents.on('did-frame-navigate', tryCapture)
    authWin.webContents.on('did-finish-load', tryCapture)
    authWin.on('closed', () => {
      clearInterval(poll)
      if (!done) resolve({ ok: false, cancelled: true })
    })

    authWin.loadURL('https://www.instagram.com/accounts/login/')
  })
})

ipcMain.handle('ig-logout', async () => {
  desktop.clear()
  try {
    await session.fromPartition(IG_PARTITION).clearStorageData()
  } catch {
    /* rien a nettoyer */
  }
  return { ok: true }
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

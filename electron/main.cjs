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
async function captureSession(ses) {
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
    cookieHeader: cookies.map((c) => `${c.name}=${c.value}`).join('; '),
  }
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
      const s = await captureSession(ses)
      if (s) {
        done = true
        desktop.set(s)
        clearInterval(poll)
        if (!authWin.isDestroyed()) authWin.close()
        resolve({ ok: true })
      }
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

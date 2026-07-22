// Application de bureau InstaLeo (optionnelle).
// Elle embarque le serveur local et ouvre une fenetre dessus : les requetes
// Instagram partent de TON IP. Aucune IPC n'est necessaire — l'interface parle
// au serveur local en same-origin, exactement comme la version web.
//
// Lancer :   npm i -D electron   puis   npx electron electron/main.cjs
// Empaqueter : npm i -D electron electron-builder   puis   npm run desktop:build

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

// Cookies de session en http local.
process.env.COOKIE_INSECURE = '1'

const { start } = require(path.join(__dirname, '..', 'server.cjs'))

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
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Les liens externes s'ouvrent dans le navigateur, pas dans l'app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  await mainWindow.loadURL(`http://localhost:${port}`)
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

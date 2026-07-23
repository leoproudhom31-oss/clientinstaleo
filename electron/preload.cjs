// Pont securise entre l'interface (renderer) et le processus Electron.
// Expose uniquement ce qui est necessaire pour la connexion « vraie fenetre
// Instagram ».

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('instaleoDesktop', {
  isDesktop: true,
  // Ouvre une vraie fenetre Instagram, capture la session apres connexion.
  igLogin: () => ipcRenderer.invoke('ig-login'),
  // Efface la session capturee.
  igLogout: () => ipcRenderer.invoke('ig-logout'),
})

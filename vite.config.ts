import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)

// Fait tourner les routes /api directement dans le serveur de dev Vite.
// Consequence : en `npm run dev`, la connexion Instagram fonctionne et part
// de TON adresse IP (client), pas d'un datacenter.
function apiDevServer(): Plugin {
  return {
    name: 'instaleo-api-dev',
    configureServer(server) {
      process.env.COOKIE_INSECURE = process.env.COOKIE_INSECURE || '1'
      server.middlewares.use(async (req, res, next) => {
        if (!req.url || !req.url.startsWith('/api/')) return next()
        try {
          const { handleApi } = require('./server/adapter.cjs')
          const handled = await handleApi(req, res)
          if (!handled) next()
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: (e as Error)?.message || 'Erreur' }))
        }
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), apiDevServer()],
  server: {
    port: 5173,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})

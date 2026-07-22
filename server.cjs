// Serveur local autonome : sert l'interface (dist/) + les routes /api sur TA
// machine. Les requetes vers Instagram partent donc de TON adresse IP, ce qui
// evite le blocage des IP de datacenter.
//
//   npm run build   (une fois, genere dist/)
//   npm run serve   (lance ce serveur)
//   -> ouvre http://localhost:4321

const http = require('http')
const fs = require('fs')
const path = require('path')
const { handleApi } = require('./server/adapter.cjs')

// Les cookies doivent fonctionner en http sur localhost.
process.env.COOKIE_INSECURE = process.env.COOKIE_INSECURE || '1'

const PORT = Number(process.env.PORT) || 4321
const DIST = path.join(__dirname, 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
}

const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'self'; " +
  "form-action 'self'; frame-ancestors 'none'; object-src 'none'"

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Content-Security-Policy', CSP)
}

function serveStatic(req, res) {
  let pathname = decodeURIComponent(req.url.split('?')[0])
  if (pathname === '/') pathname = '/index.html'
  // Anti-traversal.
  const filePath = path.join(DIST, path.normalize(pathname))
  if (!filePath.startsWith(DIST)) {
    res.statusCode = 403
    return res.end('Forbidden')
  }

  fs.readFile(filePath, (err, buf) => {
    securityHeaders(res)
    if (err) {
      // SPA : tout le reste retombe sur index.html
      fs.readFile(path.join(DIST, 'index.html'), (e2, html) => {
        if (e2) {
          res.statusCode = 500
          return res.end(
            'dist/ introuvable. Lance d’abord "npm run build".',
          )
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(html)
      })
      return
    }
    res.setHeader('Content-Type', MIME[path.extname(filePath)] || 'application/octet-stream')
    res.end(buf)
  })
}

// Cree le serveur http (sans l'ecouter) — reutilise par Electron.
function createServer() {
  return http.createServer(async (req, res) => {
    if (req.url.startsWith('/api/')) {
      const handled = await handleApi(req, res)
      if (handled) return
    }
    serveStatic(req, res)
  })
}

// Lance le serveur sur un port et renvoie une promesse d'adresse.
function start(port = PORT) {
  return new Promise((resolve) => {
    const server = createServer()
    server.listen(port, () => resolve(server))
  })
}

module.exports = { createServer, start, PORT }

// Execution directe : `node server.cjs`
if (require.main === module) {
  start(PORT).then(() => {
    console.log('\n  InstaLeo — client local pret ✅')
    console.log(`  Ouvre :  http://localhost:${PORT}\n`)
    console.log('  Les requetes Instagram partent de ton IP (pas d’un datacenter).')
    if (!process.env.IG_PROXY) {
      console.log('  (Optionnel) definis IG_PROXY pour passer par un proxy.\n')
    }
  })
}

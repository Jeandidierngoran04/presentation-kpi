// Mini-serveur local pour afficher le site vitrine (remplace "python -m http.server").
// Utilise uniquement Node, aucune dépendance à installer.
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const racine = fileURLToPath(new URL('.', import.meta.url))
const port = Number(process.env.PORT) || 8080

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const chemin = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
  let fichier = resolve(join(racine, chemin))

  // Interdit de sortir du dossier du site et de servir les fichiers cachés (.env, .git...)
  const horsDuSite = fichier !== resolve(racine) && !fichier.startsWith(resolve(racine) + sep)
  if (horsDuSite || chemin.split('/').some((morceau) => morceau.startsWith('.'))) {
    res.writeHead(403).end('Accès refusé')
    return
  }

  try {
    if ((await stat(fichier)).isDirectory()) {
      // Comme python : /connexion -> /connexion/ pour que les liens relatifs marchent
      if (!chemin.endsWith('/')) {
        res.writeHead(301, { Location: chemin + '/' }).end()
        return
      }
      fichier = join(fichier, 'index.html')
    }
    const contenu = await readFile(fichier)
    res.writeHead(200, { 'Content-Type': types[extname(fichier).toLowerCase()] || 'application/octet-stream' })
    res.end(contenu)
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Page introuvable : ' + chemin)
  }
}).listen(port, '127.0.0.1', () => {
  console.log(`Site vitrine disponible sur http://localhost:${port}`)
})

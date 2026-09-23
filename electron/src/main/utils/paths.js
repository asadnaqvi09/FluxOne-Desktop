const path = require('node:path')
const fs = require('node:fs')
const http = require('node:http')
const { app } = require('electron')

const DEFAULT_API_PORT = 3000
const DEFAULT_VITE_PORT = 5173
const SQLITE_NAME = 'fluxone.db'
const SQLITE_SIDECARS = ['fluxone.db-wal', 'fluxone.db-shm']
const SNAPSHOT_STAMP = 'fluxone.snapshot'

function snapshotStampPath(dbFile) {
  return path.join(path.dirname(dbFile), SNAPSHOT_STAMP)
}

function readStamp(stampFile) {
  if (!fs.existsSync(stampFile)) return ''
  return String(fs.readFileSync(stampFile, 'utf8')).trim()
}

function writeStamp(stampFile, id) {
  fs.writeFileSync(stampFile, `${id}\n`)
}

/** electron/ package root (src/main/utils → ../../../) */
function electronRoot() {
  return path.resolve(__dirname, '../../..')
}

function repoRoot() {
  if (app.isPackaged) {
    return process.resourcesPath
  }
  return path.resolve(electronRoot(), '..')
}

function serverRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server')
  }
  return path.join(repoRoot(), 'server')
}

function clientDistPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'client-dist')
  }
  const dist = path.join(repoRoot(), 'client', 'dist')
  return fs.existsSync(path.join(dist, 'index.html')) ? dist : ''
}

/** Packaged: resources/nodejs/node.exe — same ABI as bundled server deps */
function bundledNodePath() {
  const name = process.platform === 'win32' ? 'node.exe' : 'node'
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'nodejs', name)
  }
  // Dev optional: electron/resources/nodejs after prepare-dist
  const local = path.join(electronRoot(), 'resources', 'nodejs', name)
  return fs.existsSync(local) ? local : ''
}

function bundledSqlitePath() {
  return path.join(serverRoot(), 'data', SQLITE_NAME)
}

function copySqliteFiles(srcDb, destDb) {
  fs.mkdirSync(path.dirname(destDb), { recursive: true })
  const destDir = path.dirname(destDb)
  for (const name of SQLITE_SIDECARS) {
    const stale = path.join(destDir, name)
    if (fs.existsSync(stale)) fs.unlinkSync(stale)
  }
  fs.copyFileSync(srcDb, destDb)
  const srcDir = path.dirname(srcDb)
  for (const name of SQLITE_SIDECARS) {
    const from = path.join(srcDir, name)
    if (fs.existsSync(from)) {
      fs.copyFileSync(from, path.join(destDir, name))
    }
  }
}

/**
 * Dev (`npm run dev` / `dev:dist`): use server/data/fluxone.db — same file as
 * `cd server && npm run dev`.
 *
 * Packaged .exe: copy the installer snapshot (built from server/data/fluxone.db)
 * into userData. A new .exe with a new snapshot replaces an old AppData DB so
 * System B sees the transactions that were on System A at build time.
 */
function sqlitePath() {
  if (!app.isPackaged) {
    const dest = bundledSqlitePath()
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    return dest
  }

  const src = bundledSqlitePath()
  if (!fs.existsSync(src)) {
    throw new Error(
      `Bundled database not found at ${src}. Rebuild the installer with server/data/fluxone.db present.`,
    )
  }

  const dest = path.join(app.getPath('userData'), SQLITE_NAME)
  const bundledId = readStamp(snapshotStampPath(src))
  const installedId = readStamp(snapshotStampPath(dest))
  const needCopy = !fs.existsSync(dest) || !bundledId || bundledId !== installedId

  if (needCopy) {
    copySqliteFiles(src, dest)
    if (bundledId) writeStamp(snapshotStampPath(dest), bundledId)
    console.log(`[fluxone] installed snapshot DB → ${dest}`)
  }
  return dest
}

function apiPort() {
  const n = Number(process.env.FLUXONE_API_PORT || DEFAULT_API_PORT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_API_PORT
}

function vitePort() {
  const n = Number(process.env.FLUXONE_VITE_PORT || DEFAULT_VITE_PORT)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_VITE_PORT
}

function healthUrl() {
  return `http://127.0.0.1:${apiPort()}/api/health`
}

function apiUiUrl() {
  return `http://127.0.0.1:${apiPort()}`
}

function viteUiUrl() {
  return `http://127.0.0.1:${vitePort()}`
}

function probeUrl(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(Boolean(res.statusCode && res.statusCode < 500))
    })
    req.on('error', () => resolve(false))
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function preferStaticDist() {
  return (
    process.argv.includes('--dist') || process.env.FLUXONE_USE_DIST === '1'
  )
}

/**
 * Packaged .exe → Express always serves client/dist (bundled snapshot).
 * Dev (`npm run dev` in electron/) → live Vite first, so UI matches
 * `cd client && npm run dev`. Old client/dist is only a fallback.
 * Force the snapshot with: `npm run dev:dist`
 */
async function resolveUiUrl() {
  if (app.isPackaged) {
    return apiUiUrl()
  }
  if (!preferStaticDist() && (await probeUrl(viteUiUrl()))) {
    return viteUiUrl()
  }
  if (await probeUrl(apiUiUrl())) return apiUiUrl()
  if (await probeUrl(viteUiUrl())) return viteUiUrl()
  return apiUiUrl()
}

module.exports = {
  electronRoot,
  repoRoot,
  serverRoot,
  clientDistPath,
  bundledNodePath,
  bundledSqlitePath,
  sqlitePath,
  apiPort,
  vitePort,
  healthUrl,
  apiUiUrl,
  viteUiUrl,
  resolveUiUrl,
  probeUrl,
  DEFAULT_API_PORT,
  DEFAULT_VITE_PORT,
}

/**
 * Prepare Electron packaging resources:
 * - ensure client/dist exists
 * - build schema-only SQLite snapshot (no demo users/catalog) under electron/resources/schema-db
 * - require server production deps (copied into .exe by after-pack.cjs)
 * - bundle current Node binary (same ABI as server better-sqlite3)
 * - copy app icon
 *
 * Does NOT wipe server/data/fluxone.db (dev/cloud sync DB stays intact).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const electronRoot = path.resolve(__dirname, '..')
const repoRoot = path.resolve(electronRoot, '..')
const serverRoot = path.join(repoRoot, 'server')
const schemaDbDir = path.join(electronRoot, 'resources', 'schema-db')
const schemaDbPath = path.join(schemaDbDir, 'fluxone.db')

function mustExist(p, label) {
  if (!fs.existsSync(p)) {
    throw new Error(`Missing ${label}: ${p}`)
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.copyFileSync(src, dest)
  console.log(`Copied ${path.basename(src)} → ${dest}`)
}

/** Fresh empty schema for the installer — users/catalog come from cloud bootstrap. */
function buildSchemaOnlySnapshot() {
  fs.mkdirSync(schemaDbDir, { recursive: true })
  for (const name of ['fluxone.db', 'fluxone.db-wal', 'fluxone.db-shm', 'fluxone.snapshot']) {
    const p = path.join(schemaDbDir, name)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  }

  const env = {
    ...process.env,
    SQLITE_PATH: schemaDbPath,
  }
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'migrate'],
    { cwd: serverRoot, stdio: 'inherit', shell: true, env },
  )
  if (r.status !== 0) {
    throw new Error('Failed to create schema-only packaging DB (npm run migrate)')
  }

  mustExist(schemaDbPath, 'electron/resources/schema-db/fluxone.db')

  const Database = require(path.join(serverRoot, 'node_modules', 'better-sqlite3'))
  const db = new Database(schemaDbPath, { readonly: true })
  const employees = db.prepare('SELECT COUNT(*) AS n FROM employees').get()?.n ?? 0
  const products = db.prepare('SELECT COUNT(*) AS n FROM products').get()?.n ?? 0
  db.close()
  if (employees > 0 || products > 0) {
    throw new Error(
      `Packaging DB not clean (employees=${employees}, products=${products}). Expected empty schema.`,
    )
  }
  console.log('[prepare-dist] schema-only packaging DB OK (0 employees, 0 products)')
}

// 1) Client build
const clientIndex = path.join(repoRoot, 'client', 'dist', 'index.html')
if (!fs.existsSync(clientIndex)) {
  console.log('client/dist missing — running client build…')
  const r = spawnSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['run', 'build'],
    { cwd: path.join(repoRoot, 'client'), stdio: 'inherit', shell: true },
  )
  if (r.status !== 0) throw new Error('client build failed')
}
mustExist(clientIndex, 'client dist index.html')

// 2) Server entry + packaging schema DB + production deps check
mustExist(path.join(serverRoot, 'index.js'), 'server entry')
mustExist(
  path.join(serverRoot, 'node_modules', 'better-sqlite3'),
  'server better-sqlite3 (run npm install in server/)',
)
mustExist(
  path.join(serverRoot, 'node_modules', 'express'),
  'server express (run npm install in server/)',
)
buildSchemaOnlySnapshot()

// 3) Bundle Node (packaged app must not depend on PATH)
const nodeDir = path.join(electronRoot, 'resources', 'nodejs')
fs.mkdirSync(nodeDir, { recursive: true })
const nodeName = process.platform === 'win32' ? 'node.exe' : 'node'
const bundledNode = path.join(nodeDir, nodeName)
copyFile(process.execPath, bundledNode)
console.log(`Bundled Node ${process.version} for packaging`)

// 4) Icon
const logoSrc = path.join(repoRoot, 'client', 'public', 'assets', 'company-logo.png')
const iconDest = path.join(electronRoot, 'assets', 'icon.png')
mustExist(logoSrc, 'company logo')
copyFile(logoSrc, iconDest)

console.log('prepare-dist OK')

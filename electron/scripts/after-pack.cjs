/**
 * electron-builder afterPack — copy server production deps + schema-only snapshot DB.
 *
 * Why: extraResources respects .gitignore, which excludes node_modules and *.db.
 * GitHub stays clean; the .exe ships Express, better-sqlite3, and an empty schema
 * so first-run Setup → cloud bootstrap fills users/catalog (no demo credentials).
 */
const fs = require('node:fs')
const path = require('node:path')

const SQLITE_NAME = 'fluxone.db'
const SQLITE_SIDECARS = ['fluxone.db-wal', 'fluxone.db-shm']
const SNAPSHOT_STAMP = 'fluxone.snapshot'

function checkpointSqlite(dbPath, betterSqlitePath) {
  try {
    const Database = require(betterSqlitePath)
    const db = new Database(dbPath)
    db.pragma('wal_checkpoint(TRUNCATE)')
    db.close()
  } catch (err) {
    console.warn(`[afterPack] WAL checkpoint skipped: ${err.message}`)
  }
}

function copySqliteSnapshot(projectDir, destServer) {
  // Packaging schema-only DB (built by prepare-dist). Never ship demo / local cloud data.
  const schemaDb = path.join(projectDir, 'resources', 'schema-db', SQLITE_NAME)
  const srcDb = schemaDb
  const srcDir = path.dirname(srcDb)

  if (!fs.existsSync(srcDb)) {
    throw new Error(
      `afterPack: schema-only DB missing. Run prepare:dist first (expected ${schemaDb})`,
    )
  }

  const destData = path.join(destServer, 'data')
  fs.mkdirSync(destData, { recursive: true })
  const destDb = path.join(destData, SQLITE_NAME)
  fs.copyFileSync(srcDb, destDb)

  for (const extra of SQLITE_SIDECARS) {
    const src = path.join(srcDir, extra)
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(destData, extra))
    }
  }

  checkpointSqlite(destDb, path.join(destServer, 'node_modules', 'better-sqlite3'))

  // Guard: refuse to ship demo / preloaded users
  try {
    const Database = require(path.join(destServer, 'node_modules', 'better-sqlite3'))
    const db = new Database(destDb, { readonly: true })
    const employees = db.prepare('SELECT COUNT(*) AS n FROM employees').get()?.n ?? 0
    db.close()
    if (employees > 0) {
      throw new Error(
        `afterPack: packaged DB has ${employees} employee(s). Installer must be schema-only (cloud sync).`,
      )
    }
  } catch (err) {
    if (String(err.message || '').includes('Installer must be schema-only')) throw err
    console.warn(`[afterPack] employee count check skipped: ${err.message}`)
  }

  const st = fs.statSync(destDb)
  const snapshotId = `${st.size}:${Math.floor(st.mtimeMs)}`
  fs.writeFileSync(path.join(destData, SNAPSHOT_STAMP), `${snapshotId}\n`)

  console.log(
    `[afterPack] bundled ${SQLITE_NAME} from ${path.relative(projectDir, srcDb)} → resources/server/data/ (${snapshotId})`,
  )
}

function shouldSkipNodeModulesEntry(rel) {
  if (!rel) return false
  const norm = rel.split(path.sep).join('/')
  if (norm === 'nodemon' || norm.startsWith('nodemon/')) return true
  // Accidental `file:..` link to the repo root — Windows cannot recreate this symlink.
  if (norm === 'fluxone' || norm.startsWith('fluxone/')) return true
  if (norm.includes('/.cache/') || norm.startsWith('.cache/') || norm === '.cache') {
    return true
  }
  return false
}

function isAncestorSymlink(src, srcNm) {
  try {
    const st = fs.lstatSync(src)
    if (!st.isSymbolicLink()) return false
    const real = fs.realpathSync(src)
    const serverRoot = path.resolve(srcNm, '..')
    const repoRoot = path.resolve(serverRoot, '..')
    const resolved = path.resolve(real)
    return resolved === path.resolve(repoRoot) || resolved === path.resolve(serverRoot)
  } catch {
    return true
  }
}

function copyProductionNodeModules(srcNm, destNm) {
  fs.rmSync(destNm, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(destNm), { recursive: true })
  fs.cpSync(srcNm, destNm, {
    recursive: true,
    filter: (src) => {
      const rel = path.relative(srcNm, src)
      if (shouldSkipNodeModulesEntry(rel)) return false
      if (isAncestorSymlink(src, srcNm)) return false
      return true
    },
  })
}

exports.default = async function afterPack(context) {
  const projectDir = context.packager.projectDir
  const serverRoot = path.resolve(projectDir, '..', 'server')
  const srcNm = path.join(serverRoot, 'node_modules')
  const betterSqlite = path.join(srcNm, 'better-sqlite3')
  const destServer = path.join(context.appOutDir, 'resources', 'server')
  const destNm = path.join(destServer, 'node_modules')

  if (!fs.existsSync(path.join(destServer, 'index.js'))) {
    throw new Error(
      `afterPack: packaged server missing at ${destServer}. Check extraResources.`,
    )
  }
  if (!fs.existsSync(betterSqlite)) {
    throw new Error(
      'afterPack: server/node_modules/better-sqlite3 missing. Run: cd server && npm install',
    )
  }

  console.log('[afterPack] copying server node_modules → resources/server/node_modules')
  copyProductionNodeModules(srcNm, destNm)

  if (!fs.existsSync(path.join(destNm, 'better-sqlite3'))) {
    throw new Error('afterPack: better-sqlite3 was not copied into the package')
  }
  if (!fs.existsSync(path.join(destNm, 'express'))) {
    throw new Error('afterPack: express was not copied into the package')
  }

  copySqliteSnapshot(projectDir, destServer)

  console.log('[afterPack] server dependencies ready')
}

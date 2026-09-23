const { spawn } = require('node:child_process')
const fs = require('node:fs')
const http = require('node:http')
const path = require('node:path')
const { app } = require('electron')
const {
  serverRoot,
  clientDistPath,
  sqlitePath,
  apiPort,
  healthUrl,
  bundledNodePath,
} = require('../utils/paths')

let child = null
let reusedExisting = false

function waitForHealth(url, { timeoutMs = 45000, intervalMs = 250 } = {}) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume()
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve()
          return
        }
        retry()
      })
      req.on('error', retry)
      req.setTimeout(2000, () => {
        req.destroy()
        retry()
      })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`API health check timed out: ${url}`))
        return
      }
      setTimeout(tick, intervalMs)
    }
    tick()
  })
}

function probeHealthOnce(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(Boolean(res.statusCode && res.statusCode < 500))
    })
    req.on('error', () => resolve(false))
    req.setTimeout(800, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function resolveNodeBinary() {
  const bundled = bundledNodePath()
  if (bundled && fs.existsSync(bundled)) {
    return bundled
  }
  return process.platform === 'win32' ? 'node.exe' : 'node'
}

/**
 * Start Express as a child Node process.
 * Packaged builds always spawn (never reuse a foreign process on :3000).
 * Dev may reuse an already-running FluxOne API.
 */
async function startServer() {
  const port = apiPort()
  const url = healthUrl()

  if (!app.isPackaged && (await probeHealthOnce(url))) {
    reusedExisting = true
    console.log(`[api] reusing existing server on port ${port}`)
    return null
  }

  if (child) return child

  reusedExisting = false
  const dbPath = sqlitePath()
  const root = serverRoot()
  const dist = clientDistPath()
  const entry = path.join(root, 'index.js')
  const nodeBin = resolveNodeBinary()

  if (!fs.existsSync(entry)) {
    throw new Error(`Server entry not found: ${entry}`)
  }
  if (!dist || !fs.existsSync(path.join(dist, 'index.html'))) {
    if (app.isPackaged) {
      throw new Error(
        `Client UI build not found at ${dist || '(empty)'}. Run: cd client && npm run build`,
      )
    }
    console.warn(
      '[api] no client/dist yet — start Vite for live UI: cd client && npm run dev',
    )
  }

  const env = {
    ...process.env,
    PORT: String(port),
    SQLITE_PATH: dbPath,
    NODE_ENV: app.isPackaged ? 'production' : process.env.NODE_ENV || 'development',
    FLUXONE_DESKTOP: '1',
    FLUXONE_AUTO_SEED: '0',
    CLIENT_DIST_PATH: dist || '',
    JWT_SECRET:
      process.env.JWT_SECRET ||
      (app.isPackaged ? 'fluxone-desktop-local-jwt' : 'dev-only-change-me'),
    CORS_ORIGINS: [
      `http://127.0.0.1:${port}`,
      `http://localhost:${port}`,
      'http://127.0.0.1:5173',
      'http://localhost:5173',
    ].join(','),
  }

  console.log(`[api] spawning ${nodeBin}`)
  console.log(`[api] entry ${entry}`)
  console.log(`[api] ui dist ${dist}`)

  child = spawn(nodeBin, [entry], {
    cwd: root,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  let spawnError = null
  child.stdout.on('data', (buf) => {
    console.log(`[api] ${String(buf).trimEnd()}`)
  })
  child.stderr.on('data', (buf) => {
    const text = String(buf).trimEnd()
    console.error(`[api] ${text}`)
    if (/EADDRINUSE|address already in use/i.test(text)) {
      spawnError = new Error(
        `Port ${port} is already in use. Close the other FluxOne/server process and try again.`,
      )
    }
  })
  child.on('exit', (code, signal) => {
    console.log(`[api] exited code=${code} signal=${signal}`)
    child = null
  })
  child.on('error', (err) => {
    spawnError = err
    console.error('[api] failed to start', err.message)
  })

  try {
    await waitForHealth(url)
  } catch (err) {
    if (spawnError) throw spawnError
    throw err
  }

  if (!child && !(await probeHealthOnce(url))) {
    throw new Error('API process exited before becoming ready')
  }

  console.log(`[api] ready on port ${port} · db ${dbPath}`)
  return child
}

function stopServer() {
  if (reusedExisting || !child || child.killed) {
    child = null
    return Promise.resolve()
  }
  const proc = child
  child = null
  return new Promise((resolve) => {
    const done = () => resolve()
    proc.once('exit', done)
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(proc.pid), '/f', '/t'], {
          windowsHide: true,
          stdio: 'ignore',
        })
      } else {
        proc.kill('SIGTERM')
      }
    } catch {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* ignore */
      }
    }
    setTimeout(done, 4000)
  })
}

module.exports = { startServer, stopServer }

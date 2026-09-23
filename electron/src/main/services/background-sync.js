const { net } = require('electron')
const { getMainWindow } = require('./window')

const DEBOUNCE_MS = 5000
const ONLINE_POLL_MS = 3000
const INTERVAL_MS = Number(process.env.FLUXONE_SYNC_INTERVAL_MS || 15 * 60 * 1000)

let debounceTimer = null
let pollTimer = null
let intervalTimer = null
let wasOnline = net.isOnline()
let started = false

function triggerBackgroundSync(reason) {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  console.log(`[fluxone] background sync → renderer (${reason})`)
  win.webContents.send('desktop:background-sync', { reason, at: Date.now() })
}

function scheduleDebouncedSync(reason) {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (net.isOnline()) triggerBackgroundSync(reason)
  }, DEBOUNCE_MS)
}

function startBackgroundSync() {
  if (started) return
  started = true

  if (net.isOnline()) {
    scheduleDebouncedSync('startup')
  }

  pollTimer = setInterval(() => {
    const online = net.isOnline()
    if (online && !wasOnline) {
      scheduleDebouncedSync('online')
    }
    wasOnline = online
  }, ONLINE_POLL_MS)

  if (INTERVAL_MS > 0) {
    intervalTimer = setInterval(() => {
      if (net.isOnline()) triggerBackgroundSync('interval')
    }, INTERVAL_MS)
  }

  console.log(
    `[fluxone] background sync armed · debounce=${DEBOUNCE_MS}ms · interval=${INTERVAL_MS}ms`,
  )
}

function stopBackgroundSync() {
  clearTimeout(debounceTimer)
  clearInterval(pollTimer)
  clearInterval(intervalTimer)
  debounceTimer = null
  pollTimer = null
  intervalTimer = null
  started = false
}

module.exports = { startBackgroundSync, stopBackgroundSync, triggerBackgroundSync }

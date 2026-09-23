const { app, dialog } = require('electron')
const { enforceSingleInstance } = require('./main/utils/single-instance')
const { startServer, stopServer } = require('./main/services/server-bootstrap')
const { createMainWindow } = require('./main/services/window')
const { startBackgroundSync, stopBackgroundSync } = require('./main/services/background-sync')
const { registerPrintIpc } = require('./print/print')
const { registerQuitGuard } = require('./main/ipc/quit-guard')
const { sqlitePath, bundledSqlitePath, apiPort } = require('./main/utils/paths')

if (!enforceSingleInstance()) {
  // second instance — quit already requested
}

registerPrintIpc()
registerQuitGuard()

app.whenReady().then(async () => {
  try {
    console.log(`[fluxone] packaged=${app.isPackaged}`)
    if (app.isPackaged) {
      console.log(`[fluxone] bundled snapshot → ${bundledSqlitePath()}`)
    }
    console.log(`[fluxone] db → ${sqlitePath()}`)
    console.log(`[fluxone] API port → ${apiPort()}`)
    await startServer()
    await createMainWindow()
    startBackgroundSync()
  } catch (err) {
    console.error('[fluxone] startup failed', err)
    stopBackgroundSync()
    dialog.showErrorBox(
      'POS Cashier failed to start',
      `${err.message}\n\nPort ${apiPort()} must be free. Packaged builds include Node + Express + SQLite under this app.`,
    )
    await stopServer()
    app.exit(1)
  }

  app.on('activate', () => {
    const { BrowserWindow } = require('electron')
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  stopBackgroundSync()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

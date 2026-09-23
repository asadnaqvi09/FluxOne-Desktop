const { app, dialog, ipcMain } = require('electron')
const { getMainWindow } = require('../services/window')
const { stopServer } = require('../services/server-bootstrap')

let cashDrawerOpen = false
let allowingQuit = false

function registerQuitGuard() {
  ipcMain.on('desktop:set-cash-drawer-open', (_event, open) => {
    cashDrawerOpen = Boolean(open)
  })

  app.on('before-quit', async (event) => {
    if (allowingQuit) return
    event.preventDefault()

    const win = getMainWindow()
    if (cashDrawerOpen) {
      const result = await dialog.showMessageBox(win || undefined, {
        type: 'warning',
        buttons: ['Stay open', 'Quit anyway'],
        defaultId: 0,
        cancelId: 0,
        title: 'Cash drawer still open',
        message: 'Close the cash drawer before ending the shift.',
        detail:
          'Tech Lead rule: do not quit mid-shift silently. Prefer Close Cash Drawer (count cash), then quit. Quitting now may leave the drawer open in the local database.',
      })
      if (result.response !== 1) return
    }

    allowingQuit = true
    await stopServer()
    app.exit(0)
  })
}

module.exports = { registerQuitGuard }

const { ipcMain } = require('electron')
const { getMainWindow } = require('../main/services/window')

function registerPrintIpc() {
  ipcMain.handle('desktop:print', async () => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) {
      return { success: false, error: 'No window' }
    }
    return new Promise((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, (success, failureReason) => {
        if (!success) {
          resolve({ success: false, error: failureReason || 'Print cancelled' })
          return
        }
        resolve({ success: true })
      })
    })
  })
}

module.exports = { registerPrintIpc }

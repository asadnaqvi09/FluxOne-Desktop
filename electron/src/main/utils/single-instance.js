const { app } = require('electron')
const { getMainWindow } = require('../services/window')

/** Ensure only one POS window per machine. */
function enforceSingleInstance() {
  const gotLock = app.requestSingleInstanceLock()
  if (!gotLock) {
    app.quit()
    return false
  }

  app.on('second-instance', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    win.focus()
  })

  return true
}

module.exports = { enforceSingleInstance }

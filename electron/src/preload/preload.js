const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('fluxDesktop', {
  isDesktop: true,
  getVersion: () => process.env.npm_package_version || '1.0.0',
  print: () => ipcRenderer.invoke('desktop:print'),
  setCashDrawerOpen: (open) => {
    ipcRenderer.send('desktop:set-cash-drawer-open', Boolean(open))
  },
  onBackgroundSync: (handler) => {
    if (typeof handler !== 'function') return () => {}
    const listener = (_event, payload) => handler(payload)
    ipcRenderer.on('desktop:background-sync', listener)
    return () => ipcRenderer.removeListener('desktop:background-sync', listener)
  },
})

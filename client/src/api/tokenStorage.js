const TOKEN_KEY = 'fluxone_auth_token'

// In-memory copy — not readable from other tabs; cleared on process exit
let memoryToken = null

function readSession() {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeSession(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token)
    else sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Private mode / quota
  }
}

// Remove legacy localStorage JWT (long-lived XSS target)
function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // ignore
  }
}

clearLegacyLocalStorage()

export function getToken() {
  if (memoryToken) return memoryToken
  const fromSession = readSession()
  if (fromSession) {
    memoryToken = fromSession
    return fromSession
  }
  return null
}

// sessionStorage + memory only — never localStorage
export function setToken(token) {
  memoryToken = token || null
  writeSession(token || null)
  clearLegacyLocalStorage()
}

export function clearToken() {
  memoryToken = null
  writeSession(null)
  clearLegacyLocalStorage()
}

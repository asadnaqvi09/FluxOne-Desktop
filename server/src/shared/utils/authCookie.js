import config from '../../config/index.js';

export const AUTH_COOKIE_NAME = 'fluxone_token';

// Cookie flags for HttpOnly session (XSS cannot read the token)
function cookieOptions(maxAgeMs) {
  // Secure only when explicitly enabled (local Electron POS is usually http://)
  const secure = config.cookieSecure === true;
  return {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

// Attach JWT on login / session refresh
export function setAuthCookie(res, token, expiresAt) {
  const ms = Math.max(Date.parse(String(expiresAt).replace(' ', 'T') + 'Z') - Date.now(), 1000);
  res.cookie(AUTH_COOKIE_NAME, token, cookieOptions(ms));
}

// Clear on logout / 401 cleanup
export function clearAuthCookie(res) {
  const secure = config.cookieSecure === true;
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

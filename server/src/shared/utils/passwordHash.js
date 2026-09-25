/** Cloud / local bcrypt hashes look like $2a$… / $2b$… / $2y$… (never plaintext). */
const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$.{53}$/;

export function isBcryptPasswordHash(value) {
  return typeof value === 'string' && BCRYPT_HASH_RE.test(value);
}

/**
 * Prefer passwordHash / password_hash; `password` is the same bcrypt alias from cloud.
 * Plaintext or empty values are ignored (null).
 */
export function resolveCloudPasswordHash(user = {}) {
  const candidates = [user.passwordHash, user.password_hash, user.password];
  for (const candidate of candidates) {
    if (isBcryptPasswordHash(candidate)) return candidate;
  }
  return null;
}

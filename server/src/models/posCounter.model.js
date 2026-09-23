import { connectDb } from '../config/database.js';

const COUNTER_FIELDS = `
  id,
  code,
  name,
  is_active AS isActive
`;

export function getCounterById(id) {
  if (!id) return null;
  const db = connectDb();
  return (
    db.prepare(`SELECT ${COUNTER_FIELDS} FROM pos_counters WHERE id = ?`).get(id) ||
    null
  );
}

export function getDefaultCounter() {
  const db = connectDb();
  return (
    db
      .prepare(
        `
      SELECT ${COUNTER_FIELDS}
      FROM pos_counters
      WHERE is_active = 1
      ORDER BY code ASC
      LIMIT 1
    `
      )
      .get() || null
  );
}

/** First active counter, or lookup by invoice counter_id when set. */
export function resolveCounterForSync(counterId = null) {
  if (counterId) return getCounterById(counterId);
  return getDefaultCounter();
}

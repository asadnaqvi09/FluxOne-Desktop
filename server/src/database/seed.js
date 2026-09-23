/**
 * Schema-only setup. Users, catalog, and store profile come from
 * FluxOne Inventory cloud bootstrap / sync — not local demo seed.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeDb } from '../config/database.js';
import { migrate } from './migrate.js';

const __filename = fileURLToPath(import.meta.url);
const isMain = path.resolve(process.argv[1] || '') === __filename;

export function seed() {
  migrate();
  console.log(
    'Schema ready. No local demo users/catalog — complete Setup → cloud bootstrap, then sign in with Inventory login IDs.',
  );
}

if (isMain) {
  try {
    seed();
  } catch (error) {
    console.error('Setup failed:', error.message);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

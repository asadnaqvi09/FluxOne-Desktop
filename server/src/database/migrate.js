import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDb, closeDb } from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isMain = path.resolve(process.argv[1] || '') === __filename;
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

function ensureMigrationsTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

function listMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
}

export function migrate() {
  const db = connectDb();
  ensureMigrationsTable(db);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id)
  );
  const files = listMigrationFiles();
  const insert = db.prepare(
    'INSERT INTO schema_migrations (id) VALUES (?)'
  );
  const applyOne = db.transaction((fileName, sql) => {
    db.exec(sql);
    insert.run(fileName);
  });
  let count = 0;
  for (const fileName of files) {
    if (applied.has(fileName)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8');
    applyOne(fileName, sql);
    count += 1;
    console.log(`Applied ${fileName}`);
  }
  if (count === 0) {
    console.log('No new migrations.');
  } else {
    console.log(`Applied ${count} migration(s).`);
  }
}

if (isMain) {
  try {
    migrate();
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    closeDb();
  }
}

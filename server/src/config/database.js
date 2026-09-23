import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import config from './index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db = null;

export function connectDb() {
  if (db) return db;
  const dbPath = path.isAbsolute(config.sqlitePath)
    ? config.sqlitePath
    : path.join(__dirname, '../..', config.sqlitePath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  return db;
}

export function closeDb() {
  if (db) db.close(), db = null;
}
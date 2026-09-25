import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

// Everything the admin panel writes lives here: the database, CVs, and uploaded posters.
// Keep this directory on persistent storage and include it in backups.
export const dataDir = path.resolve(process.env.DATA_DIR || 'storage');
export const uploadsDir = path.join(dataDir, 'uploads');
export const mediaDir = path.join(dataDir, 'media');

const shared = globalThis as typeof globalThis & {udayanDatabase?: DatabaseSync};

export function database() {
  if (shared.udayanDatabase) return shared.udayanDatabase;
  fs.mkdirSync(uploadsDir, {recursive: true});
  fs.mkdirSync(mediaDir, {recursive: true});
  const db = new DatabaseSync(path.join(dataDir, 'udayan.db'));
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      cinema TEXT NOT NULL DEFAULT '',
      data TEXT NOT NULL,
      attachment TEXT,
      email_status TEXT NOT NULL DEFAULT 'pending',
      email_error TEXT NOT NULL DEFAULT '',
      note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS submissions_created ON submissions (created_at DESC);
    CREATE INDEX IF NOT EXISTS submissions_type_status ON submissions (type, status);
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE COLLATE NOCASE,
      role TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      session_version INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );
    CREATE TABLE IF NOT EXISTS activity (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      user_name TEXT NOT NULL,
      action TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS activity_created ON activity (created_at DESC);
  `);
  // Columns added after the first release.
  const columns = (db.prepare('PRAGMA table_info(submissions)').all() as {name: string}[]).map(column => column.name);
  if (!columns.includes('reply_status')) db.exec("ALTER TABLE submissions ADD COLUMN reply_status TEXT NOT NULL DEFAULT ''");
  shared.udayanDatabase = db;
  return db;
}

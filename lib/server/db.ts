import fs from 'node:fs/promises';
import path from 'node:path';

// Production (Netlify or Vercel): Neon Postgres over HTTP, from DATABASE_URL (or the variable set by the
// Netlify or Vercel Neon integration).
// Local development and tests: PGlite, a real Postgres engine embedded in Node, stored in storage/pglite.
type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;

const connectionString = () => process.env.DATABASE_URL || process.env.NETLIFY_DATABASE_URL || process.env.POSTGRES_URL || '';
export const usingNeon = () => Boolean(connectionString());

const schema = [
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY, type TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
    name TEXT NOT NULL DEFAULT '', phone TEXT NOT NULL DEFAULT '', email TEXT NOT NULL DEFAULT '', cinema TEXT NOT NULL DEFAULT '',
    data JSONB NOT NULL, attachment JSONB, email_status TEXT NOT NULL DEFAULT 'pending', email_error TEXT NOT NULL DEFAULT '',
    reply_status TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS submissions_created ON submissions (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS submissions_type_status ON submissions (type, status)`,
  // CVs (private) and uploaded photos (public). Base64 text keeps both drivers byte-for-byte identical.
  `CREATE TABLE IF NOT EXISTS files (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL,
    data TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL, password_hash TEXT NOT NULL,
    session_version INTEGER NOT NULL DEFAULT 1, active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(), last_login_at TIMESTAMPTZ)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email ON users (lower(email))`,
  `CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, user_name TEXT NOT NULL, action TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS activity_created ON activity (created_at DESC)`,
  // Rate limits must be shared across serverless instances, so they live here too.
  `CREATE TABLE IF NOT EXISTS attempts (key TEXT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE INDEX IF NOT EXISTS attempts_key_at ON attempts (key, at)`,
];

const shared = globalThis as typeof globalThis & {udayanQuery?: Promise<Query>};

async function connect(): Promise<Query> {
  let run: Query;
  if (usingNeon()) {
    const {neon} = await import('@neondatabase/serverless');
    const sql = neon(connectionString());
    run = async (text, params = []) => await sql.query(text, params) as never;
  } else {
    // Serverless hosts have no lasting disk, so the embedded database must never run there.
    if (process.env.NETLIFY || process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error('DATABASE_URL is not set. Add your Neon connection string to the site’s environment variables, then redeploy.');
    const {PGlite} = await import('@electric-sql/pglite');
    const directory = path.resolve(process.env.DATA_DIR || 'storage', 'pglite');
    // storage/ is not in Git, so a fresh clone has to create it.
    await fs.mkdir(path.dirname(directory), {recursive: true});
    const db = await PGlite.create(directory);
    run = async (text, params = []) => (await db.query(text, params)).rows as never;
  }
  for (const statement of schema) await run(statement);
  return run;
}

/** Runs one parameterised statement ($1, $2, …) and returns its rows. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  shared.udayanQuery ??= connect().catch(error => {shared.udayanQuery = undefined; throw error;});
  return (await shared.udayanQuery)<T>(text, params);
}

export const iso = (value: unknown) => value ? new Date(value as string).toISOString() : null;

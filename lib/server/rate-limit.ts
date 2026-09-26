import {headers} from 'next/headers';
import {query} from './db';

async function recent(key: string, windowMs: number) {
  const [{count}] = await query<{count: number}>('SELECT COUNT(*)::int AS count FROM attempts WHERE key = $1 AND at > $2', [key, new Date(Date.now() - windowMs).toISOString()]);
  return count;
}
/** For sign-in: only failures count, so staff who sign in often are never locked out. */
export const tooManyFailures = async (key: string, limit: number, windowMs: number) => await recent(key, windowMs) >= limit;
export async function recordFailure(key: string) {await query('INSERT INTO attempts (key) VALUES ($1)', [key]);}

/** Counts recent attempts in the database, so the limit holds across serverless instances. */
export async function allow(key: string, limit: number, windowMs: number) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const [{count}] = await query<{count: number}>('SELECT COUNT(*)::int AS count FROM attempts WHERE key = $1 AND at > $2', [key, since]);
  if (count >= limit) return false;
  await query('INSERT INTO attempts (key) VALUES ($1)', [key]);
  // Occasionally clear anything older than a day.
  if (Math.random() < 0.02) await query("DELETE FROM attempts WHERE at < now() - interval '1 day'");
  return true;
}

export async function clientAddress() {
  const list = await headers();
  return list.get('x-forwarded-for')?.split(',')[0].trim() || list.get('x-real-ip') || 'local';
}

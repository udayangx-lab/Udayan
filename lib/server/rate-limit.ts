import {headers} from 'next/headers';

const hits = new Map<string, number[]>();

/** A small in-memory limiter. It resets on restart, which is acceptable for a single server. */
export function allow(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter(time => now - time < windowMs);
  if (recent.length >= limit) {hits.set(key, recent); return false;}
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [entry, times] of hits) if (!times.some(time => now - time < windowMs)) hits.delete(entry);
  return true;
}

export async function clientAddress() {
  const list = await headers();
  return list.get('x-forwarded-for')?.split(',')[0].trim() || list.get('x-real-ip') || 'local';
}

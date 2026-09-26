import {iso, query} from './db';

export type Activity = {id: number; userId: number; userName: string; action: string; createdAt: string};

export async function logActivity(admin: {id: number; name: string}, action: string) {
  await query('INSERT INTO activity (user_id, user_name, action) VALUES ($1, $2, $3)', [admin.id, admin.name, action.slice(0, 300)]);
}
export async function listActivity(limit = 200) {
  const rows = await query<{id: number; user_id: number; user_name: string; action: string; created_at: unknown}>('SELECT * FROM activity ORDER BY id DESC LIMIT $1', [limit]);
  return rows.map((row): Activity => ({id: Number(row.id), userId: Number(row.user_id), userName: row.user_name, action: row.action, createdAt: iso(row.created_at)!}));
}

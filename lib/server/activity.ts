import {database} from './db';

export type Activity = {id: number; userId: number; userName: string; action: string; createdAt: string};

export function logActivity(admin: {id: number; name: string}, action: string) {
  database().prepare('INSERT INTO activity (user_id, user_name, action, created_at) VALUES (?, ?, ?, ?)').run(admin.id, admin.name, action.slice(0, 300), new Date().toISOString());
}
export function listActivity(limit = 200) {
  return (database().prepare('SELECT id, user_id AS userId, user_name AS userName, action, created_at AS createdAt FROM activity ORDER BY id DESC LIMIT ?').all(limit) as Activity[]);
}

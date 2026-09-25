import {database} from './db';
import {hashPassword} from './passwords';

export const roles = ['owner', 'editor', 'staff'] as const;
export type Role = typeof roles[number];
export const roleLabels: Record<Role, string> = {owner: 'Owner', editor: 'Editor', staff: 'Front desk'};
export const roleDescriptions: Record<Role, string> = {
  owner: 'Everything, including staff accounts, email settings, activity, and backups.',
  editor: 'Website content, cinemas, now showing, and all submissions.',
  staff: 'Read and respond to submissions: status, notes, email, and export.',
};
export const isRole = (value: unknown): value is Role => roles.includes(value as Role);

export type User = {id: number; name: string; email: string; role: Role; passwordHash: string; sessionVersion: number; active: boolean; createdAt: string; lastLoginAt: string | null};
type Row = {id: number; name: string; email: string; role: string; password_hash: string; session_version: number; active: number; created_at: string; last_login_at: string | null};
const parse = (row: Row): User => ({id: row.id, name: row.name, email: row.email, role: isRole(row.role) ? row.role : 'staff', passwordHash: row.password_hash,
  sessionVersion: row.session_version, active: Boolean(row.active), createdAt: row.created_at, lastLoginAt: row.last_login_at});

export function listUsers() {return (database().prepare('SELECT * FROM users ORDER BY active DESC, name COLLATE NOCASE').all() as Row[]).map(parse);}
export function getUser(id: number) {const row = database().prepare('SELECT * FROM users WHERE id = ?').get(id) as Row | undefined; return row ? parse(row) : null;}
export function findUserByEmail(email: string) {const row = database().prepare('SELECT * FROM users WHERE email = ?').get(email.trim()) as Row | undefined; return row ? parse(row) : null;}
export function activeOwnerCount() {return (database().prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'owner' AND active = 1").get() as {count: number}).count;}

export function createUser(user: {name: string; email: string; role: Role; password: string}) {
  const result = database().prepare('INSERT INTO users (name, email, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(user.name, user.email.toLowerCase(), user.role, hashPassword(user.password), new Date().toISOString());
  return getUser(Number(result.lastInsertRowid))!;
}
/** Any change to access (role, status, password) bumps the session version, signing that user out everywhere. */
export function updateUser(id: number, changes: {name?: string; role?: Role; active?: boolean; password?: string}) {
  const columns: string[] = [];
  const params: (string | number)[] = [];
  if (changes.name !== undefined) {columns.push('name = ?'); params.push(changes.name);}
  if (changes.role) {columns.push('role = ?'); params.push(changes.role);}
  if (changes.active !== undefined) {columns.push('active = ?'); params.push(changes.active ? 1 : 0);}
  if (changes.password) {columns.push('password_hash = ?'); params.push(hashPassword(changes.password));}
  if (changes.role || changes.active !== undefined || changes.password) columns.push('session_version = session_version + 1');
  if (columns.length) database().prepare(`UPDATE users SET ${columns.join(', ')} WHERE id = ?`).run(...params, id);
}
export function recordLogin(id: number) {database().prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), id);}
export function deleteUser(id: number) {database().prepare('DELETE FROM users WHERE id = ?').run(id);}

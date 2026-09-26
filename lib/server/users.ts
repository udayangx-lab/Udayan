import {iso, query} from './db';
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
type Row = {id: number; name: string; email: string; role: string; password_hash: string; session_version: number; active: boolean; created_at: unknown; last_login_at: unknown};
const parse = (row: Row): User => ({id: Number(row.id), name: row.name, email: row.email, role: isRole(row.role) ? row.role : 'staff', passwordHash: row.password_hash,
  sessionVersion: Number(row.session_version), active: Boolean(row.active), createdAt: iso(row.created_at)!, lastLoginAt: iso(row.last_login_at)});

export async function listUsers() {return (await query<Row>('SELECT * FROM users ORDER BY active DESC, lower(name)')).map(parse);}
export async function getUser(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await query<Row>('SELECT * FROM users WHERE id = $1', [id]);
  return row ? parse(row) : null;
}
export async function findUserByEmail(email: string) {
  const [row] = await query<Row>('SELECT * FROM users WHERE lower(email) = lower($1)', [email.trim()]);
  return row ? parse(row) : null;
}
export async function activeOwnerCount() {
  const [{count}] = await query<{count: number}>("SELECT COUNT(*)::int AS count FROM users WHERE role = 'owner' AND active");
  return count;
}

export async function createUser(user: {name: string; email: string; role: Role; password: string}) {
  const [row] = await query<Row>('INSERT INTO users (name, email, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING *',
    [user.name, user.email.toLowerCase(), user.role, hashPassword(user.password)]);
  return parse(row);
}
/** Any change to access (role, status, password) bumps the session version, signing that user out everywhere. */
export async function updateUser(id: number, changes: {name?: string; role?: Role; active?: boolean; password?: string}) {
  const columns: string[] = [];
  const params: unknown[] = [];
  const set = (column: string, value: unknown) => {params.push(value); columns.push(`${column} = $${params.length}`);};
  if (changes.name !== undefined) set('name', changes.name);
  if (changes.role) set('role', changes.role);
  if (changes.active !== undefined) set('active', changes.active);
  if (changes.password) set('password_hash', hashPassword(changes.password));
  if (changes.role || changes.active !== undefined || changes.password) columns.push('session_version = session_version + 1');
  if (!columns.length) return;
  params.push(id);
  await query(`UPDATE users SET ${columns.join(', ')} WHERE id = $${params.length}`, params);
}
export async function recordLogin(id: number) {await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);}
export async function deleteUser(id: number) {await query('DELETE FROM users WHERE id = $1', [id]);}

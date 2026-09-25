import {createHash, createHmac, randomBytes, timingSafeEqual} from 'node:crypto';
import {cache} from 'react';
import {cookies, headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {findUserByEmail, getUser, recordLogin, type Role} from './users';
import {verifyPassword} from './passwords';
import {readSetting, writeSetting} from './content';

export const sessionCookie = 'udayan_admin';
const lifetime = 12 * 60 * 60;
/** The server-password account. It always exists as an owner, so access can never be lost. */
export const serverOwnerLogin = 'admin';

export type Permission = 'submissions' | 'submissions.delete' | 'content' | 'settings';
const grants: Record<Role, Permission[]> = {
  owner: ['submissions', 'submissions.delete', 'content', 'settings'],
  editor: ['submissions', 'submissions.delete', 'content'],
  staff: ['submissions'],
};
export type Admin = {id: number; name: string; email: string; role: Role};
export const can = (admin: Admin, permission: Permission) => grants[admin.role].includes(permission);

export const adminConfigured = () => (process.env.ADMIN_PASSWORD?.length ?? 0) >= 8;

// ADMIN_SESSION_SECRET if set, otherwise a random key generated once and kept in the database.
function secret() {
  const explicit = process.env.ADMIN_SESSION_SECRET;
  if (explicit && explicit.length >= 32) return explicit;
  let stored = readSetting<string>('session-secret');
  if (!stored) {stored = randomBytes(32).toString('base64url'); writeSetting('session-secret', stored);}
  return stored;
}
const sign = (value: string) => createHmac('sha256', secret()).update(value).digest('base64url');
const digest = (value: string) => createHash('sha256').update(value).digest();
// The server owner's session is bound to the current ADMIN_PASSWORD; changing it signs them out.
const serverVersion = () => 'p' + createHash('sha256').update('udayan-owner:' + process.env.ADMIN_PASSWORD).digest('base64url').slice(0, 12);
const serverOwner: Admin = {id: 0, name: 'Owner (server password)', email: serverOwnerLogin, role: 'owner'};

/** Checks credentials. Staff sign in with their email; the server owner signs in as “admin”. */
export function authenticate(login: string, password: string): Admin | null {
  const identifier = login.trim().toLowerCase();
  if (identifier === serverOwnerLogin) return adminConfigured() && timingSafeEqual(digest(password), digest(process.env.ADMIN_PASSWORD!)) ? serverOwner : null;
  const user = findUserByEmail(identifier);
  // Hash anyway for unknown users so response time does not reveal which emails exist.
  const valid = verifyPassword(password, user?.passwordHash || 'scrypt$16384$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  if (!user || !user.active || !valid) return null;
  recordLogin(user.id);
  return {id: user.id, name: user.name, email: user.email, role: user.role};
}

export async function startSession(admin: Admin) {
  const version = admin.id === 0 ? serverVersion() : getUser(admin.id)!.sessionVersion;
  const payload = `${admin.id}.${version}.${Date.now() + lifetime * 1000}`;
  const list = await headers();
  const host = list.get('host') || '';
  const secure = list.get('x-forwarded-proto') === 'https' || (process.env.NODE_ENV === 'production' && !/^(localhost|127\.0\.0\.1)(:|$)/.test(host));
  (await cookies()).set(sessionCookie, `${payload}.${sign(payload)}`, {httpOnly: true, sameSite: 'lax', secure, path: '/', maxAge: lifetime});
}

export async function endSession() {(await cookies()).delete(sessionCookie);}

/** The signed-in admin for this request, or null. Deactivated users and changed passwords end sessions immediately. */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const parts = ((await cookies()).get(sessionCookie)?.value || '').split('.');
  if (parts.length !== 4) return null;
  const [id, version, expires, signature] = parts;
  const expected = Buffer.from(sign(`${id}.${version}.${expires}`));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received) || Number(expires) < Date.now()) return null;
  if (id === '0') return adminConfigured() && version === serverVersion() ? serverOwner : null;
  const user = getUser(Number(id));
  if (!user || !user.active || String(user.sessionVersion) !== version) return null;
  return {id: user.id, name: user.name, email: user.email, role: user.role};
});

/** Call at the start of every admin page and action. Signed-out visitors go to login; others need the permission. */
export async function requireAdmin(permission?: Permission): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect('/admin/login');
  if (permission && !can(admin, permission)) redirect('/admin?error=' + encodeURIComponent('Your account does not have access to that section. Ask an owner if you need it.'));
  return admin;
}

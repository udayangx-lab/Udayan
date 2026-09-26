'use server';

import {endSession, requireAdmin} from '@/lib/server/auth';
import {activeOwnerCount, createUser, deleteUser, findUserByEmail, getUser, isRole, roleLabels, updateUser} from '@/lib/server/users';
import {passwordProblem, verifyPassword} from '@/lib/server/passwords';
import {logActivity} from '@/lib/server/activity';
import {back, field, isEmail} from '@/lib/server/admin-helpers';
import {redirect} from 'next/navigation';

export async function addUser(formData: FormData) {
  const admin = await requireAdmin('settings');
  const name = field(formData, 'name', 80);
  const email = field(formData, 'email', 160).toLowerCase();
  const role = formData.get('role');
  const password = String(formData.get('password') ?? '');
  if (!name) back('/admin/users', {error: 'Enter a name.'});
  if (!isEmail(email)) back('/admin/users', {error: 'Enter a valid email address.'});
  if (!isRole(role)) back('/admin/users', {error: 'Choose a role.'});
  const problem = passwordProblem(password);
  if (problem) back('/admin/users', {error: `Password: ${problem}`});
  if (await findUserByEmail(email)) back('/admin/users', {error: 'An account with that email already exists.'});
  await createUser({name, email, role, password});
  await logActivity(admin, `Added ${name} (${email}) as ${roleLabels[role]}`);
  back('/admin/users', {notice: 'user-added'});
}

async function userFrom(formData: FormData) {
  const user = await getUser(Number(formData.get('id')));
  if (!user) back('/admin/users', {error: 'That account no longer exists.'});
  return user;
}
// There must always be an active owner account besides the server password.
async function keepsOwner(user: {role: string; active: boolean}, next: {role?: string; active?: boolean}) {
  const losesOwner = user.role === 'owner' && user.active && ((next.role && next.role !== 'owner') || next.active === false);
  return !losesOwner || await activeOwnerCount() > 1 || Boolean(process.env.ADMIN_PASSWORD);
}

export async function updateUserAccess(formData: FormData) {
  const admin = await requireAdmin('settings');
  const user = await userFrom(formData);
  const role = formData.get('role');
  const active = formData.get('active') === 'on';
  if (!isRole(role)) back('/admin/users', {error: 'Choose a role.'});
  if (user.id === admin.id && (role !== user.role || !active)) back('/admin/users', {error: 'You cannot change your own role or deactivate yourself.'});
  if (!await keepsOwner(user, {role, active})) back('/admin/users', {error: 'Keep at least one active owner.'});
  const name = field(formData, 'name', 80) || user.name;
  await updateUser(user.id, {name, ...(role !== user.role ? {role} : {}), ...(active !== user.active ? {active} : {})});
  await logActivity(admin, `Updated ${name}: ${roleLabels[role]}, ${active ? 'active' : 'deactivated'}`);
  back('/admin/users');
}

export async function resetUserPassword(formData: FormData) {
  const admin = await requireAdmin('settings');
  const user = await userFrom(formData);
  const password = String(formData.get('password') ?? '');
  const problem = passwordProblem(password);
  if (problem) back('/admin/users', {error: `${user.name}: ${problem}`});
  await updateUser(user.id, {password});
  await logActivity(admin, `Reset the password for ${user.name}`);
  back('/admin/users', {notice: 'password'});
}

export async function removeUser(formData: FormData) {
  const admin = await requireAdmin('settings');
  const user = await userFrom(formData);
  if (user.id === admin.id) back('/admin/users', {error: 'You cannot delete your own account.'});
  if (!await keepsOwner(user, {active: false})) back('/admin/users', {error: 'Keep at least one active owner.'});
  await deleteUser(user.id);
  await logActivity(admin, `Deleted the account for ${user.name} (${user.email})`);
  back('/admin/users', {notice: 'user-deleted'});
}

export async function changeOwnPassword(formData: FormData) {
  const admin = await requireAdmin();
  const user = await getUser(admin.id);
  if (!user) back('/admin/account', {error: 'The server owner password is set in the server environment (ADMIN_PASSWORD).'});
  if (!verifyPassword(String(formData.get('current') ?? ''), user.passwordHash)) back('/admin/account', {error: 'Your current password is not correct.'});
  const password = String(formData.get('password') ?? '');
  const problem = passwordProblem(password);
  if (problem) back('/admin/account', {error: problem});
  if (password !== formData.get('confirm')) back('/admin/account', {error: 'The new passwords do not match.'});
  await updateUser(user.id, {password});
  await logActivity(admin, 'Changed their password');
  // The version bump signed this browser out too; sign in again with the new password.
  await endSession();
  redirect('/admin/login?notice=password');
}

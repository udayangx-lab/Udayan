import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/server/auth';
import {listUsers, roleDescriptions, roleLabels, roles} from '@/lib/server/users';
import {minPasswordLength} from '@/lib/server/passwords';
import {formatDate} from '@/components/admin/submission-table';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {addUser, removeUser, resetUserPassword, updateUserAccess} from '../../users-actions';

export const metadata: Metadata = {title: 'Staff accounts'};

export default async function Users({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const admin = await requireAdmin('settings');
  const users = listUsers();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">SETTINGS</span><h1>Staff accounts</h1>
      <p className="admin-subtitle">Give each person their own sign-in. Everything they change is recorded under Activity.</p></div></header>
    <Notice searchParams={searchParams}/>
    <section className="admin-roles">{roles.map(role => <div key={role}><strong>{roleLabels[role]}</strong><span>{roleDescriptions[role]}</span></div>)}</section>
    <section className="admin-panel">
      <div className="admin-panel-head"><h2>{users.length} {users.length === 1 ? 'account' : 'accounts'}</h2></div>
      {!users.length && <p className="admin-empty">No staff accounts yet. You are signed in with the server owner password.</p>}
      <div className="admin-users">{users.map(user => <article key={user.id} className={user.active ? undefined : 'inactive'}>
        <form action={updateUserAccess} className="admin-user-access">
          <input type="hidden" name="id" value={user.id}/>
          <label>Name<input name="name" defaultValue={user.name} maxLength={80} required/></label>
          <label>Role<select name="role" defaultValue={user.role} disabled={user.id === admin.id}>{roles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>
            {user.id === admin.id && <input type="hidden" name="role" value={user.role}/>}</label>
          <label className="admin-check"><input type="checkbox" name="active" defaultChecked={user.active} disabled={user.id === admin.id}/>Active
            {user.id === admin.id && <input type="hidden" name="active" value="on"/>}</label>
          <SubmitButton className="admin-button small">Save</SubmitButton>
          <p className="admin-user-meta">{user.email} · {user.lastLoginAt ? `last signed in ${formatDate(user.lastLoginAt)}` : 'never signed in'}{user.id === admin.id ? ' · you' : ''}</p>
        </form>
        <div className="admin-user-tools">
          <form action={resetUserPassword}><input type="hidden" name="id" value={user.id}/>
            <input type="password" name="password" placeholder="New password" minLength={minPasswordLength} autoComplete="new-password" aria-label={`New password for ${user.name}`} required/>
            <SubmitButton className="admin-button small" pending="Saving…">Reset password</SubmitButton></form>
          {user.id !== admin.id && <form action={removeUser}><input type="hidden" name="id" value={user.id}/>
            <SubmitButton className="admin-button small danger" pending="Deleting…" confirm={`Delete the account for ${user.name}? Their activity history is kept.`}>Delete</SubmitButton></form>}
        </div>
      </article>)}</div>
    </section>
    <form action={addUser} className="admin-panel admin-form admin-grid-form">
      <h2 className="span">Add a staff account</h2>
      <label>Name<input name="name" required maxLength={80} autoComplete="off"/></label>
      <label>Email<input type="email" name="email" required autoComplete="off"/><small>They sign in with this address.</small></label>
      <label>Role<select name="role" defaultValue="staff">{roles.map(role => <option key={role} value={role}>{roleLabels[role]}</option>)}</select></label>
      <label>Temporary password<input type="password" name="password" required minLength={minPasswordLength} autoComplete="new-password"/>
        <small>At least {minPasswordLength} characters. Share it privately; they can change it under My account.</small></label>
      <div className="admin-actions span"><SubmitButton pending="Creating…">Create account</SubmitButton></div>
    </form>
  </>;
}

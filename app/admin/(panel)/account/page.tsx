import type {Metadata} from 'next';
import {requireAdmin} from '@/lib/server/auth';
import {roleDescriptions, roleLabels} from '@/lib/server/users';
import {minPasswordLength} from '@/lib/server/passwords';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {changeOwnPassword} from '../../users-actions';

export const metadata: Metadata = {title: 'My account'};

export default async function Account({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const admin = await requireAdmin();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">MY ACCOUNT</span><h1>{admin.name}</h1>
      <p className="admin-subtitle">{admin.id ? admin.email : 'Signed in with the server password'} · {roleLabels[admin.role]}: {roleDescriptions[admin.role]}</p></div></header>
    <Notice searchParams={searchParams}/>
    {admin.id === 0
      ? <div className="admin-callout warning"><div><strong>The server owner password is set on the server.</strong>
          <p>Change <code>ADMIN_PASSWORD</code> in the server environment and restart. For day-to-day work, create a personal owner account under Staff accounts.</p></div></div>
      : <form action={changeOwnPassword} className="admin-panel admin-form wide">
          <h2>Change password</h2>
          <label>Current password<input type="password" name="current" required autoComplete="current-password"/></label>
          <label>New password<input type="password" name="password" required minLength={minPasswordLength} autoComplete="new-password"/><small>At least {minPasswordLength} characters.</small></label>
          <label>Confirm new password<input type="password" name="confirm" required minLength={minPasswordLength} autoComplete="new-password"/></label>
          <div className="admin-actions"><SubmitButton>Change password</SubmitButton></div>
        </form>}
  </>;
}

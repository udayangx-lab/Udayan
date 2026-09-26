import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {adminConfigured, getAdmin} from '@/lib/server/auth';
import {listUsers} from '@/lib/server/users';
import LoginForm from '@/components/admin/login-form';

export const metadata: Metadata = {title: 'Sign in'};

export default async function LoginPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  if (await getAdmin()) redirect('/admin');
  const {notice} = await searchParams;
  const ready = adminConfigured() || (await listUsers()).some(user => user.active);
  return <main className="admin-login">
    <div className="admin-login-card">
      <img src="/images/udayancinema-logo.png" alt="" width="82" height="76"/>
      <span className="admin-eyebrow">UDAYAN CINEMA</span>
      <h1>Admin panel</h1>
      {notice === 'password' && <p className="admin-notice" role="status">Password changed. Sign in with your new password.</p>}
      {ready
        ? <LoginForm/>
        : <p className="admin-notice error">Admin access is not configured yet. Set <code>ADMIN_PASSWORD</code> (at least 8 characters) in the server environment, then restart and sign in as <strong>admin</strong>.</p>}
    </div>
  </main>;
}

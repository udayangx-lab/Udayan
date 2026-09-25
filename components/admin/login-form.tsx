'use client';

import {useActionState} from 'react';
import {login} from '@/app/admin/actions';

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, {});
  return <form action={action} className="admin-form">
    {state.error && <p className="admin-notice error" role="alert">{state.error}</p>}
    <label>Email<input name="login" autoComplete="username" required autoFocus/>
      <small>Staff use their email. The server owner signs in as “admin”.</small></label>
    <label>Password<input type="password" name="password" autoComplete="current-password" required/></label>
    <button type="submit" className="admin-button primary" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
  </form>;
}

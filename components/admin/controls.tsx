'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {useFormStatus} from 'react-dom';
import type {ReactNode} from 'react';

export function SubmitButton({children, pending = 'Saving…', className = 'admin-button primary', confirm}: {children: ReactNode; pending?: string; className?: string; confirm?: string}) {
  const status = useFormStatus();
  return <button type="submit" className={className} disabled={status.pending}
    onClick={event => {if (confirm && !window.confirm(confirm)) event.preventDefault();}}>{status.pending ? pending : children}</button>;
}

export function NavLink({href, children, exact = false}: {href: string; children: ReactNode; exact?: boolean}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(href + '/');
  return <Link href={href} className={active ? 'active' : undefined} aria-current={active ? 'page' : undefined}>{children}</Link>;
}

import {Clapperboard, ExternalLink, Film, History, Inbox, LayoutDashboard, LogOut, Mail, MapPin, MonitorPlay, PenLine, Settings2, UserRound, Users} from 'lucide-react';
import {can, requireAdmin} from '@/lib/server/auth';
import {roleLabels} from '@/lib/server/users';
import {submissionCounts} from '@/lib/server/submissions';
import {NavLink} from '@/components/admin/controls';
import {logout} from '../actions';

export default async function PanelLayout({children}: {children: React.ReactNode}) {
  const admin = await requireAdmin();
  const unread = Object.values(submissionCounts()).reduce((sum, count) => sum + count.new, 0);
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <a className="admin-brand" href="/admin"><img src="/images/udayancinema-logo.png" alt="" width="46" height="42"/><span>Udayan<small>Admin panel</small></span></a>
      <nav aria-label="Admin">
        <NavLink href="/admin" exact><LayoutDashboard size={18}/>Dashboard</NavLink>
        <NavLink href="/admin/submissions"><Inbox size={18}/>Submissions{unread > 0 && <b className="admin-count">{unread}</b>}</NavLink>
        {can(admin, 'content') && <>
          <span className="admin-nav-label">Website</span>
          <NavLink href="/admin/content"><PenLine size={18}/>Pages & photos</NavLink>
          <NavLink href="/admin/now-showing"><MonitorPlay size={18}/>Now showing</NavLink>
          <NavLink href="/admin/coming-soon"><Film size={18}/>Coming soon</NavLink>
          <NavLink href="/admin/cinemas"><MapPin size={18}/>Cinemas</NavLink>
          <NavLink href="/admin/site"><Settings2 size={18}/>Site details</NavLink>
        </>}
        {can(admin, 'settings') && <>
          <span className="admin-nav-label">Settings</span>
          <NavLink href="/admin/notifications"><Mail size={18}/>Email</NavLink>
          <NavLink href="/admin/users"><Users size={18}/>Staff accounts</NavLink>
          <NavLink href="/admin/activity"><History size={18}/>Activity & backup</NavLink>
        </>}
      </nav>
      <div className="admin-sidebar-footer">
        <a href="/admin/account" className="admin-user"><UserRound size={17}/><span>{admin.name}<small>{roleLabels[admin.role]}</small></span></a>
        <a href="/" target="_blank" rel="noreferrer"><Clapperboard size={17}/>View website<ExternalLink size={14}/></a>
        <form action={logout}><button type="submit"><LogOut size={17}/>Sign out</button></form>
      </div>
    </aside>
    <main className="admin-main">{children}</main>
  </div>;
}

import type {Metadata} from 'next';
import {Download} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {listActivity} from '@/lib/server/activity';
import {formatDate} from '@/components/admin/submission-table';

export const metadata: Metadata = {title: 'Activity & backup'};

export default async function Activity() {
  await requireAdmin('settings');
  const entries = listActivity(300);
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">SETTINGS</span><h1>Activity & backup</h1>
      <p className="admin-subtitle">Every sign-in and change made in the admin panel, newest first.</p></div>
      <a className="admin-button primary" href="/admin/backup"><Download size={16}/>Download backup</a></header>
    <div className="admin-callout"><div><strong>Backups</strong><p>The download is a .tar archive with the database (submissions, content, accounts, settings), every CV, and every uploaded photo. Store it somewhere safe. Server-level backups of the storage folder are still recommended.</p></div></div>
    <section className="admin-panel">
      {!entries.length ? <p className="admin-empty">No activity yet.</p> : <div className="admin-table-wrap"><table className="admin-table">
        <thead><tr><th>When (IST)</th><th>Who</th><th>What</th></tr></thead>
        <tbody>{entries.map(entry => <tr key={entry.id}><td>{formatDate(entry.createdAt)}</td><td><strong>{entry.userName}</strong></td><td>{entry.action}</td></tr>)}</tbody>
      </table></div>}
    </section>
  </>;
}

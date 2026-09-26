import Link from 'next/link';
import {ArrowUpRight, CircleAlert, CircleCheck} from 'lucide-react';
import {can, requireAdmin} from '@/lib/server/auth';
import Notice from '@/components/admin/notice';
import {listSubmissions, submissionCounts} from '@/lib/server/submissions';
import {readContent, recipientsFor} from '@/lib/server/content';
import {emailConfigured} from '@/lib/server/email';
import {formDefinitions, formTypes} from '@/lib/forms';
import SubmissionTable from '@/components/admin/submission-table';

export default async function Dashboard({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const admin = await requireAdmin();
  const counts = await submissionCounts();
  const content = await readContent();
  const recent = (await listSubmissions({status: 'all'}, 1, 8)).submissions;
  const recipientLists = await Promise.all(formTypes.map(type => recipientsFor(type)));
  const missingRecipients = formTypes.filter((_type, index) => !recipientLists[index].length);
  const cinemaNames = Object.fromEntries(content.cinemas.map(cinema => [cinema.id, cinema.name]));
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">OVERVIEW</span><h1>Welcome, {admin.name.split(' ')[0]}</h1></div></header>
    <Notice searchParams={searchParams}/>
    {!can(admin, 'settings') ? null : (!emailConfigured() || missingRecipients.length > 0)
      ? <div className="admin-callout warning"><CircleAlert size={20}/><div><strong>Email notifications need attention.</strong>
          <p>{!emailConfigured() ? 'Resend is not configured on the server (RESEND_API_KEY and RESEND_FROM). ' : ''}{missingRecipients.length ? `No recipients are set for: ${missingRecipients.map(type => formDefinitions[type].label).join(', ')}. ` : ''}Submissions are still saved here.</p>
          <Link href="/admin/notifications">Set up notifications<ArrowUpRight size={15}/></Link></div></div>
      : <div className="admin-callout"><CircleCheck size={20}/><div><strong>Email notifications are active.</strong><p>Each new submission is saved here and emailed through Resend.</p></div></div>}
    <section className="admin-stats">{formTypes.map(type => <Link key={type} href={`/admin/submissions?type=${type}`} className="admin-stat">
      <span>{formDefinitions[type].label}</span><strong>{counts[type].open}</strong>
      <small>{counts[type].new} new · {counts[type].total} total</small>
    </Link>)}</section>
    <section className="admin-panel">
      <div className="admin-panel-head"><h2>Latest submissions</h2><Link href="/admin/submissions" className="admin-link">View all<ArrowUpRight size={15}/></Link></div>
      <SubmissionTable submissions={recent} cinemaNames={cinemaNames}/>
    </section>
  </>;
}

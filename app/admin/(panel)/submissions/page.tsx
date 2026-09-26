import type {Metadata} from 'next';
import Link from 'next/link';
import {Download} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {listSubmissions, statuses, statusLabels} from '@/lib/server/submissions';
import {readContent} from '@/lib/server/content';
import {formDefinitions, formTypes} from '@/lib/forms';
import SubmissionTable from '@/components/admin/submission-table';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {markSubmissionsRead} from '../../actions';

export const metadata: Metadata = {title: 'Submissions'};
type Search = Promise<Record<string, string | string[] | undefined>>;

export default async function Submissions({searchParams}: {searchParams: Search}) {
  await requireAdmin('submissions');
  const params = await searchParams;
  const value = (key: string) => typeof params[key] === 'string' ? params[key] as string : '';
  const filters = {type: value('type'), status: value('status'), query: value('q')};
  const page = Math.max(1, Number(value('page')) || 1);
  const {total, submissions} = await listSubmissions(filters, page);
  const pages = Math.max(1, Math.ceil(total / 25));
  const query = (changes: Record<string, string>) => '?' + new URLSearchParams(Object.entries({type: filters.type, status: filters.status, q: filters.query, ...changes}).filter(([, v]) => v));
  const cinemaNames = Object.fromEntries((await readContent()).cinemas.map(cinema => [cinema.id, cinema.name]));
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">FORM RECORDS</span><h1>Submissions</h1></div>
      <a className="admin-button" href={`/admin/export${query({})}`}><Download size={16}/>Export CSV</a></header>
    <Notice searchParams={searchParams}/>
    <form className="admin-filters" role="search">
      <label>Form<select name="type" defaultValue={filters.type}><option value="">All forms</option>{formTypes.map(type => <option key={type} value={type}>{formDefinitions[type].label}</option>)}</select></label>
      <label>Status<select name="status" defaultValue={filters.status}><option value="">Open & resolved</option>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}<option value="all">Everything</option></select></label>
      <label className="grow">Search<input type="search" name="q" defaultValue={filters.query} placeholder="Name, phone, email, text, or UC-00012"/></label>
      <button type="submit" className="admin-button">Apply</button>
      {(filters.type || filters.status || filters.query) && <Link href="/admin/submissions" className="admin-link">Clear</Link>}
    </form>
    <form action={markSubmissionsRead} className="admin-panel">
      <div className="admin-panel-head"><h2>{total} {total === 1 ? 'submission' : 'submissions'}</h2>
        {submissions.some(submission => submission.status === 'new') && <SubmitButton className="admin-button small" pending="Updating…">Mark selected as in progress</SubmitButton>}</div>
      <SubmissionTable submissions={submissions} cinemaNames={cinemaNames} selectable/>
    </form>
    {pages > 1 && <nav className="admin-pagination" aria-label="Pages">
      {page > 1 ? <Link href={query({page: String(page - 1)})}>← Newer</Link> : <span/>}
      <span>Page {page} of {pages}</span>
      {page < pages ? <Link href={query({page: String(page + 1)})}>Older →</Link> : <span/>}
    </nav>}
  </>;
}

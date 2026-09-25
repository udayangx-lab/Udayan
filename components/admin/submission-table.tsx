import Link from 'next/link';
import {formDefinitions, submissionSummary} from '@/lib/forms';
import {statusLabels, type Submission} from '@/lib/server/submissions';

export const formatDate = (value: string) => new Intl.DateTimeFormat('en-IN', {timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit'}).format(new Date(value));
const emailLabels = {pending: 'Sending', sent: 'Emailed', failed: 'Email failed', skipped: 'Not emailed'};

export default function SubmissionTable({submissions, cinemaNames, selectable = false}: {submissions: Submission[]; cinemaNames: Record<string, string>; selectable?: boolean}) {
  if (!submissions.length) return <p className="admin-empty">No submissions match this view yet.</p>;
  return <div className="admin-table-wrap"><table className="admin-table">
    <thead><tr>{selectable && <th><span className="sr-only">Select</span></th>}<th>Reference</th><th>Form</th><th>From</th><th>Details</th><th>Cinema</th><th>Received</th><th>Status</th></tr></thead>
    <tbody>{submissions.map(submission => <tr key={submission.id} data-status={submission.status}>
      {selectable && <td><input type="checkbox" name="id" value={submission.id} aria-label={`Select ${submission.reference}`}/></td>}
      <td><Link href={`/admin/submissions/${submission.id}`} className="admin-reference">{submission.reference}</Link></td>
      <td>{formDefinitions[submission.type].label}</td>
      <td><strong>{submission.name || 'Anonymous'}</strong>{submission.phone && <span>+91 {submission.phone}</span>}</td>
      <td>{submissionSummary(submission.type, submission.values) || '—'}{submission.attachment && <span>CV attached</span>}</td>
      <td>{cinemaNames[submission.cinema] || (submission.cinema === 'all' ? 'All' : '—')}</td>
      <td>{formatDate(submission.createdAt)}</td>
      <td><span className={`admin-badge ${submission.status}`}>{statusLabels[submission.status]}</span><span className={`admin-email ${submission.emailStatus}`}>{emailLabels[submission.emailStatus]}</span></td>
    </tr>)}</tbody>
  </table></div>;
}

import type {Metadata} from 'next';
import Link from 'next/link';
import {notFound} from 'next/navigation';
import {ArrowLeft, Download, Mail, MessageCircle, Phone} from 'lucide-react';
import {can, requireAdmin} from '@/lib/server/auth';
import {getSubmission, statuses, statusLabels} from '@/lib/server/submissions';
import {readContent} from '@/lib/server/content';
import {displayValue, formDefinitions} from '@/lib/forms';
import {formatDate} from '@/components/admin/submission-table';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {removeSubmission, resendSubmissionEmail, saveSubmissionNote, setSubmissionStatus} from '../../../actions';

type Props = {params: Promise<{id: string}>; searchParams: Promise<Record<string, string | string[] | undefined>>};
export async function generateMetadata({params}: Props): Promise<Metadata> {return {title: `Submission ${(await params).id}`};}

const replyText = {'': 'Not sent (replies are off for this form)', sent: 'Sent', failed: 'Failed', skipped: 'Not sent (Resend is not configured)'};
const emailText = {pending: 'The notification email is being sent.', sent: 'The notification email was delivered to Resend.', failed: 'The notification email failed.', skipped: 'No notification email was sent.'};

export default async function SubmissionPage({params, searchParams}: Props) {
  const admin = await requireAdmin('submissions');
  const submission = getSubmission(Number((await params).id));
  if (!submission) notFound();
  const definition = formDefinitions[submission.type];
  const cinemaNames = Object.fromEntries(readContent().cinemas.map(cinema => [cinema.id, cinema.name]));
  const rows = definition.fields.filter(field => field.type !== 'file').map(field => ({field, value: displayValue(field, submission.values[field.name], cinemaNames)}));
  const id = <input type="hidden" name="id" value={submission.id}/>;
  return <>
    <Link href="/admin/submissions" className="admin-link back"><ArrowLeft size={15}/>All submissions</Link>
    <header className="admin-header"><div><span className="admin-eyebrow">{definition.label.toUpperCase()}</span><h1>{submission.reference}</h1>
      <p className="admin-subtitle">Received {formatDate(submission.createdAt)} IST · <span className={`admin-badge ${submission.status}`}>{statusLabels[submission.status]}</span></p></div>
      <div className="admin-quick">
        {submission.phone && <a className="admin-button" href={`tel:+91${submission.phone}`}><Phone size={16}/>Call</a>}
        {submission.phone && <a className="admin-button" href={`https://wa.me/91${submission.phone}`} target="_blank" rel="noreferrer"><MessageCircle size={16}/>WhatsApp</a>}
        {submission.email && <a className="admin-button" href={`mailto:${submission.email}?subject=${encodeURIComponent('Udayan Cinema · ' + submission.reference)}`}><Mail size={16}/>Reply</a>}
      </div>
    </header>
    <Notice searchParams={searchParams}/>
    <div className="admin-detail">
      <section className="admin-panel">
        <div className="admin-panel-head"><h2>Details</h2></div>
        <dl className="admin-fields">{rows.map(({field, value}) => <div key={field.name}><dt>{field.label}</dt><dd className={value ? undefined : 'empty'}>{value || 'Not provided'}</dd></div>)}
          {submission.attachment && <div><dt>CV</dt><dd><a className="admin-button small" href={`/admin/files/${submission.id}`}><Download size={15}/>{submission.attachment.name}</a> <small>{Math.max(1, Math.round(submission.attachment.size / 1024))} KB</small></dd></div>}
        </dl>
      </section>
      <aside className="admin-side">
        <form action={setSubmissionStatus} className="admin-panel admin-form">{id}
          <h2>Status</h2>
          <label><span className="sr-only">Status</span><select name="status" defaultValue={submission.status}>{statuses.map(status => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
          <SubmitButton>Update status</SubmitButton>
        </form>
        <form action={saveSubmissionNote} className="admin-panel admin-form">{id}
          <h2>Internal note</h2>
          <label><span className="sr-only">Internal note</span><textarea name="note" rows={4} defaultValue={submission.note} placeholder="Only visible to admins"/></label>
          <SubmitButton>Save note</SubmitButton>
        </form>
        <form action={resendSubmissionEmail} className="admin-panel admin-form">{id}
          <h2>Email notification</h2>
          <p className={`admin-email-state ${submission.emailStatus}`}>{emailText[submission.emailStatus]}{submission.emailError && <small>{submission.emailError}</small>}</p>
          <SubmitButton className="admin-button" pending="Sending…">{submission.emailStatus === 'sent' ? 'Send again' : 'Send notification'}</SubmitButton>
          {submission.email && <p className="admin-reply-state">Automatic reply to visitor: <strong>{replyText[submission.replyStatus]}</strong></p>}
        </form>
        {can(admin, 'submissions.delete') && <form action={removeSubmission} className="admin-panel admin-form danger">{id}
          <h2>Delete</h2>
          <p>Permanently removes this record{submission.attachment ? ' and its CV' : ''}.</p>
          <SubmitButton className="admin-button danger" pending="Deleting…" confirm={`Delete ${submission.reference} permanently? This cannot be undone.`}>Delete submission</SubmitButton>
        </form>}
      </aside>
    </div>
  </>;
}

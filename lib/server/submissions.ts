import {database} from './db';
import {removeStored, type Attachment} from './uploads';
import {formDefinitions, isFormType, type FormType, type SubmissionValues} from '@/lib/forms';

export const statuses = ['new', 'in-progress', 'resolved', 'archived', 'spam'] as const;
export type Status = typeof statuses[number];
export const statusLabels: Record<Status, string> = {new: 'New', 'in-progress': 'In progress', resolved: 'Resolved', archived: 'Archived', spam: 'Spam'};
export const isStatus = (value: unknown): value is Status => statuses.includes(value as Status);

export type Submission = {
  id: number; reference: string; type: FormType; status: Status; name: string; phone: string; email: string; cinema: string;
  values: SubmissionValues; attachment: Attachment | null; emailStatus: 'pending' | 'sent' | 'failed' | 'skipped';
  emailError: string; replyStatus: '' | 'sent' | 'failed' | 'skipped'; note: string; createdAt: string; updatedAt: string;
};
type Row = {id: number; type: string; status: string; name: string; phone: string; email: string; cinema: string; data: string;
  attachment: string | null; email_status: string; email_error: string; reply_status: string; note: string; created_at: string; updated_at: string};

export const reference = (id: number) => 'UC-' + String(id).padStart(5, '0');

function parse(row: Row): Submission {
  return {
    id: row.id, reference: reference(row.id), type: isFormType(row.type) ? row.type : 'contact', status: isStatus(row.status) ? row.status : 'new',
    name: row.name, phone: row.phone, email: row.email, cinema: row.cinema, values: JSON.parse(row.data),
    attachment: row.attachment ? JSON.parse(row.attachment) : null, emailStatus: row.email_status as Submission['emailStatus'],
    emailError: row.email_error, replyStatus: row.reply_status as Submission['replyStatus'], note: row.note, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}
const text = (values: SubmissionValues, key: string) => typeof values[key] === 'string' ? values[key] as string : '';

export function createSubmission(type: FormType, values: SubmissionValues, attachment: Attachment | null) {
  const now = new Date().toISOString();
  const result = database().prepare(`INSERT INTO submissions (type, name, phone, email, cinema, data, attachment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(type, text(values, 'name'), text(values, 'phone'), text(values, 'email'), text(values, 'cinema'),
    JSON.stringify(values), attachment ? JSON.stringify(attachment) : null, now, now);
  return getSubmission(Number(result.lastInsertRowid))!;
}

export function getSubmission(id: number) {
  const row = database().prepare('SELECT * FROM submissions WHERE id = ?').get(id) as Row | undefined;
  return row ? parse(row) : null;
}

export type Filters = {type?: string; status?: string; query?: string};
function where({type, status, query}: Filters) {
  const clauses: string[] = [];
  const params: string[] = [];
  if (isFormType(type)) {clauses.push('type = ?'); params.push(type);}
  // Spam and archived entries stay out of the default inbox view.
  if (isStatus(status)) {clauses.push('status = ?'); params.push(status);}
  else if (status !== 'all') clauses.push("status NOT IN ('archived', 'spam')");
  const search = query?.trim();
  if (search) {
    const reference = /^uc-?0*(\d+)$/i.exec(search);
    if (reference) {clauses.push('id = ?'); params.push(reference[1]);}
    else {clauses.push('(name LIKE ? OR phone LIKE ? OR email LIKE ? OR data LIKE ?)'); params.push(...Array(4).fill(`%${search}%`));}
  }
  return {sql: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params};
}

export function listSubmissions(filters: Filters, page = 1, perPage = 25) {
  const {sql, params} = where(filters);
  const total = (database().prepare(`SELECT COUNT(*) AS count FROM submissions ${sql}`).get(...params) as {count: number}).count;
  const rows = database().prepare(`SELECT * FROM submissions ${sql} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...params, perPage, (Math.max(1, page) - 1) * perPage) as Row[];
  return {total, submissions: rows.map(parse)};
}
export function allSubmissions(filters: Filters) {
  const {sql, params} = where(filters);
  return (database().prepare(`SELECT * FROM submissions ${sql} ORDER BY created_at DESC, id DESC`).all(...params) as Row[]).map(parse);
}

export function submissionCounts() {
  const rows = database().prepare('SELECT type, status, COUNT(*) AS count FROM submissions GROUP BY type, status').all() as {type: string; status: string; count: number}[];
  const counts = Object.fromEntries(Object.keys(formDefinitions).map(type => [type, {total: 0, open: 0, new: 0}])) as Record<FormType, {total: number; open: number; new: number}>;
  for (const row of rows) {
    if (!isFormType(row.type)) continue;
    counts[row.type].total += row.count;
    if (row.status === 'new') counts[row.type].new += row.count;
    if (row.status === 'new' || row.status === 'in-progress') counts[row.type].open += row.count;
  }
  return counts;
}

export function updateSubmission(id: number, changes: {status?: Status; note?: string; emailStatus?: Submission['emailStatus']; emailError?: string; replyStatus?: Submission['replyStatus']}) {
  const columns: string[] = [];
  const params: (string | number)[] = [];
  if (changes.status) {columns.push('status = ?'); params.push(changes.status);}
  if (changes.note !== undefined) {columns.push('note = ?'); params.push(changes.note);}
  if (changes.emailStatus) {columns.push('email_status = ?', 'email_error = ?'); params.push(changes.emailStatus, changes.emailError || '');}
  if (changes.replyStatus) {columns.push('reply_status = ?'); params.push(changes.replyStatus);}
  if (!columns.length) return;
  database().prepare(`UPDATE submissions SET ${columns.join(', ')}, updated_at = ? WHERE id = ?`).run(...params, new Date().toISOString(), id);
}

export async function deleteSubmission(id: number) {
  const submission = getSubmission(id);
  if (!submission) return;
  database().prepare('DELETE FROM submissions WHERE id = ?').run(id);
  if (submission.attachment) await removeStored(submission.attachment.file);
}

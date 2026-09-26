import {iso, query} from './db';
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
type Row = {id: number; type: string; status: string; name: string; phone: string; email: string; cinema: string; data: SubmissionValues;
  attachment: Attachment | null; email_status: string; email_error: string; reply_status: string; note: string; created_at: unknown; updated_at: unknown};

export const reference = (id: number) => 'UC-' + String(id).padStart(5, '0');

function parse(row: Row): Submission {
  return {
    id: Number(row.id), reference: reference(Number(row.id)), type: isFormType(row.type) ? row.type : 'contact', status: isStatus(row.status) ? row.status : 'new',
    name: row.name, phone: row.phone, email: row.email, cinema: row.cinema, values: row.data, attachment: row.attachment,
    emailStatus: row.email_status as Submission['emailStatus'], emailError: row.email_error, replyStatus: row.reply_status as Submission['replyStatus'],
    note: row.note, createdAt: iso(row.created_at)!, updatedAt: iso(row.updated_at)!,
  };
}
const text = (values: SubmissionValues, key: string) => typeof values[key] === 'string' ? values[key] as string : '';

export async function createSubmission(type: FormType, values: SubmissionValues, attachment: Attachment | null) {
  const [row] = await query<Row>(`INSERT INTO submissions (type, name, phone, email, cinema, data, attachment)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb) RETURNING *`,
    [type, text(values, 'name'), text(values, 'phone'), text(values, 'email'), text(values, 'cinema'), JSON.stringify(values), attachment ? JSON.stringify(attachment) : null]);
  return parse(row);
}

export async function getSubmission(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;
  const [row] = await query<Row>('SELECT * FROM submissions WHERE id = $1', [id]);
  return row ? parse(row) : null;
}

export type Filters = {type?: string; status?: string; query?: string};
function where({type, status, query: search}: Filters) {
  const clauses: string[] = [];
  const params: unknown[] = [];
  const param = (value: unknown) => {params.push(value); return `$${params.length}`;};
  if (isFormType(type)) clauses.push(`type = ${param(type)}`);
  // Spam and archived entries stay out of the default inbox view.
  if (isStatus(status)) clauses.push(`status = ${param(status)}`);
  else if (status !== 'all') clauses.push("status NOT IN ('archived', 'spam')");
  const term = search?.trim();
  if (term) {
    const match = /^uc-?0*(\d+)$/i.exec(term);
    if (match) clauses.push(`id = ${param(Number(match[1]))}`);
    else {const like = param(`%${term}%`); clauses.push(`(name ILIKE ${like} OR phone ILIKE ${like} OR email ILIKE ${like} OR data::text ILIKE ${like})`);}
  }
  return {sql: clauses.length ? 'WHERE ' + clauses.join(' AND ') : '', params};
}

export async function listSubmissions(filters: Filters, page = 1, perPage = 25) {
  const {sql, params} = where(filters);
  const [{count}] = await query<{count: number}>(`SELECT COUNT(*)::int AS count FROM submissions ${sql}`, params);
  const rows = await query<Row>(`SELECT * FROM submissions ${sql} ORDER BY created_at DESC, id DESC LIMIT ${Number(perPage)} OFFSET ${(Math.max(1, page) - 1) * Number(perPage)}`, params);
  return {total: count, submissions: rows.map(parse)};
}
export async function allSubmissions(filters: Filters) {
  const {sql, params} = where(filters);
  return (await query<Row>(`SELECT * FROM submissions ${sql} ORDER BY created_at DESC, id DESC`, params)).map(parse);
}

export async function submissionCounts() {
  const rows = await query<{type: string; status: string; count: number}>('SELECT type, status, COUNT(*)::int AS count FROM submissions GROUP BY type, status');
  const counts = Object.fromEntries(Object.keys(formDefinitions).map(type => [type, {total: 0, open: 0, new: 0}])) as Record<FormType, {total: number; open: number; new: number}>;
  for (const row of rows) {
    if (!isFormType(row.type)) continue;
    counts[row.type].total += row.count;
    if (row.status === 'new') counts[row.type].new += row.count;
    if (row.status === 'new' || row.status === 'in-progress') counts[row.type].open += row.count;
  }
  return counts;
}

export async function updateSubmission(id: number, changes: {status?: Status; note?: string; emailStatus?: Submission['emailStatus']; emailError?: string; replyStatus?: Submission['replyStatus']}) {
  const columns: string[] = [];
  const params: unknown[] = [];
  const set = (column: string, value: unknown) => {params.push(value); columns.push(`${column} = $${params.length}`);};
  if (changes.status) set('status', changes.status);
  if (changes.note !== undefined) set('note', changes.note);
  if (changes.emailStatus) {set('email_status', changes.emailStatus); set('email_error', changes.emailError || '');}
  if (changes.replyStatus) set('reply_status', changes.replyStatus);
  if (!columns.length) return;
  params.push(id);
  await query(`UPDATE submissions SET ${columns.join(', ')}, updated_at = now() WHERE id = $${params.length}`, params);
}

export async function deleteSubmission(id: number) {
  const submission = await getSubmission(id);
  if (!submission) return;
  await query('DELETE FROM submissions WHERE id = $1', [id]);
  if (submission.attachment) await removeStored(submission.attachment.file);
}

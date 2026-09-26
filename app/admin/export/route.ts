import type {NextRequest} from 'next/server';
import {can, getAdmin} from '@/lib/server/auth';
import {allSubmissions, statusLabels} from '@/lib/server/submissions';
import {readContent} from '@/lib/server/content';
import {displayValue, formDefinitions, formTypes, isFormType} from '@/lib/forms';

// Leading =, +, -, @ would run as formulas in spreadsheet apps.
const cell = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replace(/"/g, '""')}"`;

export async function GET(request: NextRequest) {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'submissions')) return new Response('Unauthorized', {status: 401});
  const search = request.nextUrl.searchParams;
  const type = search.get('type') || '';
  const submissions = await allSubmissions({type, status: search.get('status') || '', query: search.get('q') || ''});
  const cinemaNames = Object.fromEntries((await readContent()).cinemas.map(cinema => [cinema.id, cinema.name]));
  const fields = [...new Map((isFormType(type) ? [type] : formTypes).flatMap(item => formDefinitions[item].fields).filter(field => field.type !== 'file').map(field => [field.name, field])).values()];
  const header = ['Reference', 'Form', 'Status', 'Received (IST)', ...fields.map(field => field.label), 'CV', 'Internal note'];
  const rows = submissions.map(submission => [
    submission.reference, formDefinitions[submission.type].label, statusLabels[submission.status],
    new Date(submission.createdAt).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}),
    ...fields.map(field => displayValue(field, submission.values[field.name], cinemaNames)),
    submission.attachment?.name || '', submission.note,
  ]);
  const csv = '\ufeff' + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
  const name = `udayan-${isFormType(type) ? type : 'submissions'}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {headers: {'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'private, no-store'}});
}

import {can, getAdmin} from '@/lib/server/auth';
import {getSubmission} from '@/lib/server/submissions';
import {readStored} from '@/lib/server/uploads';

// CVs are private: they are stored outside public/ and only served to a signed-in admin.
export async function GET(_request: Request, {params}: {params: Promise<{id: string}>}) {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'submissions')) return new Response('Unauthorized', {status: 401});
  const attachment = (await getSubmission(Number((await params).id)))?.attachment;
  const stored = attachment && await readStored('document', attachment.file);
  if (!attachment || !stored) return new Response('Not found', {status: 404});
  return new Response(new Uint8Array(stored.bytes), {headers: {
    'Content-Type': attachment.type, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `attachment; filename="${attachment.name.replace(/["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(attachment.name)}`,
  }});
}

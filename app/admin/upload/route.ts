import {can, getAdmin} from '@/lib/server/auth';
import {saveImage} from '@/lib/server/uploads';

// Editors upload photos one at a time as they choose them; the section form then saves only the paths.
// Server actions check the origin themselves; this route must do it explicitly.
export async function POST(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!origin || !host || new URL(origin).host !== host) return Response.json({error: 'Cross-site uploads are not allowed.'}, {status: 403});
  const admin = await getAdmin();
  if (!admin || !can(admin, 'content')) return Response.json({error: 'Please sign in again.'}, {status: 401});
  const file = (await request.formData().catch(() => null))?.get('file');
  if (!(file instanceof File) || !file.size) return Response.json({error: 'Choose an image to upload.'}, {status: 400});
  const saved = await saveImage(file);
  return 'error' in saved ? Response.json({error: saved.error}, {status: 400}) : Response.json(saved);
}

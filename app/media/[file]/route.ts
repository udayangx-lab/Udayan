import {mediaTypes, readStored} from '@/lib/server/uploads';

// Posters uploaded in the admin panel. Names are random and never reused, so they can be cached forever.
export async function GET(_request: Request, {params}: {params: Promise<{file: string}>}) {
  const {file} = await params;
  const bytes = await readStored('media', file);
  const type = mediaTypes[file.split('.').pop() || ''];
  if (!bytes || !type) return new Response('Not found', {status: 404});
  return new Response(new Uint8Array(bytes), {headers: {'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'}});
}

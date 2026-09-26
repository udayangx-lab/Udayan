import {readStored} from '@/lib/server/uploads';

// Photos uploaded in the admin panel. Names are random and never reused, so browsers and Vercel's CDN can cache them forever.
export async function GET(_request: Request, {params}: {params: Promise<{file: string}>}) {
  const stored = await readStored('image', (await params).file);
  if (!stored) return new Response('Not found', {status: 404});
  return new Response(new Uint8Array(stored.bytes), {headers: {'Content-Type': stored.type, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff'}});
}

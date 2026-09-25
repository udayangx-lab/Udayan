import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {can, getAdmin} from '@/lib/server/auth';
import {database, mediaDir, uploadsDir} from '@/lib/server/db';
import {logActivity} from '@/lib/server/activity';

// A .tar archive of the database, CVs, and uploaded images, streamed one file at a time.
function header(name: string, size: number) {
  const block = Buffer.alloc(512);
  const put = (value: string, offset: number, length: number) => block.write(value, offset, length, 'utf8');
  put(name, 0, 100); put('0000644\0', 100, 8); put('0000000\0', 108, 8); put('0000000\0', 116, 8);
  put(size.toString(8).padStart(11, '0') + '\0', 124, 12); put(Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0', 136, 12);
  put('        ', 148, 8); put('0', 156, 1); put('ustar\0', 257, 6); put('00', 263, 2);
  let sum = 0;
  for (const byte of block) sum += byte;
  put(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
  return block;
}

export async function GET() {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'settings')) return new Response('Unauthorized', {status: 401});
  // VACUUM INTO writes a consistent copy even while the site is taking submissions.
  const snapshot = path.join(os.tmpdir(), `udayan-${Date.now()}.db`);
  database().prepare('VACUUM INTO ?').run(snapshot);
  const list = async (directory: string, prefix: string) => (await fs.readdir(directory).catch(() => [])).map(file => ({name: `${prefix}/${file}`, file: path.join(directory, file)}));
  const entries = [{name: 'udayan.db', file: snapshot}, ...await list(uploadsDir, 'uploads'), ...await list(mediaDir, 'media')];
  logActivity(admin, 'Downloaded a backup');
  let index = 0;
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (index >= entries.length) {
        controller.enqueue(new Uint8Array(1024));
        controller.close();
        await fs.unlink(snapshot).catch(() => {});
        return;
      }
      const entry = entries[index++];
      const bytes = await fs.readFile(entry.file).catch(() => null);
      if (!bytes) return;
      controller.enqueue(new Uint8Array(header(entry.name, bytes.length)));
      controller.enqueue(new Uint8Array(bytes));
      if (bytes.length % 512) controller.enqueue(new Uint8Array(512 - bytes.length % 512));
    },
    async cancel() {await fs.unlink(snapshot).catch(() => {});},
  });
  return new Response(stream, {headers: {'Content-Type': 'application/x-tar', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="udayan-backup-${new Date().toISOString().slice(0, 10)}.tar"`}});
}

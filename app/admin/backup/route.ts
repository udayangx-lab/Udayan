import {can, getAdmin} from '@/lib/server/auth';
import {query} from '@/lib/server/db';
import {logActivity} from '@/lib/server/activity';

export const maxDuration = 60;

// A JSON export of the records: submissions, content, settings, accounts (password hashes only), and activity.
// CVs and photos are listed but not embedded; Neon's point-in-time restore is the full backup.
export async function GET() {
  const admin = await getAdmin();
  if (!admin || !can(admin, 'settings')) return new Response('Unauthorized', {status: 401});
  const [submissions, settings, users, activity, files] = await Promise.all([
    query('SELECT * FROM submissions ORDER BY id'),
    query("SELECT key, value, updated_at FROM settings WHERE key NOT IN ('session-secret', 'listings-lease') ORDER BY key"),
    query('SELECT id, name, email, role, active, created_at, last_login_at FROM users ORDER BY id'),
    query('SELECT * FROM activity ORDER BY id'),
    query('SELECT id, kind, name, type, size, created_at FROM files ORDER BY created_at'),
  ]);
  await logActivity(admin, 'Downloaded a backup');
  const body = JSON.stringify({exportedAt: new Date().toISOString(), submissions, settings, users, activity, files}, null, 2);
  return new Response(body, {headers: {'Content-Type': 'application/json', 'Cache-Control': 'private, no-store',
    'Content-Disposition': `attachment; filename="udayan-backup-${new Date().toISOString().slice(0, 10)}.json"`}});
}

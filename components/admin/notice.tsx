const messages: Record<string, string> = {
  saved: 'Changes saved. The website has been updated.', status: 'Status updated.', note: 'Note saved.',
  emailed: 'Notification email sent.', deleted: 'Submission deleted.', test: 'Test email sent. Check the recipients’ inboxes.',
  refreshed: 'Listings refreshed from District.', reply: 'Automatic reply settings saved.', 'user-added': 'Account created. Share the password with them securely.',
  'user-deleted': 'Account deleted.', password: 'Password updated. They will need to sign in again.',
};

export default async function Notice({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const {notice, error} = await searchParams;
  if (typeof error === 'string') return <p className="admin-notice error" role="alert">{error}</p>;
  if (typeof notice === 'string' && messages[notice]) return <p className="admin-notice" role="status">{messages[notice]}</p>;
  return null;
}

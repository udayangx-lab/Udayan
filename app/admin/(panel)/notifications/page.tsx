import type {Metadata} from 'next';
import {CircleAlert, CircleCheck} from 'lucide-react';
import {requireAdmin} from '@/lib/server/auth';
import {envRecipients, readContent, readNotifications} from '@/lib/server/content';
import {emailConfigured} from '@/lib/server/email';
import {formDefinitions, formTypes} from '@/lib/forms';
import Notice from '@/components/admin/notice';
import {SubmitButton} from '@/components/admin/controls';
import {saveAutoReply, saveNotificationSettings, sendTestEmail} from '../../actions';

export const metadata: Metadata = {title: 'Email notifications'};

export default async function Notifications({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  await requireAdmin('settings');
  const settings = await readNotifications();
  const fallback = envRecipients();
  const reply = settings.autoReply;
  const content = await readContent();
  return <>
    <header className="admin-header"><div><span className="admin-eyebrow">SETTINGS</span><h1>Email notifications</h1>
      <p className="admin-subtitle">Every form submission is saved in this panel and emailed to the addresses below through Resend.</p></div></header>
    <Notice searchParams={searchParams}/>
    {emailConfigured()
      ? <div className="admin-callout"><CircleCheck size={20}/><div><strong>Resend is connected.</strong><p>Emails are sent from <code>{process.env.RESEND_FROM}</code>.</p></div></div>
      : <div className="admin-callout warning"><CircleAlert size={20}/><div><strong>Resend is not configured.</strong><p>Set <code>RESEND_API_KEY</code> and <code>RESEND_FROM</code> (an address on a domain verified in Resend) in the server environment, then restart.</p></div></div>}
    <form action={saveNotificationSettings} className="admin-panel admin-form wide">
      <label>Default recipients<textarea name="recipients" rows={3} defaultValue={settings.recipients.join('\n')} placeholder={fallback.length ? fallback.join('\n') : 'admin@example.com'}/>
        <small>One address per line. {fallback.length ? `If empty, ADMIN_EMAIL is used (${fallback.join(', ')}).` : 'Used for every form unless a form has its own list below.'}</small></label>
      <fieldset className="admin-overrides"><legend>Send a form somewhere else (optional)</legend>
        {formTypes.map(type => <label key={type}>{formDefinitions[type].label}<input name={`override-${type}`} defaultValue={settings.overrides[type]?.join(', ') || ''} placeholder="Uses the default recipients"/></label>)}
      </fieldset>
      <div className="admin-actions"><SubmitButton>Save recipients</SubmitButton></div>
    </form>
    <form action={sendTestEmail} className="admin-panel admin-form">
      <input type="hidden" name="kind" value="notification"/>
      <h2>Test delivery</h2>
      <p>Sends a short test message to the default recipients.</p>
      <div className="admin-actions"><SubmitButton className="admin-button" pending="Sending…">Send test email</SubmitButton></div>
    </form>
    <form id="auto-reply" action={saveAutoReply} className="admin-panel admin-form wide">
      <h2>Automatic reply to visitors</h2>
      <p>When a visitor includes their email address, they receive this confirmation. Replies to it go to {content.contactEmail}.</p>
      <label className="admin-check"><input type="checkbox" name="enabled" defaultChecked={reply.enabled}/>Send automatic replies</label>
      <fieldset className="admin-overrides"><legend>Send for these forms</legend>
        {formTypes.map(type => <label key={type} className="admin-check"><input type="checkbox" name="forms" value={type} defaultChecked={reply.forms.includes(type)}/>{formDefinitions[type].label}</label>)}
      </fieldset>
      <label>Subject<input name="subject" defaultValue={reply.subject} maxLength={150} required/></label>
      <label>Message<textarea name="message" defaultValue={reply.message} rows={9} maxLength={3000} required/>
        <small>Use {'{name}'}, {'{reference}'}, and {'{form}'} to fill in the visitor’s name, their reference number, and what they sent (for example “job application”). Leave an empty line between paragraphs.</small></label>
      <div className="admin-actions"><SubmitButton>Save automatic reply</SubmitButton></div>
    </form>
    <form action={sendTestEmail} className="admin-panel admin-form">
      <input type="hidden" name="kind" value="reply"/>
      <h2>Preview the automatic reply</h2>
      <p>Sends the saved reply to the default recipients, filled in with sample details.</p>
      <div className="admin-actions"><SubmitButton className="admin-button" pending="Sending…">Send test reply</SubmitButton></div>
    </form>
  </>;
}

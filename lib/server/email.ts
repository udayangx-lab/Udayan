import {readStored} from './uploads';
import {readContent, readNotifications, recipientsFor, type AutoReply} from './content';
import {updateSubmission, type Submission} from './submissions';
import {displayValue, formDefinitions} from '@/lib/forms';

type Email = {to: string[]; subject: string; html: string; text: string; replyTo?: string; attachments?: {filename: string; content: string}[]};

export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);

export async function sendEmail(email: Email) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(20000),
    headers: {Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({from: process.env.RESEND_FROM, to: email.to, subject: email.subject, html: email.html, text: email.text,
      reply_to: email.replyTo, attachments: email.attachments}),
  });
  const result = await response.json().catch(() => ({})) as {id?: string; message?: string};
  if (!response.ok) throw new Error(result.message || `Resend returned HTTP ${response.status}`);
  return result.id;
}

const escape = (value: string) => value.replace(/[&<>"']/g, character => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[character]!));

async function render(submission: Submission) {
  const definition = formDefinitions[submission.type];
  const cinemaNames = Object.fromEntries((await readContent()).cinemas.map(cinema => [cinema.id, cinema.name]));
  const rows = definition.fields.filter(field => field.type !== 'file').map(field => [field.label, displayValue(field, submission.values[field.name], cinemaNames)] as const).filter(([, value]) => value);
  if (submission.attachment) rows.push(['CV', `${submission.attachment.name} (attached)`]);
  const site = process.env.SITE_URL?.replace(/\/$/, '');
  const link = site ? `${site}/admin/submissions/${submission.id}` : '';
  const who = submission.name || (submission.phone ? '+91 ' + submission.phone : 'a visitor');
  const subject = `${definition.label.replace(/s$/, '')} from ${who} · ${submission.reference}`;
  const html = `<div style="font-family:Arial,sans-serif;color:#171717;max-width:640px">
    <p style="font-size:12px;letter-spacing:1.5px;color:#BB0504;font-weight:bold;margin:0 0 6px">UDAYAN CINEMA · ${escape(definition.label.toUpperCase())}</p>
    <h1 style="font-size:22px;margin:0 0 18px">New submission ${escape(submission.reference)}</h1>
    <table style="border-collapse:collapse;width:100%;font-size:14px">${rows.map(([label, value]) =>
      `<tr><td style="padding:10px 12px;border-bottom:1px solid #eee;color:#6b6b6b;width:190px;vertical-align:top">${escape(label)}</td><td style="padding:10px 12px;border-bottom:1px solid #eee;white-space:pre-wrap">${escape(value)}</td></tr>`).join('')}</table>
    <p style="font-size:12px;color:#6b6b6b;margin-top:18px">Received ${escape(new Date(submission.createdAt).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short'}))} IST from ${escape(definition.page)}.</p>
    ${link ? `<p><a href="${escape(link)}" style="display:inline-block;background:#BB0504;color:#fff;padding:11px 18px;border-radius:4px;text-decoration:none;font-size:14px">Open in admin panel</a></p>` : ''}
  </div>`;
  const text = `${definition.label} · ${submission.reference}\n\n${rows.map(([label, value]) => `${label}: ${value}`).join('\n')}${link ? `\n\nOpen in admin: ${link}` : ''}`;
  return {subject, html, text};
}

/** Emails the admins about a stored submission and records the delivery outcome on it. */
export async function notifyAdmins(submission: Submission) {
  const to = await recipientsFor(submission.type);
  if (!emailConfigured() || !to.length) {
    await updateSubmission(submission.id, {emailStatus: 'skipped', emailError: !emailConfigured() ? 'Resend is not configured (RESEND_API_KEY / RESEND_FROM).' : 'No notification recipients are set.'});
    return;
  }
  try {
    const attachments = [];
    if (submission.attachment) {
      const stored = await readStored('document', submission.attachment.file);
      if (stored) attachments.push({filename: submission.attachment.name, content: stored.bytes.toString('base64')});
    }
    await sendEmail({to, ...await render(submission), replyTo: submission.email || undefined, attachments});
    await updateSubmission(submission.id, {emailStatus: 'sent'});
  } catch (error) {
    console.error(`[forms] Notification for ${submission.reference} failed:`, error);
    await updateSubmission(submission.id, {emailStatus: 'failed', emailError: error instanceof Error ? error.message : String(error)});
  }
}

/** Fills {name}, {reference}, and {form} in the visitor reply. */
export function fillReply(template: string, submission: Pick<Submission, 'name' | 'reference' | 'type'>) {
  return template.replace(/\{(name|reference|form)\}/g, (_match, key: string) =>
    key === 'name' ? submission.name || 'there' : key === 'reference' ? submission.reference : formDefinitions[submission.type].noun);
}

export function renderReply(settings: AutoReply, submission: Pick<Submission, 'name' | 'reference' | 'type'>) {
  const subject = fillReply(settings.subject, submission);
  const text = fillReply(settings.message, submission);
  const paragraphs = text.split(/\n{2,}/).map(block => `<p style="margin:0 0 14px">${escape(block).replace(/\n/g, '<br>')}</p>`).join('');
  const html = `<div style="font-family:Arial,sans-serif;color:#171717;max-width:600px;font-size:15px;line-height:1.6">
    <p style="font-size:12px;letter-spacing:1.5px;color:#BB0504;font-weight:bold;margin:0 0 18px">UDAYAN CINEMA</p>${paragraphs}
    <p style="font-size:12px;color:#6b6b6b;margin-top:24px">This is an automatic confirmation. Your reference is ${escape(submission.reference)}.</p></div>`;
  return {subject, text, html};
}

/** Confirms receipt to the visitor, when they gave an email and replies are on for this form. */
export async function sendAutoReply(submission: Submission) {
  const settings = (await readNotifications()).autoReply;
  if (!submission.email || !settings.enabled || !settings.forms.includes(submission.type)) return;
  if (!emailConfigured()) {await updateSubmission(submission.id, {replyStatus: 'skipped'}); return;}
  const replyTo = (await readContent()).contactEmail;
  try {
    await sendEmail({to: [submission.email], ...renderReply(settings, submission), replyTo});
    await updateSubmission(submission.id, {replyStatus: 'sent'});
  } catch (error) {
    console.error(`[forms] Auto-reply for ${submission.reference} failed:`, error);
    await updateSubmission(submission.id, {replyStatus: 'failed'});
  }
}

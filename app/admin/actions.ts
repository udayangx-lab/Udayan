'use server';

import {redirect} from 'next/navigation';
import {authenticate, endSession, requireAdmin, startSession} from '@/lib/server/auth';
import {clientAddress, recordFailure, tooManyFailures} from '@/lib/server/rate-limit';
import {readContent, readNotifications, saveContent, saveNotifications, envRecipients} from '@/lib/server/content';
import {deleteSubmission, getSubmission, isStatus, statusLabels, updateSubmission} from '@/lib/server/submissions';
import {emailConfigured, notifyAdmins, renderReply, sendEmail} from '@/lib/server/email';
import {saveImage} from '@/lib/server/uploads';
import {logActivity} from '@/lib/server/activity';
import {back, emailList, field, isEmail, isUpload, isWebUrl, refreshSite} from '@/lib/server/admin-helpers';
import {formTypes, isFormType, normalizePhone} from '@/lib/forms';
import type {UpcomingMovie} from '@/lib/data';

export async function login(_previous: {error?: string}, formData: FormData): Promise<{error?: string}> {
  const key = `login:${await clientAddress()}`;
  if (await tooManyFailures(key, 6, 15 * 60 * 1000)) return {error: 'Too many failed attempts. Please wait 15 minutes and try again.'};
  const admin = await authenticate(field(formData, 'login', 160), String(formData.get('password') ?? ''));
  if (!admin) {await recordFailure(key); return {error: 'That email or password is not correct.'};}
  await startSession(admin);
  await logActivity(admin, 'Signed in');
  redirect('/admin');
}

export async function logout() {
  await endSession();
  redirect('/admin/login');
}

// Submissions
async function submissionFrom(formData: FormData) {
  const submission = await getSubmission(Number(formData.get('id')));
  if (!submission) back('/admin/submissions', {error: 'That submission no longer exists.'});
  return submission;
}

export async function setSubmissionStatus(formData: FormData) {
  const admin = await requireAdmin('submissions');
  const submission = await submissionFrom(formData);
  const status = formData.get('status');
  if (!isStatus(status)) back(`/admin/submissions/${submission.id}`, {error: 'Choose a valid status.'});
  await updateSubmission(submission.id, {status});
  await logActivity(admin, `Marked ${submission.reference} as ${statusLabels[status]}`);
  back(`/admin/submissions/${submission.id}`, {notice: 'status'});
}

export async function saveSubmissionNote(formData: FormData) {
  const admin = await requireAdmin('submissions');
  const submission = await submissionFrom(formData);
  await updateSubmission(submission.id, {note: field(formData, 'note', 4000)});
  await logActivity(admin, `Updated the note on ${submission.reference}`);
  back(`/admin/submissions/${submission.id}`, {notice: 'note'});
}

export async function resendSubmissionEmail(formData: FormData) {
  const admin = await requireAdmin('submissions');
  const submission = await submissionFrom(formData);
  await notifyAdmins(submission);
  const updated = (await getSubmission(submission.id))!;
  await logActivity(admin, `Resent the notification for ${submission.reference}`);
  back(`/admin/submissions/${submission.id}`, updated.emailStatus === 'sent' ? {notice: 'emailed'} : {error: updated.emailError || 'The email could not be sent.'});
}

export async function removeSubmission(formData: FormData) {
  const admin = await requireAdmin('submissions.delete');
  const submission = await submissionFrom(formData);
  await deleteSubmission(submission.id);
  await logActivity(admin, `Deleted ${submission.reference} (${submission.name || 'anonymous'})`);
  back('/admin/submissions', {notice: 'deleted'});
}

export async function markSubmissionsRead(formData: FormData) {
  const admin = await requireAdmin('submissions');
  const updated: string[] = [];
  for (const id of formData.getAll('id').map(Number).filter(Number.isInteger)) {
    const submission = await getSubmission(id);
    if (submission?.status === 'new') {await updateSubmission(id, {status: 'in-progress'}); updated.push(submission.reference);}
  }
  if (updated.length) await logActivity(admin, `Marked ${updated.join(', ')} as In progress`);
  back('/admin/submissions', {notice: 'status'});
}

// Site content
export async function saveSiteDetails(formData: FormData) {
  const admin = await requireAdmin('content');
  const contactEmail = field(formData, 'contactEmail', 160).toLowerCase();
  const facebook = field(formData, 'facebook', 300);
  const announcement = field(formData, 'announcement', 90);
  if (!isEmail(contactEmail)) back('/admin/site', {error: 'Enter a valid contact email address.'});
  if (facebook && !isWebUrl(facebook)) back('/admin/site', {error: 'The Facebook link must be a full web address, starting with https://.'});
  if (!announcement) back('/admin/site', {error: 'The announcement bar cannot be empty.'});
  await saveContent({contactEmail, facebook, announcement});
  await logActivity(admin, 'Updated site details');
  refreshSite();
  back('/admin/site');
}

export async function saveCinema(formData: FormData) {
  const admin = await requireAdmin('content');
  const content = await readContent();
  const id = field(formData, 'id', 40);
  const current = content.cinemas.find(cinema => cinema.id === id);
  if (!current) back('/admin/cinemas', {error: 'Unknown cinema.'});
  const fail = (error: string) => back(`/admin/cinemas#${id}`, {error: `${current.name}: ${error}`});
  const name = field(formData, 'name', 60);
  const phone = normalizePhone(field(formData, 'phone', 20));
  const latitude = Number(field(formData, 'latitude', 20));
  const longitude = Number(field(formData, 'longitude', 20));
  const links = {maps: field(formData, 'maps', 500), district: field(formData, 'district', 500)};
  if (!name) fail('The name is required.');
  if (!phone) fail('Enter a valid 10-digit mobile number.');
  if (!field(formData, 'address', 300)) fail('The address is required.');
  if (!/^\d{4}$/.test(field(formData, 'since', 4))) fail('“Since” must be a four-digit year.');
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180) fail('Enter valid map coordinates.');
  for (const [key, value] of Object.entries(links)) if (!isWebUrl(value)) fail(`The ${key === 'maps' ? 'Google Maps' : 'District'} link must be a full web address.`);
  let image = current.image;
  const upload = formData.get('imageFile');
  if (isUpload(upload)) {
    const saved = await saveImage(upload);
    if ('error' in saved) fail(saved.error);
    else image = saved.path;
  }
  await saveContent({cinemas: content.cinemas.map(cinema => cinema.id !== id ? cinema : {
    ...cinema, ...links, name, phone: phone!, image, tagline: field(formData, 'tagline', 60), since: field(formData, 'since', 4),
    address: field(formData, 'address', 300), parking: field(formData, 'parking', 80), coordinates: {latitude, longitude},
  })});
  await logActivity(admin, `Updated the ${name} cinema details`);
  refreshSite();
  back(`/admin/cinemas#${id}`);
}

export async function saveUpcoming(formData: FormData) {
  const admin = await requireAdmin('content');
  const ids = formData.getAll('id').map(String);
  const titles = formData.getAll('title').map(value => String(value).trim());
  const posters = formData.getAll('poster').map(String);
  const releaseDates = formData.getAll('releaseDate').map(String);
  const languages = formData.getAll('language').map(value => String(value).trim().slice(0, 60));
  const files = formData.getAll('file');
  if (ids.length > 40) back('/admin/coming-soon', {error: 'Keep the list to 40 movies or fewer.'});
  const upcoming: UpcomingMovie[] = [];
  for (let index = 0; index < ids.length; index++) {
    const title = titles[index]?.slice(0, 120);
    if (!title) back('/admin/coming-soon', {error: `Movie ${index + 1} needs a title.`});
    let poster = posters[index] || '';
    const file = files[index];
    if (file instanceof File && file.size > 0) {
      const saved = await saveImage(file);
      if ('error' in saved) back('/admin/coming-soon', {error: `${title}: ${saved.error}`});
      else poster = saved.path;
    }
    if (poster && !/^\/(images|media)\/[\w.\-()%]+$/.test(poster)) back('/admin/coming-soon#curated', {error: `The poster for ${title} could not be used. Upload it again.`});
    const releaseDate = /^\d{4}-\d{2}-\d{2}$/.test(releaseDates[index] || '') ? releaseDates[index] : undefined;
    upcoming.push({id: /^[\w.\-]{1,80}$/.test(ids[index]) ? ids[index] : crypto.randomUUID(), title, poster, ...(releaseDate ? {releaseDate} : {}), ...(languages[index] ? {language: languages[index]} : {})});
  }
  await saveContent({upcoming});
  await logActivity(admin, `Updated the Coming soon list (${upcoming.length} movies)`);
  refreshSite();
  back('/admin/coming-soon#curated');
}

// Notifications
export async function saveNotificationSettings(formData: FormData) {
  const admin = await requireAdmin('settings');
  const recipients = emailList(field(formData, 'recipients', 2000));
  const overrides: Partial<Record<(typeof formTypes)[number], string[]>> = {};
  for (const type of formTypes) {
    const list = emailList(field(formData, `override-${type}`, 2000));
    if (list.length) overrides[type] = list;
  }
  const invalid = [...recipients, ...Object.values(overrides).flat()].find(value => !isEmail(value!));
  if (invalid) back('/admin/notifications', {error: `“${invalid}” is not a valid email address.`});
  await saveNotifications({recipients, overrides});
  await logActivity(admin, 'Updated notification recipients');
  back('/admin/notifications');
}

export async function saveAutoReply(formData: FormData) {
  const admin = await requireAdmin('settings');
  const subject = field(formData, 'subject', 150);
  const message = String(formData.get('message') ?? '').replace(/\r\n/g, '\n').trim().slice(0, 3000);
  if (!subject || !message) back('/admin/notifications#auto-reply', {error: 'The automatic reply needs a subject and a message.'});
  const forms = formData.getAll('forms').filter(isFormType);
  await saveNotifications({autoReply: {enabled: formData.get('enabled') === 'on', forms, subject, message}});
  await logActivity(admin, `Updated the automatic reply (${formData.get('enabled') === 'on' ? 'on' : 'off'})`);
  back('/admin/notifications#auto-reply', {notice: 'reply'});
}

export async function sendTestEmail(formData: FormData) {
  const admin = await requireAdmin('settings');
  const kind = formData.get('kind') === 'reply' ? 'reply' : 'notification';
  const settings = await readNotifications();
  const to = settings.recipients.length ? settings.recipients : envRecipients();
  const anchor = kind === 'reply' ? '#auto-reply' : '';
  if (!emailConfigured()) back('/admin/notifications' + anchor, {error: 'Resend is not configured. Set RESEND_API_KEY and RESEND_FROM on the server.'});
  if (!to.length) back('/admin/notifications' + anchor, {error: 'Add at least one default recipient first. Tests are sent there.'});
  try {
    if (kind === 'reply') await sendEmail({to, ...renderReply(settings.autoReply, {name: 'Asha', reference: 'UC-00000', type: 'contact'})});
    else await sendEmail({to, subject: 'Udayan Cinema · test notification',
      text: 'This is a test from the Udayan Cinema admin panel. Form notifications will arrive at this address.',
      html: '<p style="font-family:Arial,sans-serif">This is a test from the <strong>Udayan Cinema</strong> admin panel. Form notifications will arrive at this address.</p>'});
  } catch (error) {
    back('/admin/notifications' + anchor, {error: `Resend rejected the email: ${error instanceof Error ? error.message : String(error)}`});
  }
  await logActivity(admin, `Sent a test ${kind === 'reply' ? 'automatic reply' : 'notification'}`);
  back('/admin/notifications' + anchor, {notice: 'test'});
}

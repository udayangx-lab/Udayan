import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {mediaDir, uploadsDir} from './db';
import {maxDocumentBytes} from '@/lib/forms';

export type Attachment = {file: string; name: string; type: string; size: number};
type Kind = {ext: string[]; mime: string; matches: (bytes: Buffer) => boolean};

const starts = (bytes: Buffer, signature: number[]) => signature.every((byte, index) => bytes[index] === byte);
const documents: Kind[] = [
  {ext: ['pdf'], mime: 'application/pdf', matches: bytes => starts(bytes, [0x25, 0x50, 0x44, 0x46])},
  {ext: ['docx'], mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', matches: bytes => starts(bytes, [0x50, 0x4b, 0x03, 0x04])},
  {ext: ['doc'], mime: 'application/msword', matches: bytes => starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])},
];
const images: Kind[] = [
  {ext: ['jpg', 'jpeg'], mime: 'image/jpeg', matches: bytes => starts(bytes, [0xff, 0xd8, 0xff])},
  {ext: ['png'], mime: 'image/png', matches: bytes => starts(bytes, [0x89, 0x50, 0x4e, 0x47])},
  {ext: ['webp'], mime: 'image/webp', matches: bytes => bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP'},
];
export const maxImageBytes = 3 * 1024 * 1024;
export const mediaTypes: Record<string, string> = {jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp'};

// Trust the file's contents, not the browser-supplied type: the name must agree with the bytes.
async function inspect(file: File, kinds: Kind[], limit: number, description: string) {
  if (file.size > limit) return {error: `Files must be ${Math.round(limit / 1024 / 1024)} MB or smaller.`} as const;
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  const bytes = Buffer.from(await file.arrayBuffer());
  const kind = kinds.find(item => item.ext.includes(extension) && item.matches(bytes));
  return kind ? {bytes, kind} as const : {error: `Upload ${description}.`} as const;
}

export async function saveDocument(file: File): Promise<Attachment | {error: string}> {
  const result = await inspect(file, documents, maxDocumentBytes, 'a PDF or Word document');
  if ('error' in result) return {error: result.error!};
  const stored = `${randomUUID()}.${result.kind.ext[0]}`;
  await fs.writeFile(path.join(uploadsDir, stored), result.bytes, {flag: 'wx'});
  const name = file.name.replace(/[^\w.\- ()]+/g, '_').slice(-120) || `cv.${result.kind.ext[0]}`;
  return {file: stored, name, type: result.kind.mime, size: file.size};
}

export async function saveImage(file: File): Promise<{path: string} | {error: string}> {
  const result = await inspect(file, images, maxImageBytes, 'a JPG, PNG, or WebP image');
  if ('error' in result) return {error: result.error!};
  const stored = `${randomUUID()}.${result.kind.ext[0]}`;
  await fs.writeFile(path.join(mediaDir, stored), result.bytes, {flag: 'wx'});
  return {path: '/media/' + stored};
}

const storedName = /^[0-9a-f-]{36}\.(pdf|docx|doc|jpg|png|webp)$/;
export async function readStored(directory: 'uploads' | 'media', file: string) {
  if (!storedName.test(file)) return null;
  try {return await fs.readFile(path.join(directory === 'uploads' ? uploadsDir : mediaDir, file));} catch {return null;}
}
export async function removeStored(file: string) {
  if (storedName.test(file)) await fs.unlink(path.join(uploadsDir, file)).catch(() => {});
}

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';

export const field = (formData: FormData, key: string, limit = 300) => String(formData.get(key) ?? '').trim().slice(0, limit);
// The query must come before any #anchor, or the browser treats it as part of the anchor.
export function back(target: string, result: {notice?: string; error?: string} = {}): never {
  const [path, anchor] = target.split('#');
  redirect(`${path}?${new URLSearchParams(result.error ? {error: result.error} : {notice: result.notice || 'saved'})}${anchor ? '#' + anchor : ''}`);
}
export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
export const isWebUrl = (value: string) => {try {return ['https:', 'http:'].includes(new URL(value).protocol);} catch {return false;}};
export const refreshSite = () => revalidatePath('/', 'layout');
export const emailList = (value: string) => [...new Set(value.split(/[\s,;]+/).map(item => item.trim().toLowerCase()).filter(Boolean))];
export const isUpload = (value: FormDataEntryValue | null): value is File => value instanceof File && value.size > 0;

// Photos upload as soon as they are chosen, a few at a time, so no save ever carries more than one image.
const queue: (() => void)[] = [];
let active = 0;
export function limited<T>(task: () => Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const run = () => {active++; task().then(resolve, reject).finally(() => {active--; queue.shift()?.();});};
    if (active < 3) run(); else queue.push(run);
  });
}
export async function uploadImage(file: File) {
  const body = new FormData();
  body.append('file', file);
  const response = await fetch('/admin/upload', {method: 'POST', body});
  const result = await response.json().catch(() => ({error: 'The upload failed. Check your connection and try again.'})) as {path?: string; error?: string};
  if (!response.ok || !result.path) throw new Error(result.error || 'The upload failed.');
  return result.path;
}

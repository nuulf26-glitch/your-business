import { validateMediaFile } from '../media/uploadPolicy.js';
const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');
const active = new WeakMap(), tickets = new WeakMap(), completed = new WeakMap();
async function api(path, body, signal) {
  const response = await fetch(`${baseUrl}/api/v1/uploads${path}`, { method: 'POST', credentials: 'include', signal: signal || AbortSignal.timeout(90000), headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(response.status === 401 ? 'Your session expired. Sign in again; your design is still here.' : (Array.isArray(result.message) ? result.message.join(' ') : result.message) || 'Upload failed. Please retry.');
    error.status = response.status;
    throw error;
  }
  return result;
}
function sendFile(file, ticket, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const abort = () => xhr.abort();
    xhr.open('PUT', ticket.uploadUrl);
    xhr.timeout = 15 * 60 * 1000;
    for (const [key,value] of Object.entries(ticket.headers)) xhr.setRequestHeader(key,value);
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress?.({ phase: 'uploading', percent: Math.round(event.loaded / event.total * 100) }); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Storage rejected this upload. Retry; if it repeats, ask the owner to check bucket permissions, region and CORS.'));
    xhr.onerror = () => reject(new Error('Could not reach media storage. Check your connection and retry. The owner may need to allow staging in bucket CORS.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Check your connection and retry.'));
    xhr.onabort = () => reject(new Error('Upload cancelled. Your design has not been changed.'));
    xhr.onloadend = () => signal?.removeEventListener('abort',abort);
    if (signal?.aborted) { reject(new Error('Upload cancelled.')); return; }
    signal?.addEventListener('abort',abort,{once:true});
    xhr.send(file);
  });
}
export function uploadMedia(file, options = {}) {
  if (completed.has(file)) return Promise.resolve(completed.get(file));
  if (active.has(file)) return active.get(file);
  const work = (async () => {
    validateMediaFile(file);
    const { onProgress, signal } = options;
    let ticket = tickets.get(file);
    if (!ticket || ticket.expiresAt < Date.now()) {
      onProgress?.({phase:'preparing',percent:0});
      const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      const checksum = btoa(String.fromCharCode(...digest));
      ticket = await api('/authorize', {contentType:file.type,size:file.size,checksum},signal);
      ticket.expiresAt = Date.now() + ticket.expiresIn * 1000;
      tickets.set(file,ticket);
    }
    if (!ticket.uploaded) { await sendFile(file,ticket,onProgress,signal); ticket.uploaded = true; }
    onProgress?.({phase:'verifying',percent:100});
    let result;
    try { result = await api(`/complete/${ticket.id}`,{},signal); }
    catch (error) { if (error.status >= 400 && error.status < 500) tickets.delete(file); throw error; }
    tickets.delete(file);
    onProgress?.({phase:'complete',percent:100});
    const url = baseUrl && result.publicUrl.startsWith('/') ? `${baseUrl}${result.publicUrl}` : result.publicUrl;
    completed.set(file,url);
    return url;
  })();
  active.set(file,work);
  work.then(() => active.delete(file),() => active.delete(file));
  return work;
}
export const uploadProductImage = uploadMedia;

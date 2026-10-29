import { MAX_MEDIA_UPLOAD_BYTES, SUPPORTED_MEDIA_TYPES } from '../media/uploadPolicy.js';
const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');
export async function uploadMedia(file) {
  if (!SUPPORTED_MEDIA_TYPES.includes(file.type)) throw new Error('Choose a JPG, PNG, WEBP, GIF, MP4, WEBM or MOV file.');
  if (file.size < 1 || file.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error('Each upload must be 4 MB or smaller on this hosting service. Use a direct HTTPS URL for a larger video.');
  const token = sessionStorage.getItem('getcyb_session_token');
  const response = await fetch(`${baseUrl}/api/v1/uploads`, {method:'POST',credentials:'include',headers:{'Content-Type':file.type,...(token?{Authorization:`Bearer ${token}`}:{})},body:file});
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.message || 'Media upload failed. Please try again.');
  return baseUrl ? `${baseUrl}${result.publicUrl}` : result.publicUrl;
}
export const uploadProductImage = uploadMedia;

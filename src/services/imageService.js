const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');
const allowedTypes = ['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'];
export async function uploadMedia(file) {
  if (!allowedTypes.includes(file.type)) throw new Error('Choose a JPG, PNG, WEBP, GIF, MP4, WEBM or MOV file.');
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Each file must be 5 MB or smaller. Use a direct HTTPS URL for a larger video.');
  const token = sessionStorage.getItem('getcyb_session_token');
  const response = await fetch(`${baseUrl}/api/v1/uploads`, {method:'POST',credentials:'include',headers:{'Content-Type':file.type,...(token?{Authorization:`Bearer ${token}`}:{})},body:file});
  const result=await response.json().catch(()=>({}));
  if (!response.ok) throw new Error(result.message || 'Media upload failed. Please try again.');
  return baseUrl ? `${baseUrl}${result.publicUrl}` : result.publicUrl;
}
export const uploadProductImage = uploadMedia;

const baseUrl = (import.meta.env.VITE_CUSTOM_BACKEND_URL || '').replace(/\/$/, '');

export async function uploadProductImage(file) {
  if (file.size < 1 || file.size > 5 * 1024 * 1024) throw new Error('Images must be 5 MB or smaller.');
  const token = sessionStorage.getItem('getcyb_session_token');
  const response = await fetch(`${baseUrl}/api/v1/uploads`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': file.type, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: file,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.message || 'Image upload failed. Please try again.');
  return result.publicUrl;
}

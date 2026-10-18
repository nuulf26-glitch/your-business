import { auth } from "../firebase";
const BASE = import.meta.env.VITE_FUNCTIONS_BASE_URL || "https://us-central1-your-business-47e44.cloudfunctions.net";
export async function appointmentRequest(action, body = {}, authenticated = false) {
  const headers = { "Content-Type": "application/json" };
  if (authenticated) {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error("Please sign in.");
    headers.Authorization = `Bearer ${await auth.currentUser.getIdToken()}`;
  }
  let response;
  try { response = await fetch(`${BASE}/${action}`, { method: "POST", headers, body: JSON.stringify(body) }); }
  catch { throw new Error("Cannot reach the booking service. Please try again later."); }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "The booking service is unavailable. Please try again later.");
  return data;
}

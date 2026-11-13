export async function checkoutAttemptKey(form, cart, storage = globalThis.localStorage, cryptoApi = globalThis.crypto) {
  if (!storage || !cryptoApi?.subtle) throw new Error("Secure checkout storage is unavailable.");
  const request = JSON.stringify({
    fullName: form.fullName.trim(),
    email: form.email.trim().toLowerCase(),
    phone: form.phone.trim(),
    address: form.address.trim(),
    city: form.city.trim(),
    notes: form.notes.trim(),
    items: cart.map((item) => ({ id: item.id || item.productId, quantity: Number(item.quantity) })),
  });
  const bytes = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(request));
  const fingerprint = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
  let attempt;
  try { attempt = JSON.parse(storage.getItem("storefrontCheckoutAttempt") || "null"); } catch { attempt = null; }
  if (attempt?.fingerprint === fingerprint && /^[A-Za-z0-9_-]{43}$/.test(attempt.key || "")) return attempt.key;

  const nonce = cryptoApi.getRandomValues(new Uint8Array(32));
  const binary = Array.from(nonce, (byte) => String.fromCharCode(byte)).join("");
  const key = btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  storage.setItem("storefrontCheckoutAttempt", JSON.stringify({ fingerprint, key }));
  return key;
}

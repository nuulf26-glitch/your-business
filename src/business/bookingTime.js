export function bookingDate(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value))) return new Date(Number(value));
  return new Date(value);
}

export function bookingStartIso(value) {
  const date = bookingDate(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose an available time.');
  return date.toISOString();
}

export function formatBookingTime(value, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(bookingDate(value));
}

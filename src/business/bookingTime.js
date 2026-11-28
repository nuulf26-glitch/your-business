export function bookingDate(value) {
  if (typeof value === 'number' || (typeof value === 'string' && /^\d{10,13}$/.test(value))) return new Date(Number(value));
  return new Date(value);
}

export function bookingStartIso(value) {
  const date = bookingDate(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Choose an available time.');
  return date.toISOString();
}

function zonedParts(value, formatter) {
  const values = Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) };
}

function sameLocalMinute(left, right) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute;
}

export function businessLocalStartIso(value, timeZone) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value || ''));
  if (!match) throw new Error('Choose a valid business-local date and time.');
  const wanted = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]), hour: Number(match[4]), minute: Number(match[5]) };
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const wallClockUtc = Date.UTC(wanted.year, wanted.month - 1, wanted.day, wanted.hour, wanted.minute);
  const check = new Date(wallClockUtc);
  if (check.getUTCFullYear() !== wanted.year || check.getUTCMonth() + 1 !== wanted.month || check.getUTCDate() !== wanted.day || wanted.hour > 23 || wanted.minute > 59) {
    throw new Error('Choose a valid business-local date and time.');
  }

  // Estimate the UTC instant, then check nearby offsets to handle daylight-saving
  // transitions. For a repeated local time, use its first occurrence; for a skipped
  // local time, explain that it cannot be booked.
  let estimate = wallClockUtc;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actual = zonedParts(estimate, formatter);
    const representedUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    const correction = wallClockUtc - representedUtc;
    estimate += correction;
    if (correction === 0) break;
  }
  const matches = [];
  for (let instant = estimate - 3 * 60 * 60_000; instant <= estimate + 3 * 60 * 60_000; instant += 60_000) {
    if (sameLocalMinute(zonedParts(instant, formatter), wanted)) matches.push(instant);
  }
  if (!matches.length) throw new Error('That local time does not exist because the clocks change. Choose another time.');
  return new Date(Math.min(...matches)).toISOString();
}

export function formatBookingTime(value, timeZone) {
  return new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }).format(bookingDate(value));
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function localParts(date, timeZone) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(date)).map(p => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: WEEKDAYS.indexOf(parts.weekday), minute: Number(parts.hour) * 60 + Number(parts.minute) };
}
function minutes(time) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time || '')) throw new Error('Invalid time');
  const [h, m] = time.split(':').map(Number); return h * 60 + m;
}
function overlap(a, b) { return a.start < b.end && b.start < a.end; }
function active(row) { return !['cancelled', 'completed'].includes(row.status); }
function available(catalog, start, duration, staff) {
  const end = start + duration * 60000;
  const local = localParts(start, catalog.timeZone || 'UTC');
  const last = localParts(end - 1, catalog.timeZone || 'UTC');
  if (local.date !== last.date || catalog.closures?.includes(local.date) || staff?.daysOff?.includes(local.date)) return false;
  const schedules = [catalog.hours?.[local.weekday], ...(staff?.hours ? [staff.hours[local.weekday]] : [])];
  for (const hours of schedules) {
    if (!hours || hours.closed) return false;
    if (local.minute < minutes(hours.open) || local.minute + duration > minutes(hours.close)) return false;
  }
  return !(staff?.breaks || []).some(b => (b.weekday == null || Number(b.weekday) === local.weekday) && overlap({ start: local.minute, end: local.minute + duration }, { start: minutes(b.start), end: minutes(b.end) }));
}
function allocate(catalog, request, bookings, now = Date.now()) {
  const start = Date.parse(request.start);
  if (!Number.isFinite(start) || start < now || start > now + 366 * 86400000) throw new Error('Choose a future time within one year.');
  if (request.kind === 'reservation') {
    const guests = Number(request.guests);
    if (!Number.isInteger(guests) || guests < 1 || guests > 100) throw new Error('Invalid guest count.');
    const duration = Number(catalog.reservationDuration) || 90;
    if (!available(catalog, start, duration)) throw new Error('The restaurant is closed at this time.');
    const end = start + duration * 60000;
    const table = (catalog.tables || []).filter(t => t.active !== false && Number(t.capacity) >= guests).sort((a,b) => a.capacity-b.capacity).find(t => !bookings.some(row => active(row) && row.tableId === t.id && overlap({start,end}, row)));
    if (!table) throw new Error('No table is available. Please choose another time.');
    return { kind: 'reservation', start, end, tableId: table.id, guests, amount: 0 };
  }
  const service = catalog.services?.find(s => s.id === request.serviceId && s.active !== false);
  if (!service) throw new Error('This service is not available.');
  const duration = Number(service.duration);
  if (!Number.isInteger(duration) || duration < 5 || duration > 480) throw new Error('Invalid service duration.');
  const end = start + duration * 60000;
  const staff = (catalog.staff || []).filter(s => s.active !== false && (!request.staffId || request.staffId === s.id) && s.serviceIds?.includes(service.id)).find(s => available(catalog, start, duration, s) && !bookings.some(row => active(row) && row.staffId === s.id && overlap({start,end}, row)));
  if (!staff) throw new Error('No staff member is available. Please choose another time.');
  return { kind: 'appointment', serviceId: service.id, serviceName: service.name, staffId: staff.id, start, end, amount: Number(service.price) || 0 };
}
module.exports = { localParts, minutes, overlap, available, allocate };

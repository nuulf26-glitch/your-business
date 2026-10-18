// Pure calendar rules shared by the HTTP handlers and regression tests.
const DAY_MS = 86400000;
function timeMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || "")) throw new Error("Invalid opening hours.");
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}
function dateInZone(ms, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const p = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}`, year: +p.year, month: +p.month, day: +p.day, hour: +p.hour, minute: +p.minute };
}
function localInstant(date, time, timezone) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const p = dateInZone(instant, timezone);
    const correction = target - Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    if (!correction) break;
    instant += correction;
  }
  const resolved = dateInZone(instant, timezone);
  return resolved.date === date && resolved.time === time ? instant : null;
}
function overlaps(a, b) { return a.startMs < b.endMs && a.endMs > b.startMs; }
function availableSlots(config, serviceId, date, busy = [], now = Date.now()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "") || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) throw new Error("Choose a valid date.");
  const timezone = config?.timezone;
  if (typeof timezone !== "string" || !timezone) throw new Error("Choose a valid business time zone.");
  const today = dateInZone(now, timezone).date;
  if (date < today || Date.parse(`${date}T00:00:00Z`) > Date.parse(`${today}T00:00:00Z`) + 90 * DAY_MS) throw new Error("Choose a date within the next 90 days.");
  const service = config?.services?.find((item) => item.id === serviceId);
  if (!service || !service.name?.trim() || !Number.isInteger(service.duration) || service.duration < 15 || service.duration > 480 || !Number.isFinite(service.price) || service.price < 0) throw new Error("This service is not available.");
  const start = timeMinutes(config.openTime), end = timeMinutes(config.closeTime);
  if (end <= start || ![15, 30, 60].includes(config.interval)) throw new Error("The business must configure valid opening hours.");
  if (!config.openDays?.includes(new Date(`${date}T12:00:00Z`).getUTCDay())) return [];
  const result = [];
  for (let minute = start; minute + service.duration <= end; minute += config.interval) {
    const time = `${String(Math.floor(minute / 60)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`;
    const startMs = localInstant(date, time, timezone);
    const slot = { time, startMs, endMs: startMs + service.duration * 60000 };
    const closing = localInstant(date, config.closeTime, timezone);
    if (startMs !== null && startMs > now && closing !== null && slot.endMs <= closing && !busy.some((item) => overlaps(slot, item))) result.push(slot);
  }
  return result;
}
module.exports = { availableSlots, overlaps, localInstant, dateInZone };

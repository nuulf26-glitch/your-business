const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function BookingFields({ value, onChange }) {
  const config = { timezone: "Asia/Dubai", openDays: [1, 2, 3, 4, 5, 6], openTime: "09:00", closeTime: "18:00", interval: 30, services: [], ...value };
  const change = (patch) => onChange({ ...config, ...patch });
  const updateService = (id, patch) => change({ services: config.services.map((service) => service.id === id ? { ...service, ...patch } : service) });
  return <div className="property-field"><span>Appointment settings</span>
    <label className="property-field"><span>Time zone</span><input value={config.timezone} placeholder="Asia/Dubai" onChange={(e) => change({ timezone: e.target.value })} /></label>
    <div className="property-field"><span>Open days</span>{DAYS.map((day, index) => <label key={day}><input type="checkbox" checked={config.openDays.includes(index)} onChange={(e) => change({ openDays: e.target.checked ? [...config.openDays, index] : config.openDays.filter((d) => d !== index) })} /> {day}</label>)}</div>
    <label className="property-field"><span>Opens</span><input type="time" value={config.openTime} onChange={(e) => change({ openTime: e.target.value })} /></label>
    <label className="property-field"><span>Closes</span><input type="time" value={config.closeTime} onChange={(e) => change({ closeTime: e.target.value })} /></label>
    <label className="property-field"><span>Slot interval (minutes)</span><select value={config.interval} onChange={(e) => change({ interval: Number(e.target.value) })}>{[15, 30, 60].map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
    {config.services.map((service) => <fieldset key={service.id}><legend>Service</legend>
      <label className="property-field"><span>Name</span><input value={service.name} onChange={(e) => updateService(service.id, { name: e.target.value })} /></label>
      <label className="property-field"><span>Duration (minutes)</span><input type="number" min="15" max="480" step="15" value={service.duration} onChange={(e) => updateService(service.id, { duration: Number(e.target.value) })} /></label>
      <label className="property-field"><span>Price (USD)</span><input type="number" min="0" step="0.01" value={service.price} onChange={(e) => updateService(service.id, { price: Number(e.target.value) })} /></label>
      <button className="remove-image" type="button" onClick={() => change({ services: config.services.filter((s) => s.id !== service.id) })}>Remove service</button>
    </fieldset>)}
    <button type="button" className="add-real-product" onClick={() => change({ services: [...config.services, { id: crypto.randomUUID(), name: "New service", duration: 30, price: 0 }] })}>＋ Add service</button>
    <small>Appointments share one calendar. Configure your hours and services, then publish to accept bookings. Customers pay for services separately.</small>
  </div>;
}

export function validateBookingSections(sections) {
  for (const section of sections.filter((item) => item.type === "booking")) {
    const c = section.booking;
    if (!c?.services?.length) throw new Error("Add at least one service in your Booking section before publishing.");
    try { if (!c.timezone) throw new Error(); new Intl.DateTimeFormat("en", { timeZone: c.timezone }).format(); }
    catch { throw new Error("Choose a valid booking time zone, such as Asia/Dubai."); }
    if (!c.openDays?.length || !c.openTime || !c.closeTime || c.openTime >= c.closeTime) throw new Error("Set open days and valid opening hours in your Booking section.");
    if (c.services.some((s) => !s.name.trim() || !Number.isInteger(s.duration) || s.duration < 15 || s.duration > 480 || !Number.isFinite(s.price) || s.price < 0)) throw new Error("Each booking service needs a name, duration of 15–480 minutes and a valid USD price.");
  }
}

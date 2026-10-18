import { useEffect, useRef, useState } from "react";
import { appointmentRequest } from "../services/appointmentService";
import "../styles/appointments.css";
export default function AppointmentForm({ storeUrl, section }) {
  const services = section.booking?.services || [];
  const [serviceId, setServiceId] = useState(services[0]?.id || "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [times, setTimes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const [refresh, setRefresh] = useState(0);
  const requestId = useRef(crypto.randomUUID());
  useEffect(() => {
    let active = true;
    setTimes([]); setTime(""); setLoading(false);
    if (!date || !serviceId) return;
    setLoading(true);
    appointmentRequest("appointmentAvailability", { storeUrl, sectionId: section.id, serviceId, date }).then((data) => { if (active) setTimes(data.times); }).catch((e) => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, serviceId, section.id, storeUrl, refresh]);
  async function submit(event) {
    event.preventDefault();
    if (saving || !time) return;
    const form = new FormData(event.currentTarget);
    setSaving(true); setError("");
    try {
      const data = await appointmentRequest("createAppointment", { storeUrl, sectionId: section.id, date, time, serviceId, requestId: requestId.current, name: form.get("name"), email: form.get("email"), phone: form.get("phone") });
      setReference(data.reference);
    } catch (e) { setError(e.message); setRefresh((n) => n + 1); }
    finally { setSaving(false); }
  }
  if (!services.length) return <div className="published-booking-card"><p>Online booking is not available yet. Please contact the business to arrange an appointment.</p></div>;
  if (reference) return <div className="published-booking-card" role="status"><strong>Appointment requested</strong><p>Your time is reserved while the business reviews your booking.</p><p>Reference: {reference}</p><p>Please keep this reference. Contact the business for changes or confirmation.</p></div>;
  const service = services.find((s) => s.id === serviceId);
  return <form className="published-booking-card cyb-appointment-form" onSubmit={submit}>
    <label>Service<select value={serviceId} onChange={(e) => { requestId.current = crypto.randomUUID(); setServiceId(e.target.value); }} disabled={saving}>{services.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.duration} min · ${Number(s.price).toFixed(2)}</option>)}</select></label>
    <label>Date<input required type="date" value={date} onChange={(e) => { requestId.current = crypto.randomUUID(); setDate(e.target.value); }} disabled={saving} /></label>
    <small>Times shown in {section.booking.timezone}. Book up to 90 days ahead.</small>
    {date && <label>Time<select required value={time} onChange={(e) => { requestId.current = crypto.randomUUID(); setTime(e.target.value); }} disabled={loading || saving}><option value="">{loading ? "Loading times..." : times.length ? "Choose a time" : "No available times"}</option>{times.map((t) => <option key={t}>{t}</option>)}</select></label>}
    <label>Name<input name="name" autoComplete="name" required maxLength={120} disabled={saving} /></label>
    <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} disabled={saving} /></label>
    <label>Phone<input name="phone" type="tel" autoComplete="tel" required maxLength={40} disabled={saving} /></label>
    {error && <p role="alert">{error}</p>}
    <small>{service ? `$${Number(service.price).toFixed(2)} · Pay the business separately.` : ""}</small>
    <button type="submit" disabled={!time || loading || saving}>{saving ? "Reserving..." : section.buttonText || "Request appointment"}</button>
  </form>;
}

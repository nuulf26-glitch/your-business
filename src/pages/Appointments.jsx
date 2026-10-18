import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { appointmentRequest } from "../services/appointmentService";
import "../styles/appointments.css";
export default function Appointments() {
  const [appointments, setAppointments] = useState([]), [error, setError] = useState(""), [loading, setLoading] = useState(true), [filter, setFilter] = useState("All"), [busy, setBusy] = useState("");
  async function load() {
    setLoading(true); setError("");
    try { setAppointments((await appointmentRequest("listAppointments", {}, true)).appointments); }
    catch (e) { setError(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function update(id, status) {
    setBusy(id); setError("");
    try { await appointmentRequest("updateAppointment", { id, status }, true); setAppointments((items) => items.map((a) => a.id === id ? { ...a, status } : a)); }
    catch (e) { setError(e.message); } finally { setBusy(""); }
  }
  return <DashboardLayout><h1>Appointments</h1><p>Review requests, confirm appointments and manage your calendar.</p><p><a href="/editor">Edit services and availability</a></p>
    <label>Status <select value={filter} onChange={(e) => setFilter(e.target.value)}>{["All", "Pending", "Confirmed", "Cancelled", "Completed"].map((s) => <option key={s}>{s}</option>)}</select></label>
    {error && <p role="alert">{error} <button onClick={load}>Retry</button></p>}
    {loading ? <p>Loading appointments...</p> : <div className="cyb-appointments-list">{appointments.filter((a) => filter === "All" || a.status === filter).map((a) => <article key={a.id}><h2>{a.serviceName}</h2><p>{a.date} at {a.time} · {a.timezone} · {a.duration} min · ${Number(a.price).toFixed(2)}</p><p>{a.name} · <a href={`mailto:${a.email}`}>{a.email}</a> · {a.phone}</p><strong>{a.status}</strong>{!["Cancelled", "Completed"].includes(a.status) && <div>{a.status === "Pending" && <button disabled={busy === a.id} onClick={() => update(a.id, "Confirmed")}>Confirm</button>}<button disabled={busy === a.id} onClick={() => update(a.id, "Completed")}>Mark completed</button><button disabled={busy === a.id} onClick={() => update(a.id, "Cancelled")}>Cancel appointment</button></div>}</article>)}{!appointments.length && !error && <p>No appointments yet. Add services and hours in your Booking section, then publish your website.</p>}</div>}
  </DashboardLayout>;
}

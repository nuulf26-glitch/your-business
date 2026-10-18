const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { availableSlots, overlaps } = require("./lib/booking");
const db = getFirestore();
function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function endpoint(handler) {
  return onRequest({ cors: true, maxInstances: 10 }, async (req, res) => {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed." });
    try { res.json(await handler(req)); }
    catch (error) { console.error("Appointment request failed:", error.message); res.status(error.status || 400).json({ message: error.status ? error.message : "Appointments could not be loaded. Please check the service settings and try again." }); }
  });
}
async function owner(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer /, "");
  try { return (await getAuth().verifyIdToken(token)).uid; } catch { fail("Please sign in.", 401); }
}
async function publicStore(body) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.storeUrl || "")) fail("Invalid website address.");
  const snapshot = await db.collection("stores").where("storeUrl", "==", body.storeUrl).limit(1).get();
  if (snapshot.empty) fail("Website not found.", 404);
  const storeDoc = snapshot.docs[0];
  const store = storeDoc.data();
  if (!store.published) fail("This website is not accepting bookings.", 404);
  const section = store.editorData?.sections?.find((s) => s.type === "booking" && s.id === body.sectionId);
  if (!section?.booking) fail("Booking has not been configured yet.");
  return { storeDoc, store, section };
}
function calendarKeys(storeId, slots) {
  return [...new Set(slots.flatMap((slot) => [slot.startMs, slot.endMs - 1].map((ms) => `${storeId}_${new Date(ms).toISOString().slice(0, 10)}`)))];
}
exports.appointmentAvailability = endpoint(async (req) => {
  const { storeDoc, section } = await publicStore(req.body || {});
  const { date, serviceId } = req.body;
  // Validate before using the date in a document path.
  const slots = availableSlots(section.booking, serviceId, date);
  const days = await Promise.all(calendarKeys(storeDoc.id, slots).map((key) => db.collection("appointmentDays").doc(key).get()));
  const busy = days.flatMap((day) => day.data()?.reservations || []);
  return { times: slots.filter((slot) => !busy.some((item) => overlaps(slot, item))).map((slot) => slot.time) };
});
exports.createAppointment = endpoint(async (req) => {
  const body = req.body || {};
  const { storeDoc } = await publicStore(body);
  const { date, time, serviceId, requestId } = body;
  if (!/^[a-zA-Z0-9-]{20,80}$/.test(requestId || "")) fail("Invalid booking request.");
  const name = String(body.name || "").trim(), email = String(body.email || "").trim().toLowerCase(), phone = String(body.phone || "").trim();
  if (!name || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 40 || !phone) fail("Please enter your name, a valid email and phone number.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) fail("Invalid date.");
  const appointmentRef = db.collection("appointments").doc(`${storeDoc.id}_${requestId}`);
  await db.runTransaction(async (transaction) => {
    const [current, liveStore] = await Promise.all([transaction.get(appointmentRef), transaction.get(storeDoc.ref)]);
    if (current.exists) {
      if (current.data().email === email && current.data().date === date && current.data().time === time && current.data().serviceId === serviceId) return;
      fail("Please start a new booking request.");
    }
    const store = liveStore.data();
    const config = store?.published && store.editorData?.sections?.find((s) => s.type === "booking" && s.id === body.sectionId)?.booking;
    if (!config) fail("This service is no longer available.");
    const slot = availableSlots(config, serviceId, date).find((item) => item.time === time);
    if (!slot) fail("That time is no longer available. Please choose another time.", 409);
    const dayKeys = calendarKeys(storeDoc.id, [slot]);
    const dayRefs = dayKeys.map((key) => db.collection("appointmentDays").doc(key));
    const days = await Promise.all(dayRefs.map((ref) => transaction.get(ref)));
    if (days.some((day) => (day.data()?.reservations || []).some((item) => overlaps(slot, item)))) fail("That time is no longer available. Please choose another time.", 409);
    const service = config.services.find((s) => s.id === serviceId);
    days.forEach((day, index) => transaction.set(dayRefs[index], { userId: store.userId || storeDoc.id, reservations: [...(day.data()?.reservations || []), { id: appointmentRef.id, startMs: slot.startMs, endMs: slot.endMs }] }));
    transaction.create(appointmentRef, { userId: store.userId || storeDoc.id, storeUrl: body.storeUrl, sectionId: body.sectionId, dayKeys, serviceId, serviceName: service.name, duration: service.duration, price: service.price, currency: "USD", timezone: config.timezone, date, time, startMs: slot.startMs, endMs: slot.endMs, name, email, phone, status: "Pending", createdAt: FieldValue.serverTimestamp() });
  });
  return { success: true, reference: requestId };
});
exports.listAppointments = endpoint(async (req) => {
  const uid = await owner(req);
  const snapshot = await db.collection("appointments").where("userId", "==", uid).get();
  return { appointments: snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data(), createdAt: doc.data().createdAt?.toDate()?.toISOString() || null })).sort((a, b) => a.startMs - b.startMs) };
});
exports.updateAppointment = endpoint(async (req) => {
  const uid = await owner(req);
  const { id, status } = req.body || {};
  if (!/^[a-zA-Z0-9_-]{20,200}$/.test(id || "") || !["Confirmed", "Cancelled", "Completed"].includes(status)) fail("Invalid appointment update.");
  const ref = db.collection("appointments").doc(id);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(ref), appointment = doc.data();
    if (!appointment || appointment.userId !== uid) fail("Appointment not found.", 404);
    if (["Cancelled", "Completed"].includes(appointment.status)) fail("This appointment is already closed.");
    const storeId = id.slice(0, id.lastIndexOf("_"));
    const dayRefs = (appointment.dayKeys || [`${storeId}_${appointment.date}`]).map((key) => db.collection("appointmentDays").doc(key));
    const days = await Promise.all(dayRefs.map((dayRef) => transaction.get(dayRef)));
    if (status === "Cancelled") days.forEach((day, index) => transaction.set(dayRefs[index], { userId: uid, reservations: (day.data()?.reservations || []).filter((r) => r.id !== id) }));
    transaction.update(ref, { status, updatedAt: FieldValue.serverTimestamp() });
  });
  return { success: true };
});

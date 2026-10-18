const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const { dateInZone } = require("../lib/booking");
// Exercise the actual HTTP handlers with a serialized transactional datastore.
function harness() {
  const records = new Map(); let queue = Promise.resolve();
  const snapshot = (id) => ({ id, ref: ref(id), exists: records.has(id), data: () => structuredClone(records.get(id)) });
  function ref(id) { return { id: id.split("/").pop(), key: id, get: async () => snapshot(id) }; }
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`), where: (field, op, value) => ({ limit() { return this; }, async get() { const docs = [...records].filter(([key, data]) => key.startsWith(`${name}/`) && data[field] === value).map(([key]) => ({ ...snapshot(key), id: key.split("/").pop() })); return { empty: !docs.length, docs }; } }) }),
    runTransaction: (work) => {
      const next = queue.then(async () => {
        const writes = [];
        const result = await work({ get: (r) => Promise.resolve(snapshot(r.key)), set: (r, data) => writes.push(() => records.set(r.key, structuredClone(data))), create: (r, data) => writes.push(() => { assert.equal(records.has(r.key), false); records.set(r.key, structuredClone(data)); }), update: (r, data) => writes.push(() => records.set(r.key, { ...records.get(r.key), ...structuredClone(data) })) });
        writes.forEach((write) => write()); return result;
      });
      queue = next.catch(() => {}); return next;
    },
  };
  const exports = {};
  vm.runInNewContext(fs.readFileSync(require.resolve("../appointments"), "utf8"), { exports, console: { error() {} }, require: (name) => {
    if (name === "firebase-functions/v2/https") return { onRequest: (options, handler) => handler };
    if (name === "firebase-admin/firestore") return { getFirestore: () => db, FieldValue: { serverTimestamp: () => null } };
    if (name === "firebase-admin/auth") return { getAuth: () => ({ verifyIdToken: async (token) => { if (!token) throw Error("unauthorized"); return { uid: token }; } }) };
    return require(name === "./lib/booking" ? "../lib/booking" : name);
  } });
  async function call(name, body, uid) {
    const result = { statusCode: 200 };
    await exports[name]({ method: "POST", body, headers: uid ? { authorization: `Bearer ${uid}` } : {} }, { status(code) { result.statusCode = code; return this; }, json(data) { result.body = data; } });
    return result;
  }
  const date = dateInZone(Date.now() + 86400000, "Asia/Dubai").date;
  const config = { timezone: "Asia/Dubai", openDays: [0, 1, 2, 3, 4, 5, 6], openTime: "09:00", closeTime: "17:00", interval: 30, services: [{ id: "cut", name: "Haircut", duration: 60, price: 45 }] };
  records.set("stores/owner", { userId: "owner", storeUrl: "salon", published: true, editorData: { sections: [{ id: "book", type: "booking", booking: config }] } });
  const body = { storeUrl: "salon", sectionId: "book", serviceId: "cut", date, time: "10:00", name: "Customer", email: "customer@example.com", phone: "+971555555555", requestId: "12345678-1234-1234-1234-123456789012" };
  return { call, body, records };
}
test("concurrent requests cannot double-book; retries are idempotent; cancellation releases the slot", async () => {
  const { call, body, records } = harness();
  const [first, second] = await Promise.all([call("createAppointment", body), call("createAppointment", { ...body, requestId: "22345678-1234-1234-1234-123456789012" })]);
  assert.equal(first.statusCode, 200); assert.equal(second.statusCode, 409);
  assert.equal((await call("createAppointment", body)).statusCode, 200);
  assert.equal([...records.keys()].filter((k) => k.startsWith("appointments/")).length, 1);
  const id = `owner_${body.requestId}`;
  assert.equal((await call("updateAppointment", { id, status: "Cancelled" }, "other-owner")).statusCode, 404);
  assert.equal((await call("listAppointments", {})).statusCode, 401);
  assert.equal((await call("listAppointments", {}, "other-owner")).body.appointments.length, 0);
  assert.equal((await call("updateAppointment", { id, status: "Confirmed" }, "owner")).statusCode, 200);
  assert.equal((await call("updateAppointment", { id, status: "Cancelled" }, "owner")).statusCode, 200);
  const availability = await call("appointmentAvailability", body);
  assert.equal(availability.body.times.includes("10:00"), true);
  assert.equal(JSON.stringify(availability.body).includes(body.email), false);
});
test("unpublished websites, unknown services and invalid contact details cannot create appointments", async () => {
  const { call, body, records } = harness();
  assert.equal((await call("createAppointment", { ...body, email: "invalid" })).statusCode, 400);
  assert.notEqual((await call("createAppointment", { ...body, serviceId: "unknown" })).statusCode, 200);
  records.get("stores/owner").published = false;
  assert.equal((await call("createAppointment", body)).statusCode, 404);
});
test("a different timezone cannot bypass reservations in the shared calendar", async () => {
  const { call, body, records } = harness();
  assert.equal((await call("createAppointment", body)).statusCode, 200);
  const section = structuredClone(records.get("stores/owner").editorData.sections[0]);
  section.id = "second";
  section.booking.timezone = "Asia/Tokyo";
  records.get("stores/owner").editorData.sections.push(section);
  // 15:00 Tokyo is the same instant as 10:00 Dubai.
  const conflicting = await call("createAppointment", { ...body, sectionId: "second", time: "15:00", requestId: "32345678-1234-1234-1234-123456789012" });
  assert.equal(conflicting.statusCode, 409);
});

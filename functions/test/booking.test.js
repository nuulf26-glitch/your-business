const { test } = require("node:test");
const assert = require("node:assert/strict");
const { availableSlots, localInstant, overlaps } = require("../lib/booking");
const config = { timezone: "Asia/Dubai", openDays: [1, 2, 3, 4, 5], openTime: "09:00", closeTime: "12:00", interval: 30, services: [{ id: "cut", name: "Haircut", duration: 60, price: 45 }] };
const now = Date.parse("2026-10-18T00:00:00Z");
test("service duration fits before closing and times use the business timezone", () => {
  const slots = availableSlots(config, "cut", "2026-10-19", [], now);
  assert.deepEqual(slots.map((s) => s.time), ["09:00", "09:30", "10:00", "10:30", "11:00"]);
  assert.equal(new Date(slots[0].startMs).toISOString(), "2026-10-19T05:00:00.000Z");
});
test("overlapping services are blocked while back-to-back services stay available", () => {
  const booked = { startMs: Date.parse("2026-10-19T05:30:00Z"), endMs: Date.parse("2026-10-19T06:30:00Z") };
  assert.deepEqual(availableSlots(config, "cut", "2026-10-19", [booked], now).map((s) => s.time), ["10:30", "11:00"]);
  assert.equal(overlaps(booked, { startMs: booked.endMs, endMs: booked.endMs + 60000 }), false);
});
test("closed days, past times, invalid dates and out-of-range requests are rejected", () => {
  assert.deepEqual(availableSlots(config, "cut", "2026-10-18", [], now), []);
  assert.deepEqual(availableSlots(config, "cut", "2026-10-19", [], Date.parse("2026-10-19T06:00:00Z")).map((s) => s.time), ["10:30", "11:00"]);
  for (const date of ["2026-02-30", "2026-10-17", "2027-10-19", "../../stores"]) assert.throws(() => availableSlots(config, "cut", date, [], now));
  assert.throws(() => availableSlots(config, "missing", "2026-10-19", [], now));
});
test("daylight saving gaps do not create nonexistent appointments", () => {
  assert.equal(localInstant("2027-03-14", "02:30", "America/New_York"), null);
  assert.equal(new Date(localInstant("2027-03-14", "03:30", "America/New_York")).toISOString(), "2027-03-14T07:30:00.000Z");
});
test("invalid service duration, price, timezone and hours fail closed", () => {
  for (const override of [{ timezone: "bad/zone" }, { closeTime: "08:00" }, { interval: 0 }, { services: [{ ...config.services[0], duration: -1 }] }, { services: [{ ...config.services[0], price: -5 }] }]) assert.throws(() => availableSlots({ ...config, ...override }, "cut", "2026-10-19", [], now));
});

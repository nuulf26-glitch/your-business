import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingDate, bookingStartIso, businessLocalStartIso, formatBookingTime } from '../src/business/bookingTime.js';

test('booking slot ISO timestamps format in the business timezone and remain the same instant', () => {
  const start = '2026-12-03T16:30:00.000Z';
  assert.equal(formatBookingTime(start, 'Asia/Dubai'), '8:30 PM');
  assert.equal(bookingStartIso(start), start);
});

test('booking time helper keeps compatibility with epoch millisecond values', () => {
  const start = Date.parse('2026-12-03T16:30:00.000Z');
  assert.equal(bookingDate(start).toISOString(), '2026-12-03T16:30:00.000Z');
  assert.equal(bookingStartIso(String(start)), '2026-12-03T16:30:00.000Z');
});

test('invalid booking selections fail before a request is sent', () => {
  assert.throws(() => bookingStartIso('not-a-time'), /Choose an available time/);
});

test('business-local booking times are converted using the business timezone, not the device timezone', () => {
  const start = businessLocalStartIso('2026-12-03T20:30', 'Asia/Dubai');
  assert.equal(start, '2026-12-03T16:30:00.000Z');
  assert.equal(formatBookingTime(start, 'Asia/Dubai'), '8:30 PM');
});

test('a daylight-saving fold uses the first occurrence and a gap is rejected', () => {
  assert.equal(businessLocalStartIso('2026-11-01T01:30', 'America/New_York'), '2026-11-01T05:30:00.000Z');
  assert.throws(() => businessLocalStartIso('2026-03-08T02:30', 'America/New_York'), /does not exist/);
});

test('invalid local dates and time zones fail clearly', () => {
  assert.throws(() => businessLocalStartIso('2026-02-30T09:00', 'UTC'), /valid business-local/);
  assert.throws(() => businessLocalStartIso('2026-12-03T09:00', 'Not/A_Zone'));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { bookingDate, bookingStartIso, formatBookingTime } from '../src/business/bookingTime.js';

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

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allocate, localParts } = require('../functions/availability.cjs');
const start = '2027-01-04T06:00:00Z'; // Monday, 10 AM Dubai
const now = Date.parse('2027-01-01');
const catalog = { timeZone: 'Asia/Dubai', hours: { 1: { open: '09:00', close: '18:00' } }, services: [{ id:'cut', name:'Haircut', price:35, duration:60 }], staff: [{ id:'a', serviceIds:['cut'] }, { id:'b', serviceIds:['cut'] }], tables:[{ id:'small', capacity:2 },{ id:'large', capacity:4 }] };
test('timezone conversion is explicit', () => assert.equal(localParts(start, catalog.timeZone).minute, 600));
test('any-staff allocation skips conflicting staff', () => {
  const first = allocate(catalog, { start, serviceId:'cut' }, [], now);
  const second = allocate(catalog, { start, serviceId:'cut' }, [first], now);
  assert.notEqual(first.staffId, second.staffId);
  assert.throws(() => allocate(catalog, { start, serviceId:'cut' }, [first, second], now));
});
test('requested staff cannot be double booked but adjacent slots are valid', () => {
  const first = allocate(catalog, { start, serviceId:'cut', staffId:'a' }, [], now);
  assert.throws(() => allocate(catalog, { start, serviceId:'cut', staffId:'a' }, [first], now));
  assert.equal(allocate(catalog, { start:'2027-01-04T07:00:00Z', serviceId:'cut', staffId:'a' }, [first], now).staffId, 'a');
});
test('closures, days off, breaks and closing times prevent appointments', () => {
  assert.throws(() => allocate({ ...catalog, closures:['2027-01-04'] }, { start, serviceId:'cut' }, [], now));
  assert.throws(() => allocate({ ...catalog, staff:[{ ...catalog.staff[0], breaks:[{ start:'10:00', end:'11:00' }] }] }, { start, serviceId:'cut' }, [], now));
  assert.throws(() => allocate(catalog, { start:'2027-01-04T13:30:00Z', serviceId:'cut' }, [], now));
});
test('restaurant capacity and table conflicts are enforced', () => {
  const first = allocate(catalog, { kind:'reservation', start, guests:3 }, [], now);
  assert.equal(first.tableId, 'large');
  assert.throws(() => allocate(catalog, { kind:'reservation', start, guests:3 }, [first], now));
  assert.equal(allocate(catalog, { kind:'reservation', start, guests:2 }, [first], now).tableId, 'small');
});
test('cancelled appointments release capacity; invalid and past times fail', () => {
  const first = allocate(catalog, { start, serviceId:'cut', staffId:'a' }, [], now);
  assert.equal(allocate(catalog, { start, serviceId:'cut', staffId:'a' }, [{ ...first, status:'cancelled' }], now).staffId, 'a');
  assert.throws(() => allocate(catalog, { start:'invalid', serviceId:'cut' }, [], now));
  assert.throws(() => allocate(catalog, { start:'2026-01-01', serviceId:'cut' }, [], now));
});
test('staff schedule cannot extend business opening hours and inactive tables are excluded',()=>{
 const custom={...catalog,staff:[{...catalog.staff[0],hours:{1:{open:'07:00',close:'23:00'}}}]};
 assert.throws(()=>allocate(custom,{start:'2027-01-04T04:00:00Z',serviceId:'cut'},[],now));
 assert.throws(()=>allocate({...catalog,tables:[{id:'large',capacity:4,active:false}]},{kind:'reservation',start,guests:3},[],now));
});

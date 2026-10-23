const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { allocate, localParts } = require('./availability.cjs');
const db = () => getFirestore();
function uid(request) { if (!request.auth) throw new HttpsError('unauthenticated','Please sign in.'); return request.auth.uid; }
function text(value, max = 200) { return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
async function ownerForSlug(slug) {
  if (!/^[a-z0-9-]{1,100}$/.test(slug || '')) throw new HttpsError('invalid-argument','Invalid website address.');
  const stores = await db().collection('stores').where('storeUrl','==',slug).limit(2).get();
  if (stores.size !== 1 || stores.docs[0].data().published === false) throw new HttpsError('not-found','Website not available.');
  return stores.docs[0].id;
}
exports.businessCatalog = onCall(async request => {
  const ownerId = request.data?.storeUrl ? await ownerForSlug(request.data.storeUrl) : uid(request);
  const snap = await db().doc(`businessCatalogs/${ownerId}`).get();
  return snap.exists ? snap.data() : null;
});
exports.saveBusinessCatalog = onCall(async request => {
  const ownerId = uid(request); const data = request.data || {};
  const allowedCategories = ['salon','restaurant','store','services','portfolio','general'];
  if (!allowedCategories.includes(data.businessCategory)) throw new HttpsError('invalid-argument','Choose a business category.');
  try { localParts(Date.now(), data.timeZone); } catch { throw new HttpsError('invalid-argument','Choose a valid timezone.'); }
  const clean = { businessCategory: data.businessCategory, timeZone: data.timeZone, reservationDuration: Math.max(15,Math.min(240,Number(data.reservationDuration)||90)), hours: {}, closures: [], takeawayEnabled:data.takeawayEnabled === true, analyticsEnabled:data.analyticsEnabled === true, updatedAt: FieldValue.serverTimestamp() };
  for (let day=0; day<7; day++) {
    const h = data.hours?.[day];
    if (!h || h.closed) { clean.hours[day] = { closed:true }; continue; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close) || h.open >= h.close) throw new HttpsError('invalid-argument','Opening hours must end after they start.');
    clean.hours[day] = { open:h.open, close:h.close, closed:false };
  }
  clean.closures = (data.closures || []).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(0,366);
  for (const type of ['services','staff','menu','tables','projects']) {
    if (!Array.isArray(data[type] || [] ) || (data[type] || []).length > 150) throw new HttpsError('invalid-argument','Too many items.');
    clean[type] = (data[type] || []).map(row => {
      const item = { id:text(row.id,80), name:text(row.name,120), description:text(row.description,3000), image:text(row.image,1000), active:row.active !== false };
      if (!item.id || !item.name) throw new HttpsError('invalid-argument','Every item needs a name.');
      if (item.image && !/^https:\/\//.test(item.image)) throw new HttpsError('invalid-argument','Use an HTTPS image URL.');
      if (type === 'services' || type === 'menu') item.price = Math.max(0,Math.min(1000000,Number(row.price)||0));
      if (type === 'services') item.duration = Math.max(5,Math.min(480,Math.round(Number(row.duration)||30)));
      if (type === 'menu') { item.category=text(row.category); item.allergens=text(row.allergens,1000); }
      if (type === 'staff') { item.serviceIds = (row.serviceIds || []).filter(id => typeof id === 'string').slice(0,150); item.daysOff=(row.daysOff || []).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day)).slice(0,366);
        if(row.hours){ item.hours={}; for(let day=0;day<7;day++){ const h=row.hours[day]; if(!h || h.closed){ item.hours[day]={closed:true};continue; } if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.open)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(h.close)||h.open>=h.close)throw new HttpsError('invalid-argument','Check staff working hours.'); item.hours[day]={open:h.open,close:h.close,closed:false}; } }
        item.breaks=(row.breaks||[]).slice(0,30).map(b=>{ if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.end)||b.start>=b.end)throw new HttpsError('invalid-argument','Check staff break times.'); return {start:b.start,end:b.end}; }); }
      if (type === 'tables') item.capacity = Math.max(1,Math.min(100,Math.round(Number(row.capacity)||2)));
      return item;
    });
    if (new Set(clean[type].map(row => row.id)).size !== clean[type].length) throw new HttpsError('invalid-argument','Duplicate item IDs.');
  }
  await db().runTransaction(async tx => {
    const config = db().doc(`businessCatalogs/${ownerId}`);
    await tx.get(config);
    tx.set(config, clean);
    tx.set(db().doc(`stores/${ownerId}`), { businessCategory:clean.businessCategory }, { merge:true });
  });
  return { success:true };
});
async function bookingRequest(request) {
  const data = request.data || {}; const ownerId = await ownerForSlug(data.storeUrl);
  const name = text(data.name,120), email = text(data.email,254), phone = text(data.phone,40);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument','Enter your name and a valid email.');
  const ref = db().collection(`businessPrivate/${ownerId}/bookings`).doc();
  // A per-business/day ledger serializes concurrent allocations. Transaction retries recompute availability.
  const catalogRef = db().doc(`businessCatalogs/${ownerId}`);
  let result;
  try {
    result = await db().runTransaction(async tx => {
      const config = await tx.get(catalogRef);
      if (!config.exists) throw new Error('Online booking is not configured.');
      const catalog = config.data();
      const start = Date.parse(data.start);
      if (!Number.isFinite(start)) throw new Error('Choose a valid date.');
      const date = localParts(start,catalog.timeZone).date;
      const ledgerRef = db().doc(`businessPrivate/${ownerId}/days/${date}`);
      const ledger = await tx.get(ledgerRef);
      const rows = ledger.data()?.bookings || [];
      if (rows.length > 1000) throw new Error('Please contact the business to book.');
      const slot = allocate(catalog,data,rows);
      const row = { ...slot, id:ref.id, name,email,phone,status:'confirmed', createdAt:FieldValue.serverTimestamp() };
      tx.set(ref,{ ...row,date });
      if(catalog.analyticsEnabled)tx.set(db().doc(`businessPrivate/${ownerId}/analytics/${new Date().toISOString().slice(0,10)}`),{date:new Date().toISOString().slice(0,10),bookings:FieldValue.increment(1)},{merge:true});
      tx.set(ledgerRef, { bookings:[...rows,{ ...slot,id:ref.id,status:'confirmed' }] });
      tx.set(db().doc(`businessPrivate/${ownerId}/notifications/${ref.id}`), { type:slot.kind, message:`New ${slot.kind}: ${name}`, createdAt:FieldValue.serverTimestamp(),read:false });
      return { id:ref.id, start:slot.start,end:slot.end,status:'confirmed',timeZone:catalog.timeZone };
    });
  } catch(error) { throw new HttpsError('failed-precondition',error.message); }
  return result;
}
exports.createBooking = onCall({ enforceAppCheck:true },bookingRequest);
exports.createOwnerBooking = onCall(async request => {
  const ownerId=uid(request);
  if(await ownerForSlug(request.data?.storeUrl)!==ownerId) throw new HttpsError('permission-denied','This website does not belong to you.');
  return bookingRequest(request);
});
exports.businessRecords = onCall(async request => {
  const ownerId=uid(request); const type=request.data?.type;
  if (!['bookings','inquiries','notifications','pickupOrders'].includes(type)) throw new HttpsError('invalid-argument','Invalid record type.');
  const rows=await db().collection(`businessPrivate/${ownerId}/${type}`).orderBy('createdAt','desc').limit(300).get();
  return rows.docs.map(row => ({ ...row.data(),id:row.id,createdAt:row.data().createdAt?.toDate().toISOString() }));
});
exports.updateBooking = onCall(async request => {
  const ownerId=uid(request); const { id,status }=request.data || {};
  if (!/^[a-zA-Z0-9]{1,80}$/.test(id || '') || !['confirmed','completed','cancelled'].includes(status)) throw new HttpsError('invalid-argument','Invalid update.');
  await db().runTransaction(async tx => {
    const ref=db().doc(`businessPrivate/${ownerId}/bookings/${id}`); const record=await tx.get(ref);
    if (!record.exists) throw new HttpsError('not-found','Booking not found.');
    const ledgerRef=db().doc(`businessPrivate/${ownerId}/days/${record.data().date}`); const ledger=await tx.get(ledgerRef);
    const rows=(ledger.data()?.bookings || []).map(row => row.id===id ? { ...row,status } : row);
    if (record.data().status==='cancelled' && status!=='cancelled') throw new HttpsError('failed-precondition','Create a new booking after cancellation.');
    tx.update(ref,{ status }); tx.set(ledgerRef,{ bookings:rows });
  });
  return { success:true };
});
exports.submitInquiry = onCall({ enforceAppCheck:true }, async request => {
  const data=request.data || {}; const ownerId=await ownerForSlug(data.storeUrl);
  const name=text(data.name,120),email=text(data.email,254),message=text(data.message,4000);
  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError('invalid-argument','Complete the required fields.');
  const ref=db().collection(`businessPrivate/${ownerId}/inquiries`).doc();
  const analyticsConfig=await db().doc(`businessCatalogs/${ownerId}`).get();
  const batch=db().batch();
  if(analyticsConfig.data()?.analyticsEnabled)batch.set(db().doc(`businessPrivate/${ownerId}/analytics/${new Date().toISOString().slice(0,10)}`),{date:new Date().toISOString().slice(0,10),inquiries:FieldValue.increment(1)},{merge:true});
  batch.set(ref,{ name,email,message,formId:text(data.formId,100),status:'new',createdAt:FieldValue.serverTimestamp() });
  batch.set(db().doc(`businessPrivate/${ownerId}/notifications/${ref.id}`),{ type:'inquiry',message:`New inquiry: ${name}`,createdAt:FieldValue.serverTimestamp(),read:false });
  await batch.commit(); return { id:ref.id };
});
exports.bookingOptions = onCall({ enforceAppCheck:true }, async request => {
  const data=request.data || {}; const ownerId=await ownerForSlug(data.storeUrl);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date || '')) throw new HttpsError('invalid-argument','Choose a date.');
  const config=await db().doc(`businessCatalogs/${ownerId}`).get();
  if (!config.exists) return [];
  const catalog=config.data();
  const ledger=await db().doc(`businessPrivate/${ownerId}/days/${data.date}`).get();
  const rows=ledger.data()?.bookings || [];
  const midnight=Date.parse(`${data.date}T00:00:00Z`); const slots=[]; const now=Date.now();
  if (midnight < now-2*86400000 || midnight > now+366*86400000) return [];
  for(let offset=-14*60;offset<38*60;offset+=15){
    const instant=midnight+offset*60000;
    if(localParts(instant,catalog.timeZone).date!==data.date) continue;
    try { const slot=allocate(catalog,{ ...data,start:new Date(instant).toISOString() },rows,now); slots.push({ start:slot.start, end:slot.end }); } catch { /* Unavailable slots are omitted; no private details leave the server. */ }
  }
  return slots;
});
const { pickupOrder,orderTransition } = require('./orderPolicy.cjs');
exports.createPickupOrder = onCall({ enforceAppCheck:true }, async request => {
  const data=request.data||{};const ownerId=await ownerForSlug(data.storeUrl);
  const name=text(data.name,120),email=text(data.email,254),phone=text(data.phone,40);
  if(!name||!phone||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new HttpsError('invalid-argument','Add your name, email and phone.');
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(data.requestId||''))throw new HttpsError('invalid-argument','Invalid request reference.');
  const ref=db().doc(`businessPrivate/${ownerId}/pickupOrders/${data.requestId}`);
  return db().runTransaction(async tx=>{
    const existing=await tx.get(ref);
    if(existing.exists){if(existing.data().email!==email)throw new HttpsError('already-exists','Request reference is already used.');return {id:ref.id,total:existing.data().total,status:existing.data().status};}
    const config=await tx.get(db().doc(`businessCatalogs/${ownerId}`));
    if(!config.exists)throw new HttpsError('failed-precondition','Takeaway is not configured.');
    let order;try{order=pickupOrder(config.data(),data);if(!require('./availability.cjs').available(config.data(),order.pickupAt,1))throw Error('Choose a pickup time during opening hours.');}catch(error){throw new HttpsError('invalid-argument',error.message);}
    if(config.data().analyticsEnabled)tx.set(db().doc(`businessPrivate/${ownerId}/analytics/${new Date().toISOString().slice(0,10)}`),{date:new Date().toISOString().slice(0,10),orders:FieldValue.increment(1)},{merge:true});
    tx.set(ref,{...order,name,email,phone,createdAt:FieldValue.serverTimestamp()});
    tx.set(db().doc(`businessPrivate/${ownerId}/notifications/${ref.id}`),{type:'pickup',message:`New pickup order: ${name}`,createdAt:FieldValue.serverTimestamp(),read:false});
    return {id:ref.id,total:order.total,status:order.status};
  });
});
exports.updatePickupOrder = onCall(async request=>{
  const ownerId=uid(request),{id,status}=request.data||{};
  if(!/^[a-zA-Z0-9-]{16,80}$/.test(id||''))throw new HttpsError('invalid-argument','Invalid order.');
  await db().runTransaction(async tx=>{const ref=db().doc(`businessPrivate/${ownerId}/pickupOrders/${id}`);const snap=await tx.get(ref);if(!snap.exists)throw new HttpsError('not-found','Order not found.');try{orderTransition(snap.data().status,status);}catch(error){throw new HttpsError('failed-precondition',error.message);}tx.update(ref,{status});});
  return {success:true};
});
exports.rescheduleBooking=onCall(async request=>{
 const ownerId=uid(request),data=request.data||{};
 if(!/^[a-zA-Z0-9]{1,80}$/.test(data.id||''))throw new HttpsError('invalid-argument','Invalid booking.');
 const start=Date.parse(data.start);if(!Number.isFinite(start))throw new HttpsError('invalid-argument','Choose a date and time.');
 const ref=db().doc(`businessPrivate/${ownerId}/bookings/${data.id}`);
 await db().runTransaction(async tx=>{
  const record=await tx.get(ref),config=await tx.get(db().doc(`businessCatalogs/${ownerId}`));
  if(!record.exists||!config.exists)throw new HttpsError('not-found','Booking not found.');
  const row=record.data(),catalog=config.data();if(row.status!=='confirmed')throw new HttpsError('failed-precondition','Only confirmed bookings can be rescheduled.');
  const date=localParts(start,catalog.timeZone).date;
  const oldRef=db().doc(`businessPrivate/${ownerId}/days/${row.date}`),newRef=db().doc(`businessPrivate/${ownerId}/days/${date}`);
  const oldLedger=await tx.get(oldRef),newLedger=date===row.date?oldLedger:await tx.get(newRef);
  let slot;try{slot=allocate(catalog,{kind:row.kind,start:data.start,serviceId:row.serviceId,staffId:row.staffId,guests:row.guests},(newLedger.data()?.bookings||[]).filter(item=>item.id!==data.id));}catch(error){throw new HttpsError('failed-precondition',error.message);}
  if(date!==row.date)tx.set(oldRef,{bookings:(oldLedger.data()?.bookings||[]).filter(item=>item.id!==data.id)});
  tx.set(newRef,{bookings:[...(newLedger.data()?.bookings||[]).filter(item=>item.id!==data.id),{...slot,id:data.id,status:'confirmed'}]});
  tx.update(ref,{...slot,date,rescheduledAt:FieldValue.serverTimestamp()});
 });return {success:true};
});
exports.markNotificationRead=onCall(async request=>{
 const ownerId=uid(request),id=request.data?.id;
 if(!/^[a-zA-Z0-9-]{1,100}$/.test(id||''))throw new HttpsError('invalid-argument','Invalid notification.');
 const ref=db().doc(`businessPrivate/${ownerId}/notifications/${id}`),snap=await ref.get();
 if(!snap.exists)throw new HttpsError('not-found','Notification not found.');await ref.update({read:true});return {success:true};
});
exports.businessClients=onCall(async request=>{
 const ownerId=uid(request);
 const [bookings,notes]=await Promise.all([db().collection(`businessPrivate/${ownerId}/bookings`).orderBy('createdAt','desc').limit(300).get(),db().collection(`businessPrivate/${ownerId}/clientNotes`).get()]);
 const noteMap=new Map(notes.docs.map(row=>[row.id,row.data().note])),clients=new Map();
 for(const record of bookings.docs){const row=record.data(),id=require('node:crypto').createHash('sha256').update(row.email.toLowerCase()).digest('hex');const client=clients.get(id)||{id,name:row.name,email:row.email,phone:row.phone,bookings:[],note:noteMap.get(id)||''};client.bookings.push({id:record.id,start:row.start,serviceName:row.serviceName||'Table reservation',status:row.status});clients.set(id,client);}
 return [...clients.values()];
});
exports.saveClientNote=onCall(async request=>{
 const ownerId=uid(request),{id,note}=request.data||{};
 if(!/^[a-f0-9]{64}$/.test(id||''))throw new HttpsError('invalid-argument','Invalid client.');await db().doc(`businessPrivate/${ownerId}/clientNotes/${id}`).set({note:text(note,5000),updatedAt:FieldValue.serverTimestamp()});return {success:true};
});

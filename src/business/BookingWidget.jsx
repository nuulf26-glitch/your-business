import { useEffect, useState } from 'react';
import { businessCall } from './api';
import { bookingStartIso, formatBookingTime } from './bookingTime';
export default function BookingWidget({ storeUrl, catalog }) {
  const isRestaurant = catalog.businessCategory === 'restaurant';
  const services = (catalog.services || []).filter(item => item.active !== false);
  const staff = (catalog.staff || []).filter(item => item.active !== false);
  const tables = (catalog.tables || []).filter(item => item.active !== false);
  const [serviceId,setServiceId]=useState('');
  const [staffId,setStaffId]=useState('');
  const [date,setDate]=useState('');
  const [guests,setGuests]=useState(2);
  const requestKey=JSON.stringify([storeUrl,date,serviceId,staffId,guests,isRestaurant]);
  const shouldLoad=Boolean(date&&(isRestaurant||serviceId));
  const [availability,setAvailability]=useState({key:'',slots:[],message:''});
  const [selection,setSelection]=useState({key:'',value:''});
  const [submitting,setSubmitting]=useState(false);
  const slots=availability.key===requestKey?availability.slots:[];
  const selected=selection.key===requestKey?selection.value:'';
  const message=availability.key===requestKey?availability.message:'';
  const busy=submitting||(shouldLoad&&availability.key!==requestKey);
  const [confirmation,setConfirmation]=useState(null);
  const hasBookingSetup = isRestaurant
    ? tables.some(table => Number(table.capacity) >= 1)
    : services.length > 0 && staff.some(member => member.serviceIds?.some(id => services.some(service => service.id === id)));
  useEffect(() => {
    let active=true;
    if (!date || (!isRestaurant && !serviceId)) return;
    businessCall('bookingOptions',{ storeUrl,date,serviceId,staffId,guests:Number(guests),kind:isRestaurant?'reservation':'appointment' }).then(result => { if(active) setAvailability({key:requestKey,slots:result,message:result.length?'':'No times available on this date. Choose another date or contact the business.'}); }).catch(error => { if(active) setAvailability({key:requestKey,slots:[],message:error.message||'Availability could not be checked. Please try again.'}); });
    return () => {active=false;};
  },[storeUrl,date,serviceId,staffId,guests,isRestaurant,requestKey]);
  if (confirmation) return <div className="cyb-form" role="status"><h3>Your {isRestaurant?'table':'appointment'} is confirmed.</h3><p>{new Intl.DateTimeFormat('en-US',{ timeZone:confirmation.timeZone,dateStyle:'full',timeStyle:'short' }).format(new Date(confirmation.start))}</p><small>Confirmation: {confirmation.id}</small><p>Keep this reference when contacting the business. Email confirmation is not enabled.</p></div>;
  if (!hasBookingSetup) return <div className="cyb-form" role="status"><h3>Online booking is not set up yet.</h3><p>{isRestaurant?'The business needs to add a table that fits your party size.':'The business needs to add a service and assign an available team member.'} Please contact the business to book in the meantime.</p></div>;
  return <form className="cyb-form" onSubmit={async event => {
    event.preventDefault(); if(!selected) return;
    const data=Object.fromEntries(new FormData(event.currentTarget)); setSubmitting(true);setAvailability(current=>({...current,key:requestKey,message:''}));
    try { setConfirmation(await businessCall('createBooking',{...data,storeUrl,serviceId,staffId,guests:Number(guests),start:bookingStartIso(selected),kind:isRestaurant?'reservation':'appointment'})); }
    catch(error){ setAvailability(current=>({...current,key:requestKey,message:error.message})); } finally{setSubmitting(false);}
  }}>
    {!isRestaurant && <><label>Service<select required value={serviceId} onChange={event=>setServiceId(event.target.value)}><option value="">Choose a service</option>{services.map(item=><option key={item.id} value={item.id}>{item.name} · {item.duration} min · ${Number(item.price).toFixed(2)}</option>)}</select></label><label>Staff<select value={staffId} onChange={event=>setStaffId(event.target.value)}><option value="">Any available team member</option>{staff.filter(item=>item.serviceIds?.includes(serviceId)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>{serviceId&&!staff.some(item=>item.serviceIds?.includes(serviceId))&&<p role="status">No team member is assigned to this service yet. Please contact the business to book.</p>}</>}
    {isRestaurant && <label>Guests<input type="number" min="1" max="100" required value={guests} onChange={event=>setGuests(event.target.value)} /></label>}
    <label>Date ({catalog.timeZone})<input type="date" min={new Date().toLocaleDateString('en-CA',{timeZone:catalog.timeZone})} required value={date} onChange={event=>{setDate(event.target.value);setSelection({key:'',value:''});}} /></label>
    <label>Available time<select required value={selected} onChange={event=>setSelection({key:requestKey,value:event.target.value})}><option value="">{busy?'Checking availability…':'Choose a time'}</option>{slots.map(slot=><option key={slot.start} value={slot.start}>{formatBookingTime(slot.start,catalog.timeZone)}</option>)}</select></label>
    <label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label><button className="cyb-action" disabled={busy || !selected}>{busy?'Please wait…':'Confirm booking'}</button><p role="status">{message}</p>
  </form>;
}

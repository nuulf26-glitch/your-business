import { useEffect, useState } from 'react';
import { businessCall } from './api';
export default function BookingWidget({ storeUrl, catalog }) {
  const isRestaurant = catalog.businessCategory === 'restaurant';
  const [serviceId,setServiceId]=useState('');
  const [staffId,setStaffId]=useState('');
  const [date,setDate]=useState('');
  const [guests,setGuests]=useState(2);
  const [slots,setSlots]=useState([]);
  const [selected,setSelected]=useState('');
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [confirmation,setConfirmation]=useState(null);
  useEffect(() => {
    let active=true; setSelected(''); setSlots([]); setMessage('');
    if (!date || (!isRestaurant && !serviceId)) return;
    setBusy(true);
    businessCall('bookingOptions',{ storeUrl,date,serviceId,staffId,guests:Number(guests),kind:isRestaurant?'reservation':'appointment' }).then(result => { if(active){ setSlots(result); if(!result.length) setMessage('No times available. Please choose another date.'); } }).catch(error => { if(active) setMessage(error.message); }).finally(() => { if(active) setBusy(false); });
    return () => {active=false;};
  },[storeUrl,date,serviceId,staffId,guests,isRestaurant]);
  const format = value => new Intl.DateTimeFormat('en-US',{ timeZone:catalog.timeZone,hour:'numeric',minute:'2-digit' }).format(new Date(Number(value)));
  if (confirmation) return <div className="cyb-form" role="status"><h3>Your {isRestaurant?'table':'appointment'} is confirmed.</h3><p>{new Intl.DateTimeFormat('en-US',{ timeZone:confirmation.timeZone,dateStyle:'full',timeStyle:'short' }).format(new Date(confirmation.start))}</p><small>Confirmation: {confirmation.id}</small><p>Keep this reference when contacting the business. Email confirmation is not enabled.</p></div>;
  return <form className="cyb-form" onSubmit={async event => {
    event.preventDefault(); if(!selected) return;
    const data=Object.fromEntries(new FormData(event.currentTarget)); setBusy(true);setMessage('');
    try { setConfirmation(await businessCall('createBooking',{...data,storeUrl,serviceId,staffId,guests:Number(guests),start:new Date(Number(selected)).toISOString(),kind:isRestaurant?'reservation':'appointment'})); }
    catch(error){ setMessage(error.message); } finally{setBusy(false);}
  }}>
    {!isRestaurant && <><label>Service<select required value={serviceId} onChange={event=>setServiceId(event.target.value)}><option value="">Choose a service</option>{catalog.services?.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.name} · {item.duration} min · ${Number(item.price).toFixed(2)}</option>)}</select></label><label>Staff<select value={staffId} onChange={event=>setStaffId(event.target.value)}><option value="">Any available team member</option>{catalog.staff?.filter(item=>item.active!==false && item.serviceIds?.includes(serviceId)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
    {isRestaurant && <label>Guests<input type="number" min="1" max="100" required value={guests} onChange={event=>setGuests(event.target.value)} /></label>}
    <label>Date ({catalog.timeZone})<input type="date" required value={date} onChange={event=>setDate(event.target.value)} /></label>
    <label>Available time<select required value={selected} onChange={event=>setSelected(event.target.value)}><option value="">{busy?'Checking availability…':'Choose a time'}</option>{slots.map(slot=><option key={slot.start} value={slot.start}>{format(slot.start)}</option>)}</select></label>
    <label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label><button className="cyb-action" disabled={busy || !selected}>{busy?'Please wait…':'Confirm booking'}</button><p role="status">{message}</p>
  </form>;
}

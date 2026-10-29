import { useEffect, useState } from 'react';
import { businessCall } from './api';
export default function BookingWidget({ storeUrl, catalog }) {
  const isRestaurant = catalog.businessCategory === 'restaurant';
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
  useEffect(() => {
    let active=true;
    if (!date || (!isRestaurant && !serviceId)) return;
    businessCall('bookingOptions',{ storeUrl,date,serviceId,staffId,guests:Number(guests),kind:isRestaurant?'reservation':'appointment' }).then(result => { if(active) setAvailability({key:requestKey,slots:result,message:result.length?'':'No times available. Please choose another date.'}); }).catch(error => { if(active) setAvailability({key:requestKey,slots:[],message:error.message}); });
    return () => {active=false;};
  },[storeUrl,date,serviceId,staffId,guests,isRestaurant,requestKey]);
  const format = value => new Intl.DateTimeFormat('en-US',{ timeZone:catalog.timeZone,hour:'numeric',minute:'2-digit' }).format(new Date(Number(value)));
  if (confirmation) return <div className="cyb-form" role="status"><h3>Your {isRestaurant?'table':'appointment'} is confirmed.</h3><p>{new Intl.DateTimeFormat('en-US',{ timeZone:confirmation.timeZone,dateStyle:'full',timeStyle:'short' }).format(new Date(confirmation.start))}</p><small>Confirmation: {confirmation.id}</small><p>Keep this reference when contacting the business. Email confirmation is not enabled.</p></div>;
  return <form className="cyb-form" onSubmit={async event => {
    event.preventDefault(); if(!selected) return;
    const data=Object.fromEntries(new FormData(event.currentTarget)); setSubmitting(true);setAvailability(current=>({...current,key:requestKey,message:''}));
    try { setConfirmation(await businessCall('createBooking',{...data,storeUrl,serviceId,staffId,guests:Number(guests),start:new Date(Number(selected)).toISOString(),kind:isRestaurant?'reservation':'appointment'})); }
    catch(error){ setAvailability(current=>({...current,key:requestKey,message:error.message})); } finally{setSubmitting(false);}
  }}>
    {!isRestaurant && <><label>Service<select required value={serviceId} onChange={event=>setServiceId(event.target.value)}><option value="">Choose a service</option>{catalog.services?.filter(item=>item.active!==false).map(item=><option key={item.id} value={item.id}>{item.name} · {item.duration} min · ${Number(item.price).toFixed(2)}</option>)}</select></label><label>Staff<select value={staffId} onChange={event=>setStaffId(event.target.value)}><option value="">Any available team member</option>{catalog.staff?.filter(item=>item.active!==false && item.serviceIds?.includes(serviceId)).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label></>}
    {isRestaurant && <label>Guests<input type="number" min="1" max="100" required value={guests} onChange={event=>setGuests(event.target.value)} /></label>}
    <label>Date ({catalog.timeZone})<input type="date" required value={date} onChange={event=>setDate(event.target.value)} /></label>
    <label>Available time<select required value={selected} onChange={event=>setSelection({key:requestKey,value:event.target.value})}><option value="">{busy?'Checking availability…':'Choose a time'}</option>{slots.map(slot=><option key={slot.start} value={slot.start}>{format(slot.start)}</option>)}</select></label>
    <label>Your name<input name="name" required maxLength={120} autoComplete="name" /></label><label>Email<input name="email" type="email" required autoComplete="email" /></label><label>Phone<input name="phone" type="tel" maxLength={40} autoComplete="tel" /></label><button className="cyb-action" disabled={busy || !selected}>{busy?'Please wait…':'Confirm booking'}</button><p role="status">{message}</p>
  </form>;
}

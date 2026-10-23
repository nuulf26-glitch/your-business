import {useState} from 'react';
import {businessCall} from './api';
export default function PickupWidget({catalog,storeUrl}){
 const [quantities,setQuantities]=useState({}),[pickupAt,setPickupAt]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false),[confirmation,setConfirmation]=useState(null);
 const [requestId]=useState(()=>crypto.randomUUID?.()||`request-${Date.now()}-${Math.random().toString(16).slice(2)}`);
 const items=(catalog.menu||[]).filter(item=>item.active!==false);
 if(!catalog.takeawayEnabled)return null;
 if(confirmation)return <div role="status" className="cyb-note"><h3>Order received.</h3><p>Reference: {confirmation.id}</p><p>Total: ${(confirmation.total/100).toFixed(2)} · Pay at pickup.</p><p>Your order is awaiting the restaurant’s acceptance. Contact the restaurant with this reference for updates.</p></div>;
 return <form className="cyb-form" onSubmit={async event=>{
  event.preventDefault();const data=Object.fromEntries(new FormData(event.currentTarget));setBusy(true);setStatus('');
  try{setConfirmation(await businessCall('createPickupOrder',{...data,storeUrl,requestId,items:items.filter(item=>quantities[item.id]>0).map(item=>({id:item.id,quantity:Number(quantities[item.id])})),pickupAt:new Date(pickupAt).toISOString()}));}catch(error){setStatus(error.message);}finally{setBusy(false);}
 }}><h3>Order for pickup</h3>{items.map(item=><label key={item.id}>{item.name} · ${Number(item.price).toFixed(2)}<input type="number" min="0" max="50" value={quantities[item.id]||0} onChange={event=>setQuantities({...quantities,[item.id]:Number(event.target.value)})}/></label>)}<label>Pickup time (your device’s local time)<input type="datetime-local" required value={pickupAt} onChange={event=>setPickupAt(event.target.value)}/></label><label>Your name<input name="name" autoComplete="name" required maxLength={120}/></label><label>Email<input name="email" type="email" autoComplete="email" required/></label><label>Phone<input name="phone" type="tel" autoComplete="tel" required/></label><p className="cyb-note">Pay at pickup. The restaurant confirms acceptance separately.</p><button className="cyb-action" disabled={busy||!Object.values(quantities).some(value=>value>0)}>{busy?'Sending…':'Place pickup order'}</button><p role="status">{status}</p></form>;
}

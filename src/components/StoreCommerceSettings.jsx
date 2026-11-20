import { useEffect, useState } from "react";
import { customBackendRequest } from "../services/customBackendSession";
import "./storeCommerceSettings.css";

const defaults = { currency: "USD", shippingZones: [], pickupEnabled: false, taxEnabled: false, taxRatePercent: 0, taxShipping: false, taxLabel: "Tax", discounts: [] };
const localDateTime = value => { if(!value)return ""; const date=new Date(value); return Number.isNaN(date.getTime())?"":date.toISOString().slice(0,16); };
const isoDateTime = value => value?new Date(value).toISOString():null;

export default function StoreCommerceSettings() {
  const [settings,setSettings]=useState(defaults);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

  useEffect(()=>{
    let active=true;
    customBackendRequest("/businesses/mine/commerce-settings")
      .then(value=>{if(active)setSettings({...defaults,...value});})
      .catch(error=>{if(active)setMessage(error.message||"Could not load store delivery settings.");})
      .finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[]);

  function updateZone(index,key,value){
    setSettings(current=>({...current,shippingZones:current.shippingZones.map((zone,i)=>i===index?{...zone,[key]:value}:zone)}));
  }
  function updateDiscount(index,key,value){
    setSettings(current=>({...current,discounts:current.discounts.map((code,i)=>i===index?{...code,[key]:value}:code)}));
  }
  async function save(event){
    event.preventDefault();setSaving(true);setMessage("");
    const data={
      ...settings,
      currency:String(settings.currency||"USD").toUpperCase(),
      shippingZones:settings.shippingZones.map(zone=>({...zone,countryCodes:String(zone.countryCodesText??(zone.countryCodes||[]).join(",")).split(",").map(code=>code.trim().toUpperCase()).filter(Boolean),fee:Number(zone.fee||0),freeShippingThreshold:zone.freeShippingThreshold===""||zone.freeShippingThreshold==null?null:Number(zone.freeShippingThreshold)})),
      taxRatePercent:Number(settings.taxRatePercent||0),
      discounts:settings.discounts.map(code=>({...code,code:String(code.code||"").trim().toUpperCase(),value:Number(code.value||0),usageLimit:code.usageLimit===""||code.usageLimit==null?null:Number(code.usageLimit),startsAt:isoDateTime(code.startsAt),endsAt:isoDateTime(code.endsAt)})),
    };
    try{const saved=await customBackendRequest("/businesses/mine/commerce-settings",{method:"PUT",body:JSON.stringify({data})});setSettings({...defaults,...saved});setMessage("Store commerce settings saved.");}
    catch(error){setMessage(error.message||"Could not save these settings.");}
    finally{setSaving(false);}
  }

  if(loading)return <section className="commerce-settings-card" role="status">Loading commerce settings…</section>;
  return (
    <section className="commerce-settings-card">
      <header><div><span>Store checkout</span><h2>Delivery, tax &amp; discounts</h2><p>Set the checkout rules customers see. Tax is only applied when you enable it and enter a rate.</p></div></header>
      <form onSubmit={save}>
        <div className="commerce-settings-grid">
          <label>Currency
            <select value={settings.currency||"USD"} onChange={event=>setSettings(current=>({...current,currency:event.target.value}))}>
              <option value="AED">AED — UAE dirham</option><option value="USD">USD — US dollar</option><option value="EUR">EUR — euro</option><option value="GBP">GBP — pound sterling</option>
            </select>
          </label>
          <label className="commerce-toggle"><input type="checkbox" checked={!!settings.pickupEnabled} onChange={event=>setSettings(current=>({...current,pickupEnabled:event.target.checked}))}/> Offer local pickup</label>
          <label className="commerce-toggle"><input type="checkbox" checked={!!settings.taxEnabled} onChange={event=>setSettings(current=>({...current,taxEnabled:event.target.checked}))}/> Apply a merchant-configured tax rate</label>
          {settings.taxEnabled && <>
            <label>Tax rate (%)<input type="number" min="0" max="100" step="0.01" value={settings.taxRatePercent??0} onChange={event=>setSettings(current=>({...current,taxRatePercent:event.target.value}))}/></label>
            <label>Tax label<input value={settings.taxLabel||"Tax"} onChange={event=>setSettings(current=>({...current,taxLabel:event.target.value}))}/></label>
            <label className="commerce-toggle"><input type="checkbox" checked={!!settings.taxShipping} onChange={event=>setSettings(current=>({...current,taxShipping:event.target.checked}))}/> Include shipping in taxable amount</label>
          </>}
        </div>

        <div className="commerce-settings-section">
          <div className="commerce-settings-section-title"><h3>Shipping zones</h3><button type="button" onClick={()=>setSettings(current=>({...current,shippingZones:[...current.shippingZones,{name:"New zone",countryCodes:[],countryCodesText:"",fee:0,freeShippingThreshold:"",enabled:true}]}))}>Add zone</button></div>
          {settings.shippingZones.length===0&&<p className="commerce-settings-note">No zones set. Existing checkout shipping defaults apply until a zone is added.</p>}
          {settings.shippingZones.map((zone,index)=><div className="commerce-settings-row" key={index}>
            <label>Zone name<input value={zone.name||""} onChange={event=>updateZone(index,"name",event.target.value)}/></label>
            <label>Country codes<input value={zone.countryCodesText??(zone.countryCodes||[]).join(",")} onChange={event=>updateZone(index,"countryCodesText",event.target.value)} placeholder="AE, SA, OM"/></label>
            <label>Delivery fee<input type="number" min="0" step="0.01" value={zone.fee??0} onChange={event=>updateZone(index,"fee",event.target.value)}/></label>
            <label>Free shipping from<input type="number" min="0" step="0.01" value={zone.freeShippingThreshold??""} onChange={event=>updateZone(index,"freeShippingThreshold",event.target.value)}/></label>
            <button type="button" aria-label={`Remove ${zone.name||"shipping"} zone`} onClick={()=>setSettings(current=>({...current,shippingZones:current.shippingZones.filter((_,i)=>i!==index)}))}>Remove</button>
          </div>)}
        </div>

        <div className="commerce-settings-section">
          <div className="commerce-settings-section-title"><h3>Discount codes</h3><button type="button" onClick={()=>setSettings(current=>({...current,discounts:[...current.discounts,{code:"",type:"percent",value:10,enabled:true,usageLimit:""}]}))}>Add code</button></div>
          {settings.discounts.map((code,index)=><div className="commerce-settings-row commerce-discount-row" key={index}>
            <label>Code<input value={code.code||""} onChange={event=>updateDiscount(index,"code",event.target.value.toUpperCase())} placeholder="WELCOME10"/></label>
            <label>Type<select value={code.type||"percent"} onChange={event=>updateDiscount(index,"type",event.target.value)}><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select></label>
            <label>Value<input type="number" min="0" step="0.01" value={code.value??0} onChange={event=>updateDiscount(index,"value",event.target.value)}/></label>
            <label>Use limit<input type="number" min="1" step="1" value={code.usageLimit??""} onChange={event=>updateDiscount(index,"usageLimit",event.target.value)} placeholder="Unlimited"/></label>
            <label>Starts at<input type="datetime-local" value={localDateTime(code.startsAt)} onChange={event=>updateDiscount(index,"startsAt",event.target.value)}/></label>
            <label>Ends at<input type="datetime-local" value={localDateTime(code.endsAt)} onChange={event=>updateDiscount(index,"endsAt",event.target.value)}/></label>
            <label className="commerce-toggle"><input type="checkbox" checked={code.enabled!==false} onChange={event=>updateDiscount(index,"enabled",event.target.checked)}/> Enabled</label>
            <button type="button" aria-label={`Remove discount ${code.code||index+1}`} onClick={()=>setSettings(current=>({...current,discounts:current.discounts.filter((_,i)=>i!==index)}))}>Remove</button>
          </div>)}
        </div>
        {message&&<p className="commerce-settings-message" role="status">{message}</p>}
        <button className="commerce-settings-save" type="submit" disabled={saving}>{saving?"Saving…":"Save checkout settings"}</button>
      </form>
    </section>
  );
}

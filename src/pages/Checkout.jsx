import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/checkout.css";
import { customBackendRequest } from "../services/customBackendSession";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  countryCode: "AE",
  deliveryMethod: "delivery",
  discountCode: "",
  notes: "",
};

function readSavedCart() {
  try {
    const savedCart = localStorage.getItem("businessCart");
    const parsed = savedCart ? JSON.parse(savedCart) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Could not load cart:", error);
    return [];
  }
}

function Checkout() {
  const navigate = useNavigate();

  const [cart] = useState(readSavedCart);
  const [form, setForm] = useState(initialForm);
  const [commerceSettings, setCommerceSettings] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + Number(item.price) * Number(item.quantity);
    }, 0);
  }, [cart]);

  useEffect(() => {
    const storeUrl=cart[0]?.storeUrl;
    if(!storeUrl)return;
    customBackendRequest(`/businesses/public/${encodeURIComponent(storeUrl)}`)
      .then(store=>{
        const settings=store?.settings?.commerceSettings||{};
        setCommerceSettings(settings);
        const countries=[...new Set((settings.shippingZones||[]).flatMap(zone=>zone.countryCodes||[]))];
        if(countries.length)setForm(current=>({...current,countryCode:countries.includes(current.countryCode)?current.countryCode:countries[0]}));
      })
      .catch(()=>setCommerceSettings({}));
  },[cart]);

  const currency=commerceSettings.currency||cart[0]?.currency||'USD';
  const zones=Array.isArray(commerceSettings.shippingZones)?commerceSettings.shippingZones:[];
  const availableCountries=[...new Set(zones.flatMap(zone=>zone.countryCodes||[]))];
  const hasDeliveryZone=zones.length===0||form.deliveryMethod==='pickup'||zones.some(zone=>(zone.countryCodes||[]).includes(String(form.countryCode||'').toUpperCase()));
  const shipping=useMemo(()=>{
    if(form.deliveryMethod==='pickup')return 0;
    const zone=zones.find(item=>(item.countryCodes||[]).includes(String(form.countryCode||'').toUpperCase()));
    if(zones.length&&!zone)return 0;
    if(zone)return zone.freeShippingThreshold!=null&&subtotal>=Number(zone.freeShippingThreshold)?0:Number(zone.fee)||0;
    return subtotal>=300?0:25;
  },[zones,form.deliveryMethod,form.countryCode,subtotal]);
  const selectedDiscount=(commerceSettings.discounts||[]).find(item=>String(item.code||'').toUpperCase()===form.discountCode.trim().toUpperCase()&&item.enabled!==false);
  const discount=selectedDiscount?(selectedDiscount.type==='percent'?subtotal*Number(selectedDiscount.value||0)/100:Number(selectedDiscount.value||0)):0;
  const taxBase=Math.max(0,subtotal-discount)+(commerceSettings.taxShipping?shipping:0);
  const tax=commerceSettings.taxEnabled?Math.round(taxBase*(Number(commerceSettings.taxRatePercent||0)/100)*100)/100:0;
  const total=Math.max(0,subtotal-discount+shipping+tax);

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function validateForm() {
    if (!hasDeliveryZone) { setError("This store does not deliver to the selected country."); return false; }
    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.address.trim() ||
      !form.city.trim()
    ) {
      setError("Please complete all required fields.");
      return false;
    }

    if (!form.email.includes("@")) {
      setError("Please enter a valid email address.");
      return false;
    }

    return true;
  }

async function handleSubmit(event) {
      event.preventDefault();
    setError("");

    if (cart.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (new Set(cart.map(item=>item.storeUrl)).size !== 1 || !cart[0]?.storeUrl) { setError('Please order from one store at a time.'); return; }

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const orderId = `ORD-${Date.now()}`;
const storeUrl = cart[0]?.storeUrl || "";
     
  const newOrder = {
  id: orderId,
  userId: "",
  storeUrl,
  customerName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        countryCode: form.countryCode,
        deliveryMethod: form.deliveryMethod,
        discountCode: form.discountCode.trim(),
        notes: form.notes.trim(),
        items: cart.map(item => ({ ...item, id: item.id || item.productId })),
        subtotal,
        shipping,
        discount,
        tax,
        total,
        currency,
        status: "New",
        paymentStatus: "Pending",
        date: new Date().toISOString(),
      };
const saved = await customBackendRequest('/public/orders', { method: 'POST', body: JSON.stringify({ data: newOrder }) });
Object.assign(newOrder, saved, { id: saved.id, backendId: saved.id });

     

     


      localStorage.setItem("pendingOrder", JSON.stringify(newOrder));

      navigate("/payment");
    } catch (checkoutError) {
      console.error("Could not create order:", checkoutError);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (cart.length === 0) {
    return (
      <div className="checkout-empty-page">
        <h1>Your cart is empty</h1>
        <p>Add products before continuing to checkout.</p>

        <button type="button" onClick={() => navigate(-1)}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="checkout-page">
      <header className="checkout-header">
        <button
          type="button"
          className="checkout-logo"
          onClick={() => navigate("/")}
        >
          CYB
        </button>

        <button
          type="button"
          className="checkout-back-button"
          onClick={() => navigate("/cart")}
        >
          Back to cart
        </button>
      </header>

      <main className="checkout-main">
        <div className="checkout-heading">
          <span>Secure checkout</span>
          <h1>Delivery details</h1>
          <p>
            Enter your information below before continuing to payment.
          </p>
        </div>

        <form className="checkout-layout" onSubmit={handleSubmit}>
          <section className="checkout-form-card">
            <div className="checkout-card-heading">
              <span>Customer information</span>
              <h2>Your details</h2>
            </div>

            <div className="checkout-form-grid">
              <div className="checkout-field full">
                <label htmlFor="fullName">Full name *</label>
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  value={form.fullName}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={handleChange}
                  placeholder="name@example.com"
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="phone">Phone number *</label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={handleChange}
                  placeholder="+971..."
                />
              </div>

              <div className="checkout-field full">
                <label htmlFor="address">Delivery address *</label>
                <input
                  id="address"
                  name="address"
                  type="text"
                  value={form.address}
                  onChange={handleChange}
                  placeholder="Street, building, apartment"
                />
              </div>

              <div className="checkout-field full">
                <label htmlFor="city">City *</label>
                <input
                  id="city"
                  name="city"
                  type="text"
                  value={form.city}
                  onChange={handleChange}
                  placeholder="Dubai, Abu Dhabi, Al Ain..."
                />
              </div>

              <div className="checkout-field">
                <label htmlFor="countryCode">Delivery country</label>
                <select id="countryCode" name="countryCode" value={form.countryCode} onChange={handleChange}>
                  {(availableCountries.length?availableCountries:['AE']).map(code=><option key={code} value={code}>{code}</option>)}
                </select>
              </div>

              {commerceSettings.pickupEnabled && (
                <div className="checkout-field">
                  <label htmlFor="deliveryMethod">Delivery method</label>
                  <select id="deliveryMethod" name="deliveryMethod" value={form.deliveryMethod} onChange={handleChange}>
                    <option value="delivery">Delivery</option><option value="pickup">Local pickup</option>
                  </select>
                </div>
              )}

              <div className="checkout-field full">
                <label htmlFor="discountCode">Discount code</label>
                <input id="discountCode" name="discountCode" value={form.discountCode} onChange={handleChange} placeholder="Enter a code" autoCapitalize="characters" />
              </div>

              <div className="checkout-field full">
                <label htmlFor="notes">Order notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  rows="4"
                  value={form.notes}
                  onChange={handleChange}
                  placeholder="Delivery instructions or notes"
                />
              </div>
            </div>

            {error && <p className="checkout-error">{error}</p>}
          </section>

          <aside className="checkout-summary-card">
            <div className="checkout-card-heading">
              <span>Order summary</span>
              <h2>Your order</h2>
            </div>

            <div className="checkout-items-list">
              {cart.map((item) => (
                <div className="checkout-item" key={item.productId}>
                  <div>
                    <strong>{item.name}</strong>
                    {item.variantName && <small>{item.variantName}</small>}
                    <span>
                      {item.quantity} × USD{" "}
                      {Number(item.price).toFixed(2)}
                    </span>
                  </div>

                  <strong>
                    USD{" "}
                    {(
                      Number(item.price) * Number(item.quantity)
                    ).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="checkout-summary-row">
              <span>Subtotal</span>
              <strong>{currency} {subtotal.toFixed(2)}</strong>
            </div>

            <div className="checkout-summary-row">
              <span>Shipping</span>
              <strong>
                {!hasDeliveryZone ? "Unavailable" : shipping === 0 ? "Free" : `${currency} ${shipping.toFixed(2)}`}
              </strong>
            </div>

            {discount > 0 && <div className="checkout-summary-row"><span>Discount</span><strong>− {currency} {discount.toFixed(2)}</strong></div>}
            {tax > 0 && <div className="checkout-summary-row"><span>{commerceSettings.taxLabel||'Tax'}</span><strong>{currency} {tax.toFixed(2)}</strong></div>}

            <div className="checkout-summary-total">
              <span>Total</span>
              <strong>{currency} {total.toFixed(2)}</strong>
            </div>

            <button
              type="submit"
              className="checkout-submit-button"
              disabled={loading}
            >
              {loading ? "Preparing payment..." : "Continue to payment"}
            </button>

            <p>
              Your order will not be completed until payment is confirmed.
            </p>
          </aside>
        </form>
      </main>
    </div>
  );
}

export default Checkout;

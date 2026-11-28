import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/payment.css";
import { customBackendRequest } from "../services/customBackendSession";

function readPendingOrder() {
  try { const savedOrder = localStorage.getItem("pendingOrder"); return savedOrder ? JSON.parse(savedOrder) : null; }
  catch (error) { console.error("Could not load pending order:", error); return null; }
}

function loadStripeJs() {
  if (window.Stripe) return Promise.resolve(window.Stripe);
  if (window.__cybStripeJsPromise) return window.__cybStripeJsPromise;
  window.__cybStripeJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = () => window.Stripe ? resolve(window.Stripe) : reject(new Error("Stripe.js could not be initialized."));
    script.onerror = () => reject(new Error("Stripe.js could not be loaded."));
    document.head.appendChild(script);
  });
  return window.__cybStripeJsPromise;
}

function Payment() {
  const navigate = useNavigate();

  const [order] = useState(readPendingOrder);
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [methods, setMethods] = useState([{ id: "cash_on_delivery", label: "Cash on delivery", enabled: true }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [manualPayment, setManualPayment] = useState(null);
  const [stripePayment, setStripePayment] = useState(null);
  const [availableWallets, setAvailableWallets] = useState(null);
  const expressMountRef = useRef(null);
  const expressElementRef = useRef(null);
  const stripeMountRef = useRef(null);
  const stripeRef = useRef(null);
  const stripeElementsRef = useRef(null);
  const stripeElementRef = useRef(null);
  const returnParams = new URLSearchParams(window.location.search);
  const returnOrder = returnParams.get("tap_order") || returnParams.get("stripe_order");
  const returnMismatch = Boolean(returnOrder && returnOrder !== order?.backendId);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    if (returnMismatch) return () => { active = false; };
    if (order?.backendId && order?.cashOnDeliveryToken) {
      customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment-methods?token=${encodeURIComponent(order.cashOnDeliveryToken)}`)
        .then((result) => { if (active && Array.isArray(result?.methods)) setMethods(result.methods.filter((method) => method.enabled)); })
        .catch(() => {});
    }
    const tapId = params.get("tap_id");
    if (params.get("tap_order") && tapId && order?.backendId && order?.cashOnDeliveryToken) {
      customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/tap/verify`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, chargeId: tapId }) })
        .then((result) => {
          if (!active) return;
          if (!result.verified) { setError("Tap has not confirmed this payment yet. You can retry checking the payment status."); return; }
          const completedOrder = { ...order, paymentMethod: "tap", paymentStatus: "Paid", status: "New", completedAt: new Date().toISOString() };
          localStorage.setItem("completedOrder", JSON.stringify(completedOrder));
          localStorage.removeItem("pendingOrder"); localStorage.removeItem("businessCart");
          navigate("/order-success", { replace: true });
        })
        .catch((paymentError) => { if (active) setError(paymentError.message || "Tap could not verify the payment yet."); });
    }
    const stripeIntentId = params.get("payment_intent");
    if (params.get("stripe_order") && stripeIntentId && order?.backendId && order?.cashOnDeliveryToken) {
      customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/stripe/verify`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, chargeId: stripeIntentId }) })
        .then((result) => {
          if (!active) return;
          if (!result.verified) { setError("Stripe has not confirmed this payment yet. The order remains unpaid; you can retry by returning to checkout."); return; }
          const completedOrder = { ...order, paymentMethod: "stripe", paymentStatus: "Paid", status: "New", completedAt: new Date().toISOString() };
          localStorage.setItem("completedOrder", JSON.stringify(completedOrder));
          localStorage.removeItem("pendingOrder"); localStorage.removeItem("businessCart");
          navigate("/order-success", { replace: true });
        })
        .catch((paymentError) => { if (active) setError(paymentError.message || "Stripe could not verify the payment yet."); });
    }
    return () => { active = false; };
  }, [order, navigate, returnMismatch]);

  useEffect(() => {
    if (!stripePayment || !stripeMountRef.current) return undefined;
    let active = true;
    loadStripeJs().then((Stripe) => {
      if (!active || !stripeMountRef.current) return;
      const stripe = Stripe(stripePayment.publishableKey);
      const elements = stripe.elements({ clientSecret: stripePayment.clientSecret, appearance: { theme: "stripe" } });
      const expressElement = elements.create("expressCheckout", { paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never" } });
      expressElement.on("ready", (event) => { if (active) setAvailableWallets(event.availablePaymentMethods || null); });
      expressElement.on("confirm", async (event) => {
        try {
          const submitted = await elements.submit();
          if (submitted.error) { event.paymentFailed({ reason: "fail" }); setError(submitted.error.message || "Wallet payment details could not be submitted."); return; }
          const confirmed = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/payment?stripe_order=${encodeURIComponent(order.backendId)}` }, redirect: "if_required" });
          if (confirmed.error) { event.paymentFailed({ reason: "fail" }); setError(confirmed.error.message || "The wallet payment could not be confirmed."); return; }
          const paymentIntentId = confirmed.paymentIntent?.id;
          if (confirmed.paymentIntent?.status !== "succeeded" || !paymentIntentId) return;
          const result = await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/stripe/verify`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, chargeId: paymentIntentId }) });
          if (!result.verified) { setError("Stripe has not verified this payment yet. The order remains unpaid."); return; }
          localStorage.setItem("completedOrder", JSON.stringify({ ...order, paymentMethod: "stripe", paymentStatus: "Paid", status: "New", completedAt: new Date().toISOString() }));
          localStorage.removeItem("pendingOrder"); localStorage.removeItem("businessCart"); navigate("/order-success", { replace: true });
        } catch (paymentError) { event.paymentFailed({ reason: "fail" }); setError(paymentError.message || "Wallet payment could not be completed."); }
      });
      expressElement.mount(expressMountRef.current);
      const paymentElement = elements.create("payment", { layout: "accordion" });
      paymentElement.mount(stripeMountRef.current);
      stripeRef.current = stripe; stripeElementsRef.current = elements; stripeElementRef.current = paymentElement; expressElementRef.current = expressElement;
    }).catch((error) => { if (active) setError(error.message || "Stripe secure payment form could not be loaded."); });
    return () => { active = false; stripeElementRef.current?.destroy?.(); expressElementRef.current?.destroy?.(); stripeElementRef.current = null; expressElementRef.current = null; stripeElementsRef.current = null; stripeRef.current = null; };
  }, [stripePayment, order, navigate]);

  const itemCount = useMemo(() => {
    if (!Array.isArray(order?.items)) {
      return 0;
    }

    return order.items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  }, [order]);
  const currency = String(order?.currency || order?.items?.[0]?.currency || "USD").toUpperCase();



async function completeOrder(paymentStatus, orderStatus) {
      const completedOrder = {
      ...order,
      paymentMethod,
      paymentStatus,
      status: orderStatus,
      completedAt: new Date().toISOString(),
    };
if (order.backendId) {
      if (paymentMethod === 'cash_on_delivery') await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/cash-on-delivery`, { method: 'POST', body: JSON.stringify({ token: order.cashOnDeliveryToken }) });
} else {
  throw new Error('This order is not connected to the custom backend.');
}

    localStorage.setItem(
      "completedOrder",
      JSON.stringify(completedOrder)
    );

    localStorage.removeItem("pendingOrder");
    localStorage.removeItem("businessCart");
    try { sessionStorage.removeItem("cyb_storefront_checkout_attempt"); } catch { /* Storage can be disabled by browser privacy settings. */ }

    navigate("/order-success");
  }

  async function handlePayment() {
    setError("");

    if (!order) {
      setError("Order information could not be found.");
      return;
    }

    try {
      setLoading(true);

      if (paymentMethod === "tap") {
        let idempotencyKey = localStorage.getItem(`cyb_tap_checkout:${order.backendId}`);
        if (!idempotencyKey) { idempotencyKey = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(`cyb_tap_checkout:${order.backendId}`, idempotencyKey); }
        const result = await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/tap`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, idempotencyKey }) });
        if (!result?.url || !result.url.startsWith("https://")) throw new Error("Tap did not provide a secure hosted checkout link.");
        window.location.assign(result.url);
        return;
      }
      if (paymentMethod === "stripe") {
        if (!stripePayment) {
          let idempotencyKey = localStorage.getItem(`cyb_stripe_checkout:${order.backendId}`);
          if (!idempotencyKey) { idempotencyKey = crypto.randomUUID().replaceAll("-", ""); localStorage.setItem(`cyb_stripe_checkout:${order.backendId}`, idempotencyKey); }
          const result = await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/stripe`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, idempotencyKey }) });
          if (!result?.clientSecret || !result?.publishableKey?.startsWith("pk_test_")) throw new Error("Stripe did not provide a valid sandbox payment form.");
          setStripePayment(result);
          return;
        }
        if (!stripeRef.current || !stripeElementsRef.current) throw new Error("Stripe secure payment form is still loading.");
        const confirmed = await stripeRef.current.confirmPayment({ elements: stripeElementsRef.current, confirmParams: { return_url: `${window.location.origin}/payment?stripe_order=${encodeURIComponent(order.backendId)}` }, redirect: "if_required" });
        if (confirmed.error) throw new Error(confirmed.error.message || "Stripe could not confirm this payment.");
        const paymentIntentId = confirmed.paymentIntent?.id;
        if (confirmed.paymentIntent?.status === "succeeded" && paymentIntentId) {
          const result = await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/stripe/verify`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, chargeId: paymentIntentId }) });
          if (!result.verified) throw new Error("Stripe has not verified this payment yet. The order remains unpaid.");
          localStorage.setItem("completedOrder", JSON.stringify({ ...order, paymentMethod: "stripe", paymentStatus: "Paid", status: "New", completedAt: new Date().toISOString() }));
          localStorage.removeItem("pendingOrder"); localStorage.removeItem("businessCart"); navigate("/order-success", { replace: true });
        }
        return;
      }
      if (paymentMethod === "bank_transfer" || paymentMethod === "external_payment_link") {
        const result = await customBackendRequest(`/public/orders/${encodeURIComponent(order.backendId)}/payment/manual`, { method: "POST", body: JSON.stringify({ token: order.cashOnDeliveryToken, method: paymentMethod }) });
        setManualPayment(result);
        return;
      }
      await completeOrder("Cash on delivery", "New");

    } catch (paymentError) {
      console.error("Payment failed:", paymentError);
      setError("Payment could not be completed.");
    } finally {
      setLoading(false);
    }
  }

  if (!order) {
    return (
      <div className="payment-empty-page">
        <h1>No pending order</h1>

        <p>
          Return to your cart and complete checkout first.
        </p>

        <button
          type="button"
          onClick={() => navigate("/cart")}
        >
          Return to cart
        </button>
      </div>
    );
  }

  return (
    <div className="payment-page">
      <header className="payment-header">
        <button
          type="button"
          className="payment-logo"
          onClick={() => navigate("/")}
        >
          CYB
        </button>

        <button
          type="button"
          className="payment-back-button"
          onClick={() => navigate("/checkout")}
        >
          Back to checkout
        </button>
      </header>

      <main className="payment-main">
        <div className="payment-heading">
          <span>Final step</span>

          <h1>Complete your payment</h1>

          <p>
              Select a payment method offered by this store.
          </p>
        </div>

        <div className="payment-layout">
          <section className="payment-method-card">
            <div className="payment-card-heading">
              <span>Payment method</span>

              <h2>Payment method</h2>
            </div>

            <div className="payment-options">
              {methods.map((method) => <button type="button" className={`payment-option ${paymentMethod === method.id ? "selected" : ""}`} key={method.id} onClick={() => setPaymentMethod(method.id)}>
                <span className="payment-option-icon">{method.id === "tap" ? "T" : method.id === "stripe" ? "S" : "C"}</span>
                <span><strong>{method.label}</strong><small>{["tap", "stripe"].includes(method.id) ? "Secure hosted checkout · Test mode" : method.id === "bank_transfer" ? "Transfer directly to the merchant" : method.id === "external_payment_link" ? "Pay through the merchant’s external link" : "Pay when your order arrives."}</small></span>
                <span className="payment-radio">{paymentMethod === method.id ? "✓" : ""}</span>
              </button>)}
            </div>

            {paymentMethod === "stripe" && stripePayment && <div className="stripe-payment-element"><div ref={expressMountRef} aria-label="Available wallet payment methods" style={{ display: availableWallets && Object.values(availableWallets).some(Boolean) ? "block" : "none" }} /><div ref={stripeMountRef} /><small>Secure Stripe test payment. Card, Apple Pay, and Google Pay options appear only when Stripe confirms they are enabled and available for this account and device.</small></div>}

            {manualPayment && <div className="payment-manual-instructions" role="status">
              <h3>Payment is awaiting merchant confirmation</h3>
              <p>Order {manualPayment.reference} · Pay exactly {manualPayment.currency} {(manualPayment.amountCents / 100).toFixed(2)}. The order will remain unpaid until the merchant confirms receipt.</p>
              {manualPayment.bankTransfer && <dl><dt>Bank</dt><dd>{manualPayment.bankTransfer.bankName}</dd><dt>Account holder</dt><dd>{manualPayment.bankTransfer.accountName}</dd><dt>IBAN</dt><dd>{manualPayment.bankTransfer.iban}</dd>{manualPayment.bankTransfer.swift && <><dt>SWIFT / BIC</dt><dd>{manualPayment.bankTransfer.swift}</dd></>}</dl>}
              {manualPayment.url && <a href={manualPayment.url} target="_blank" rel="noopener noreferrer">Open merchant payment link</a>}
            </div>}

            {(returnMismatch || error) && (
              <p className="payment-error">
                {returnMismatch ? "This payment return does not match the order on this device." : error}
              </p>
            )}

            <button
              type="button"
              className="payment-submit-button"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading ? "Processing..." : paymentMethod === "tap" ? "Continue to Tap checkout" : paymentMethod === "stripe" ? stripePayment ? "Pay securely with Stripe" : "Load secure Stripe payment form" : paymentMethod === "bank_transfer" ? "Show bank transfer details" : paymentMethod === "external_payment_link" ? "Continue to payment link" : "Confirm cash on delivery"}
            </button>
          </section>

          <aside className="payment-summary-card">
            <div className="payment-card-heading">
              <span>Order summary</span>

              <h2>Review your order</h2>
            </div>

            <div className="payment-order-number">
              <span>Order number</span>
              <strong>{order.id}</strong>
            </div>

            <div className="payment-customer-details">
              <div>
                <span>Customer</span>
                <strong>{order.customerName}</strong>
              </div>

              <div>
                <span>Email</span>
                <strong>{order.email}</strong>
              </div>

              <div>
                <span>Delivery city</span>
                <strong>{order.city}</strong>
              </div>
            </div>

            <div className="payment-items-list">
              {order.items?.map((item) => (
                <div
                  className="payment-item"
                  key={item.productId}
                >
                  <div>
                    <strong>{item.name}</strong>

                    <span>
                      {item.quantity} × {currency}{" "}
                      {Number(item.price || 0).toFixed(2)}
                    </span>
                  </div>

                  <strong>
                    {currency}{" "}
                    {(
                      Number(item.price || 0) *
                      Number(item.quantity || 0)
                    ).toFixed(2)}
                  </strong>
                </div>
              ))}
            </div>

            <div className="payment-summary-row">
              <span>Items</span>
              <strong>{itemCount}</strong>
            </div>

            <div className="payment-summary-row">
              <span>Subtotal</span>

              <strong>
                {currency} {Number(order.subtotal || 0).toFixed(2)}
              </strong>
            </div>

            <div className="payment-summary-row">
              <span>Shipping</span>

              <strong>
                {Number(order.shipping || 0) === 0
                  ? "Free"
                  : `${currency} ${Number(order.shipping).toFixed(2)}`}
              </strong>
            </div>

            <div className="payment-summary-total">
              <span>Total</span>

              <strong>
                {currency} {Number(order.total || 0).toFixed(2)}
              </strong>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default Payment;

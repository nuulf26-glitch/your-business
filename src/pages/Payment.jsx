import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/payment.css";
import { customBackendRequest } from "../services/customBackendSession";

function readPendingOrder() {
  try { const savedOrder = localStorage.getItem("pendingOrder"); return savedOrder ? JSON.parse(savedOrder) : null; }
  catch (error) { console.error("Could not load pending order:", error); return null; }
}

function Payment() {
  const navigate = useNavigate();

  const [order] = useState(readPendingOrder);
  const [paymentMethod, setPaymentMethod] = useState("cash_on_delivery");
  const [methods, setMethods] = useState([{ id: "cash_on_delivery", label: "Cash on delivery", enabled: true }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const returnMismatch = Boolean(new URLSearchParams(window.location.search).get("tap_order") && new URLSearchParams(window.location.search).get("tap_order") !== order?.backendId);

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
    return () => { active = false; };
  }, [order, navigate, returnMismatch]);

  const itemCount = useMemo(() => {
    if (!Array.isArray(order?.items)) {
      return 0;
    }

    return order.items.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  }, [order]);



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
                <span className="payment-option-icon">{method.id === "tap" ? "T" : "C"}</span>
                <span><strong>{method.label}</strong><small>{method.id === "tap" ? "Secure hosted checkout · Test mode" : "Pay when your order arrives."}</small></span>
                <span className="payment-radio">{paymentMethod === method.id ? "✓" : ""}</span>
              </button>)}
            </div>

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
              {loading ? "Processing..." : paymentMethod === "tap" ? "Continue to Tap checkout" : "Confirm cash on delivery"}
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
                      {item.quantity} × USD{" "}
                      {Number(item.price || 0).toFixed(2)}
                    </span>
                  </div>

                  <strong>
                    USD{" "}
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
                USD {Number(order.subtotal || 0).toFixed(2)}
              </strong>
            </div>

            <div className="payment-summary-row">
              <span>Shipping</span>

              <strong>
                {Number(order.shipping || 0) === 0
                  ? "Free"
                  : `USD ${Number(order.shipping).toFixed(2)}`}
              </strong>
            </div>

            <div className="payment-summary-total">
              <span>Total</span>

              <strong>
                USD {Number(order.total || 0).toFixed(2)}
              </strong>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default Payment;

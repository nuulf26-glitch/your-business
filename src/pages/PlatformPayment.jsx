import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/platformPayment.css";

function PlatformPayment() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("stripe_cancelled") === "1") {
      setError("The payment was cancelled. No money was taken.");
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    if (!sessionId) return;

    let active = true;
    setStripeLoading(true);
    customBackendRequest("/payments/stripe/confirm-checkout", {
      method: "POST",
      body: JSON.stringify({ sessionId }),
    }).then((result) => {
      if (!active) return;
      if (!result?.success) throw new Error("The payment could not be confirmed.");
      setPaymentComplete(true);
      window.history.replaceState({}, "", window.location.pathname);
      window.setTimeout(() => navigate("/dashboard", { replace: true }), 1800);
    }).catch((paymentError) => {
      if (!active) return;
      console.error("Confirm Stripe payment error:", paymentError);
      setError(paymentError.message || "The payment could not be confirmed.");
      window.history.replaceState({}, "", window.location.pathname);
    }).finally(() => {
      if (active) setStripeLoading(false);
    });

    return () => { active = false; };
  }, [navigate]);

  async function startStripeCheckout() {
    try {
      setError("");
      setStripeLoading(true);
      const result = await customBackendRequest("/payments/stripe/checkout-sessions", { method: "POST" });
      if (!result?.url || !result.url.startsWith("https://checkout.stripe.com/")) throw new Error("Stripe did not return a valid checkout link.");
      window.location.assign(result.url);
    } catch (paymentError) {
      console.error("Create Stripe checkout error:", paymentError);
      setError(paymentError.message || "Could not start Stripe checkout.");
      setStripeLoading(false);
    }
  }

  if (paymentComplete) {
    return (
      <div className="platform-payment-result">
        <div className="platform-payment-success-icon">✓</div>

        <h1>Payment successful</h1>

        <p>
          Your account is active. You are being redirected to your
          dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="platform-payment-page">
      <header className="platform-payment-header">
        <button
          type="button"
          onClick={() => navigate("/")}
        >
          CYB
        </button>

        <button
          type="button"
          className="platform-payment-back"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </header>

      <main className="platform-payment-main">
        <section className="platform-payment-information">
          <span>One-time payment</span>

          <h1>Open your business platform.</h1>

          <p>
            Pay once and activate access to CYB.
          </p>

          <div className="platform-payment-price">
            <strong>$246</strong>
            <span>One-time payment</span>
          </div>

          <div className="platform-payment-features">
            <div>
              <strong>Website builder</strong>
              <p>Create and design your business website.</p>
            </div>

            <div>
              <strong>Online store</strong>
              <p>Add products and receive customer orders.</p>
            </div>

            <div>
              <strong>Business dashboard</strong>
              <p>Manage products, customers, and orders.</p>
            </div>
          </div>
        </section>

        <section className="platform-payment-card">
          <span>Secure payment</span>

          <h2>Pay securely with Stripe</h2>

          <p>
            Complete the one-time payment to activate your account.
          </p>
          <p className="platform-payment-guarantee">
            Cancel within 30 days for a full refund.
          </p>

          {error && (
            <div className="platform-payment-error">
              {error}
            </div>
          )}

          <button
            type="button"
            className="platform-stripe-button"
            onClick={startStripeCheckout}
            disabled={stripeLoading}
          >
            {stripeLoading ? "Checking payment…" : "Pay securely with Stripe"}
          </button>

          <small>
            Your account activates only after Stripe confirms your payment.
          </small>
        </section>
      </main>
    </div>
  );
}

export default PlatformPayment;

import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/platformPayment.css";

function PlatformPayment() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const cancelled = searchParams.get("cancelled") === "1";

  const [error, setError] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [verifying, setVerifying] = useState(!!sessionId);
  const [startingCheckout, setStartingCheckout] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      if (cancelled) setError("Payment was cancelled. No money was taken.");
      return undefined;
    }

    let cancelledRequest = false;
    setVerifying(true);
    setError("");

    customBackendRequest(`/payments/stripe/sessions/${encodeURIComponent(sessionId)}`)
      .then((result) => {
        if (cancelledRequest) return;
        if (!result?.success) throw new Error("Stripe has not confirmed this payment yet.");
        setPaymentComplete(true);
        window.setTimeout(() => {
          navigate("/dashboard", { replace: true });
        }, 1800);
      })
      .catch((paymentError) => {
        if (cancelledRequest) return;
        console.error("Stripe payment verification error:", paymentError);
        setError(paymentError.message || "Could not confirm the Stripe payment.");
      })
      .finally(() => {
        if (!cancelledRequest) setVerifying(false);
      });

    return () => {
      cancelledRequest = true;
    };
  }, [sessionId, cancelled, navigate]);

  async function startCheckout() {
    try {
      setStartingCheckout(true);
      setError("");
      const result = await customBackendRequest("/payments/stripe/checkout", { method: "POST" });
      if (!result?.url) throw new Error("Could not start secure checkout.");
      window.location.assign(result.url);
    } catch (checkoutError) {
      console.error("Could not start Stripe checkout:", checkoutError);
      setError(checkoutError.message || "Could not start secure checkout.");
      setStartingCheckout(false);
    }
  }

  if (verifying || paymentComplete) {
    return (
      <div className="platform-payment-result">
        {paymentComplete && <div className="platform-payment-success-icon">✓</div>}
        <h1>{paymentComplete ? "Payment successful" : "Confirming payment"}</h1>
        <p>
          {paymentComplete
            ? "Your account is active. You are being redirected to your dashboard."
            : "Please wait while GETCYB confirms your payment securely."}
        </p>
      </div>
    );
  }

  return (
    <div className="platform-payment-page">
      <header className="platform-payment-header">
        <button type="button" onClick={() => navigate("/")}>GETCYB</button>
        <button type="button" className="platform-payment-back" onClick={() => navigate(-1)}>
          Go back
        </button>
      </header>

      <main className="platform-payment-main">
        <section className="platform-payment-information">
          <span>One-time payment</span>
          <h1>Open your business platform.</h1>
          <p>Pay once and activate access to GETCYB.</p>

          <div className="platform-payment-price">
            <strong>$245</strong>
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
          <span>Secure checkout</span>
          <h2>Pay with Apple Pay or card</h2>
          <p>Choose from the payment methods available to you at Stripe Checkout.</p>

          {error && <div className="platform-payment-error">{error}</div>}

          <button
            type="button"
            className="platform-checkout-button"
            onClick={startCheckout}
            disabled={startingCheckout}
          >
            {startingCheckout ? "Opening secure checkout…" : "Continue to secure checkout"}
          </button>

          <small>Your account activates only after Stripe confirms the payment.</small>
        </section>
      </main>
    </div>
  );
}

export default PlatformPayment;

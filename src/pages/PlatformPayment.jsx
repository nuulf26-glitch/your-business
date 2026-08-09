import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PayPalButtons } from "@paypal/react-paypal-js";
import { auth } from "../firebase";
import "../styles/platformPayment.css";

const CREATE_ORDER_URL =
  "https://us-central1-your-business-47e44.cloudfunctions.net/createPayPalOrder";

const CAPTURE_ORDER_URL =
  "https://us-central1-your-business-47e44.cloudfunctions.net/capturePayPalOrder";

function PlatformPayment() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);

  async function getUserToken() {
    const user = auth.currentUser;

    if (!user) {
      throw new Error("Please sign in before paying.");
    }

    return user.getIdToken();
  }

  async function createOrder() {
    try {
      setError("");

      const token = await getUserToken();

      const response = await fetch(CREATE_ORDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.orderId) {
        throw new Error(
          data.message || "Could not start the PayPal payment."
        );
      }

      return data.orderId;
    } catch (paymentError) {
      console.error("Create PayPal order error:", paymentError);

      setError(
        paymentError.message ||
          "Could not start the PayPal payment."
      );

      throw paymentError;
    }
  }

  async function captureOrder(data) {
    try {
      setError("");

      const token = await getUserToken();

      const response = await fetch(CAPTURE_ORDER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          orderId: data.orderID,
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "The payment could not be confirmed."
        );
      }

      setPaymentComplete(true);

      window.setTimeout(() => {
        navigate("/dashboard", {
          replace: true,
        });
      }, 1800);
    } catch (paymentError) {
      console.error("Capture PayPal order error:", paymentError);

      setError(
        paymentError.message ||
          "The payment could not be confirmed."
      );

      throw paymentError;
    }
  }

  function handlePayPalError(paypalError) {
    console.error("PayPal checkout error:", paypalError);

    setError(
      "PayPal could not complete the payment. Please try again."
    );
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
          Your Business
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
            Pay once and activate access to Your Business.
          </p>

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
          <span>Secure payment</span>

          <h2>Pay with PayPal or card</h2>

          <p>
            Complete the one-time payment to activate your account.
          </p>

          {error && (
            <div className="platform-payment-error">
              {error}
            </div>
          )}

          <div className="platform-paypal-buttons">
            <PayPalButtons
              style={{
                layout: "vertical",
                shape: "rect",
                label: "pay",
                height: 48,
              }}
              createOrder={createOrder}
              onApprove={captureOrder}
              onError={handlePayPalError}
              onCancel={() => {
                setError(
                  "The payment was cancelled. No money was taken."
                );
              }}
            />
          </div>

          <small>
            Your account opens only after PayPal confirms the payment.
          </small>
        </section>
      </main>
    </div>
  );
}

export default PlatformPayment;
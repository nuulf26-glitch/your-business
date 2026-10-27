import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/platformPayment.css";

function PlatformPayment() {
  const navigate = useNavigate();

  const [error, setError] = useState("");
  const [paymentComplete, setPaymentComplete] = useState(false);
  const applePayMount = useRef(null);
  const [{ isResolved: paypalSdkReady }] = usePayPalScriptReducer();

  const createOrder = useCallback(async () => {
    try {
      setError("");

      const result = await customBackendRequest('/payments/paypal/orders', { method: 'POST' });
      if (!result?.orderId) throw new Error('Could not start the PayPal payment.');
      return result.orderId;
    } catch (paymentError) {
      console.error("Create PayPal order error:", paymentError);

      setError(
        paymentError.message ||
          "Could not start the PayPal payment."
      );

      throw paymentError;
    }
  }, []);

  const captureOrder = useCallback(async (data) => {
    try {
      setError("");

      const result = await customBackendRequest('/payments/paypal/capture', { method: 'POST', body: JSON.stringify({ orderId: data.orderID }) });
      if (!result?.success) throw new Error('The payment could not be confirmed.');
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
  }, [navigate]);

  function handlePayPalError(paypalError) {
    console.error("PayPal checkout error:", paypalError);

    setError(
      "PayPal could not complete the payment. Please try again."
    );
  }

  useEffect(() => {
    if (!paypalSdkReady || !applePayMount.current) return undefined;

    let cancelled = false;
    let button;
    let applePay;

    async function mountApplePay() {
      try {
        if (!window.ApplePaySession || !window.ApplePaySession.canMakePayments()) return;

        applePay = window.paypal?.Applepay?.();
        if (!applePay) return;

        const config = await applePay.config();
        if (cancelled || !config?.isEligible) return;

        button = document.createElement("apple-pay-button");
        button.setAttribute("buttonstyle", "black");
        button.setAttribute("type", "buy");
        button.setAttribute("locale", "en");
        button.className = "platform-apple-pay-button";

        button.addEventListener("click", () => {
          setError("");

          const session = new window.ApplePaySession(4, {
            countryCode: config.countryCode,
            merchantCapabilities: config.merchantCapabilities,
            supportedNetworks: config.supportedNetworks,
            currencyCode: "USD",
            requiredBillingContactFields: ["name", "email", "postalAddress"],
            total: {
              label: "GETCYB",
              amount: "245.00",
              type: "final",
            },
          });

          session.onvalidatemerchant = async (event) => {
            try {
              const validation = await applePay.validateMerchant({
                validationUrl: event.validationURL,
                displayName: "GETCYB",
              });
              session.completeMerchantValidation(validation.merchantSession);
            } catch (validationError) {
              console.error("Apple Pay merchant validation error:", validationError);
              setError("Apple Pay could not verify this website. Please use PayPal or card.");
              session.abort();
            }
          };

          session.onpaymentauthorized = async (event) => {
            try {
              const orderId = await createOrder();
              await applePay.confirmOrder({
                orderId,
                token: event.payment.token,
                billingContact: event.payment.billingContact,
              });
              await captureOrder({ orderID: orderId });
              session.completePayment(window.ApplePaySession.STATUS_SUCCESS);
            } catch (paymentError) {
              console.error("Apple Pay payment error:", paymentError);
              setError(paymentError.message || "Apple Pay could not complete the payment. Please try PayPal or card.");
              session.completePayment(window.ApplePaySession.STATUS_FAILURE);
            }
          };

          session.oncancel = () => {
            setError("The payment was cancelled. No money was taken.");
          };

          session.begin();
        });

        applePayMount.current?.appendChild(button);
      } catch (applePayError) {
        console.error("Apple Pay eligibility check failed:", applePayError);
      }
    }

    mountApplePay();

    return () => {
      cancelled = true;
      button?.remove();
    };
  }, [paypalSdkReady, createOrder, captureOrder]);

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

          <h2>Pay with Apple Pay, PayPal, or card</h2>

          <p>
            Complete the one-time payment to activate your account.
          </p>

          {error && (
            <div className="platform-payment-error">
              {error}
            </div>
          )}

          <div ref={applePayMount} className="platform-apple-pay-mount" />

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

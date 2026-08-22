import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/payment.css";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
function Payment() {
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("paypal");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem("pendingOrder");

      if (savedOrder) {
        setOrder(JSON.parse(savedOrder));
      }
    } catch (loadError) {
      console.error("Could not load pending order:", loadError);
      setError("Could not load the order.");
    }
  }, []);

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
if (order.firebaseId) {
  await updateDoc(
    doc(db, "orders", order.firebaseId),
    {
      paymentMethod,
      paymentStatus,
      status: orderStatus,
      completedAt: new Date(),
    }
  );
}

    localStorage.setItem(
      "completedOrder",
      JSON.stringify(completedOrder)
    );

    localStorage.removeItem("pendingOrder");
    localStorage.removeItem("businessCart");

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

      if (paymentMethod === "paypal") {
        await new Promise((resolve) => {
          window.setTimeout(resolve, 1000);
        });

        setError(
          "PayPal is not connected yet. Complete the Firebase and PayPal setup first."
        );

        return;
      }

     if (paymentMethod === "cash") {
  await completeOrder("Cash on delivery", "New");
}

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
          Your Business
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
            Choose your payment method and review your order.
          </p>
        </div>

        <div className="payment-layout">
          <section className="payment-method-card">
            <div className="payment-card-heading">
              <span>Payment method</span>

              <h2>How would you like to pay?</h2>
            </div>

            <div className="payment-options">
              <button
                type="button"
                className={`payment-option ${
                  paymentMethod === "paypal" ? "selected" : ""
                }`}
                onClick={() => {
                  setPaymentMethod("paypal");
                  setError("");
                }}
              >
                <div className="payment-option-icon">P</div>

                <div>
                  <strong>PayPal</strong>

                  <p>
                    Pay securely using PayPal.
                  </p>
                </div>

                <span className="payment-radio">
                  {paymentMethod === "paypal" ? "✓" : ""}
                </span>
              </button>

              <button
                type="button"
                className={`payment-option ${
                  paymentMethod === "cash" ? "selected" : ""
                }`}
                onClick={() => {
                  setPaymentMethod("cash");
                  setError("");
                }}
              >
                <div className="payment-option-icon">C</div>

                <div>
                  <strong>Cash on delivery</strong>

                  <p>
                    Pay when your order arrives.
                  </p>
                </div>

                <span className="payment-radio">
                  {paymentMethod === "cash" ? "✓" : ""}
                </span>
              </button>
            </div>

            {paymentMethod === "paypal" && (
              <div className="payment-notice">
                <strong>PayPal setup required</strong>

                <p>
                  PayPal will work after Firebase credentials are connected.
                </p>
              </div>
            )}

            {error && (
              <p className="payment-error">
                {error}
              </p>
            )}

            <button
              type="button"
              className="payment-submit-button"
              onClick={handlePayment}
              disabled={loading}
            >
              {loading
                ? "Processing..."
                : paymentMethod === "cash"
                  ? "Confirm cash on delivery"
                  : `Pay USD ${Number(order.total || 0).toFixed(2)}`}
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
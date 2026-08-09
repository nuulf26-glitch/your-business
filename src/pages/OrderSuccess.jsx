import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/orderSuccess.css";

function OrderSuccess() {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    try {
      const savedOrder = localStorage.getItem("completedOrder");

      if (savedOrder) {
        setOrder(JSON.parse(savedOrder));
      }
    } catch (error) {
      console.error("Could not load completed order:", error);
    }
  }, []);

  if (!order) {
    return (
      <div className="order-success-empty">
        <h1>Order not found</h1>

        <p>We could not find a completed order.</p>

        <button type="button" onClick={() => navigate("/")}>
          Return home
        </button>
      </div>
    );
  }

  return (
    <div className="order-success-page">
      <header className="order-success-header">
        <button
          type="button"
          className="order-success-logo"
          onClick={() => navigate("/")}
        >
          Your Business
        </button>
      </header>

      <main className="order-success-main">
        <section className="order-success-card">
          <div className="order-success-icon">✓</div>

          <span>Order confirmed</span>

          <h1>Thank you for your order.</h1>

          <p>
            Your order has been received. You will receive updates using the
            contact details you provided.
          </p>

          <div className="order-success-number">
            <span>Order number</span>
            <strong>{order.id}</strong>
          </div>

          <div className="order-success-details">
            <div>
              <span>Customer</span>
              <strong>{order.customerName}</strong>
            </div>

            <div>
              <span>Payment</span>
              <strong>{order.paymentStatus}</strong>
            </div>

            <div>
              <span>Order status</span>
              <strong>{order.status}</strong>
            </div>

            <div>
              <span>Total</span>
              <strong>USD {Number(order.total).toFixed(2)}</strong>
            </div>
          </div>

          <div className="order-success-items">
            <h2>Order items</h2>

            {order.items?.map((item) => (
              <div className="order-success-item" key={item.productId}>
                <div>
                  <strong>{item.name}</strong>

                  <span>
                    Quantity: {item.quantity}
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

          <div className="order-success-address">
            <span>Delivery address</span>

            <strong>
              {order.address}, {order.city}
            </strong>
          </div>

          <div className="order-success-actions">
            <button type="button" onClick={() => navigate("/")}>
              Return home
            </button>

            <button
              type="button"
              className="secondary"
              onClick={() => window.print()}
            >
              Print receipt
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

export default OrderSuccess;
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/checkout.css";
import { addDoc, collection } from "firebase/firestore";
import { db, auth } from "../firebase";

const initialForm = {
  fullName: "",
  email: "",
  phone: "",
  address: "",
  city: "",
  notes: "",
};

function Checkout() {
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const savedCart = localStorage.getItem("businessCart");
      const parsedCart = savedCart ? JSON.parse(savedCart) : [];

      if (Array.isArray(parsedCart)) {
        setCart(parsedCart);
      }
    } catch (loadError) {
      console.error("Could not load cart:", loadError);
    }
  }, []);

  const subtotal = useMemo(() => {
    return cart.reduce((total, item) => {
      return total + Number(item.price) * Number(item.quantity);
    }, 0);
  }, [cart]);

  const shipping = subtotal >= 300 ? 0 : 25;
  const total = subtotal + shipping;

  function handleChange(event) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function validateForm() {
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

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      const orderId = `ORD-${Date.now()}`;
const storeUrl = cart[0]?.storeUrl || "";
     
  const newOrder = {
  id: orderId,
  userId: auth.currentUser?.uid || "",
  storeUrl,
  customerName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
        city: form.city.trim(),
        notes: form.notes.trim(),
        items: cart,
        subtotal,
        shipping,
        total,
        status: "New",
        paymentStatus: "Pending",
        date: new Date().toISOString(),
      };
await addDoc(collection(db, "orders"), {
  ...newOrder,
  createdAt: new Date(),
});
      const savedOrders = localStorage.getItem("businessOrders");
      const parsedOrders = savedOrders ? JSON.parse(savedOrders) : [];
      const safeOrders = Array.isArray(parsedOrders) ? parsedOrders : [];

      localStorage.setItem(
        "businessOrders",
        JSON.stringify([newOrder, ...safeOrders])
      );

      const savedCustomers = localStorage.getItem("businessCustomers");
      const parsedCustomers = savedCustomers
        ? JSON.parse(savedCustomers)
        : [];
      const safeCustomers = Array.isArray(parsedCustomers)
        ? parsedCustomers
        : [];

      const existingCustomer = safeCustomers.find(
        (customer) =>
          customer.email.toLowerCase() === form.email.trim().toLowerCase()
      );

      let updatedCustomers;

      if (existingCustomer) {
        updatedCustomers = safeCustomers.map((customer) =>
          customer.id === existingCustomer.id
            ? {
                ...customer,
                name: form.fullName.trim(),
                phone: form.phone.trim(),
                orders: Number(customer.orders || 0) + 1,
                totalSpent: Number(customer.totalSpent || 0) + total,
                lastOrder: new Date().toISOString().slice(0, 10),
                status: "Active",
              }
            : customer
        );
      } else {
        updatedCustomers = [
          {
            id: `customer-${Date.now()}`,
            name: form.fullName.trim(),
            email: form.email.trim(),
            phone: form.phone.trim(),
            orders: 1,
            totalSpent: total,
            lastOrder: new Date().toISOString().slice(0, 10),
            status: "New",
          },
          ...safeCustomers,
        ];
      }

      localStorage.setItem(
        "businessCustomers",
        JSON.stringify(updatedCustomers)
      );

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
          Your Business
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
              <strong>USD {subtotal.toFixed(2)}</strong>
            </div>

            <div className="checkout-summary-row">
              <span>Shipping</span>
              <strong>
                {shipping === 0 ? "Free" : `USD ${shipping.toFixed(2)}`}
              </strong>
            </div>

            <div className="checkout-summary-total">
              <span>Total</span>
              <strong>USD {total.toFixed(2)}</strong>
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
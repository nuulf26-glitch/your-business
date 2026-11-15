import { useEffect, useState } from "react";
import DashboardLayout from "../layouts/DashboardLayout";
import { subscribeAppUser } from "../services/customBackendSession";
import { getOrders, updateOrderStatus } from "../services/orderService";
import "../styles/shipping.css";

export default function Shipping() {
  const [user, setUser] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  const fetchDeliveries = async () => {
    try {
      setLoading(true);
      setDeliveries(await getOrders());
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = subscribeAppUser((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchDeliveries();
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    try {
      await updateOrderStatus(orderId, newStatus);
      setDeliveries(deliveries.map(item => item.id === orderId ? { ...item, shippingStatus: newStatus, status: newStatus } : item));
      setMessage("Shipping status updated successfully!");
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      console.error("Error updating status:", error);
      setMessage("Failed to update status.");
    }
  };

  const processingCount = deliveries.filter(d => (d.shippingStatus || "Processing") === "Processing").length;
  const shippedCount = deliveries.filter(d => d.shippingStatus === "Shipped").length;
  const deliveredCount = deliveries.filter(d => d.shippingStatus === "Delivered").length;

  const filteredDeliveries = deliveries.filter(d => {
    const status = d.shippingStatus || "Processing";
    if (filter === "all") return true;
    return status.toLowerCase() === filter.toLowerCase();
  });

  return (
    <DashboardLayout>
      <main className="shipping-page">
        
        {/* Header */}
        <header className="shipping-header">
          <div>
            <span className="shipping-eyebrow">Delivery management</span>
            <h1>Shipping &amp; deliveries</h1>
            <p>Manage active deliveries and update each order’s shipping status.</p>
          </div>
          <button className="shipping-refresh-button"
            onClick={() => user && fetchDeliveries(user)}
          >
            🔄 Refresh deliveries
          </button>
        </header>

        {message && (
          <div className="shipping-message" role="status">
            {message}
          </div>
        )}

        {/* Metrics Cards */}
        <div className="shipping-summary-grid">
          <article className="shipping-summary-card"><span>Processing</span><strong>{processingCount}</strong><small>Being prepared</small></article>
          <article className="shipping-summary-card"><span>Shipped</span><strong>{shippedCount}</strong><small>In transit</small></article>
          <article className="shipping-summary-card"><span>Delivered</span><strong>{deliveredCount}</strong><small>Completed</small></article>
        </div>

        {/* Filter Tabs */}
        <nav className="shipping-filters" aria-label="Filter deliveries">
          {["all", "processing", "shipped", "delivered"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={filter === tab ? "active" : ""}
              aria-pressed={filter === tab}
            >
              {tab} ({tab === "all" ? deliveries.length : deliveries.filter(d => (d.shippingStatus || "Processing").toLowerCase() === tab).length})
            </button>
          ))}
        </nav>

        {/* Content List */}
        {loading ? (
          <div className="shipping-empty-state" role="status">Loading deliveries...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div className="shipping-empty-state">
            <div aria-hidden="true" className="shipping-empty-icon">↗</div>
            <h2>No deliveries yet</h2>
            <p>Orders will appear here once their status changes to Processing, Shipped, or Delivered.</p>
          </div>
        ) : (
          <div className="shipping-delivery-list">
            {filteredDeliveries.map((order) => {
              const currentStatus = order.shippingStatus || "Processing";
              return (
                <article key={order.id} className="shipping-delivery-card">
                  <div className="shipping-delivery-info">
                    <div className="shipping-delivery-title">
                      <strong>Order #{order.id.slice(0, 8)}</strong>
                      <span className={`shipping-status shipping-status-${currentStatus.toLowerCase()}`}>
                        {currentStatus}
                      </span>
                    </div>
                    <p>Customer: {order.customerName || order.email || "Guest Customer"}</p>
                    <p>Total Amount: ${order.totalAmount || order.total || "0.00"}</p>
                  </div>

                  <div className="shipping-delivery-actions">
                    <select
                      value={currentStatus}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      aria-label={`Shipping status for order ${order.id}`}
                    >
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </article>
              );
            })}
          </div>
        )}

      </main>
    </DashboardLayout>
  );
}

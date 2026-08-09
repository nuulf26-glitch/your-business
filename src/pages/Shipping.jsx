import { useEffect, useState } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import DashboardLayout from "../layouts/DashboardLayout";
import { auth, db } from "../firebase";

export default function Shipping() {
  const [user, setUser] = useState(null);
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [message, setMessage] = useState("");

  const fetchDeliveries = async (currentUser) => {
    try {
      setLoading(true);
      const q = query(collection(db, "orders"), where("userId", "==", currentUser.uid));
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDeliveries(list);
    } catch (error) {
      console.error("Error fetching deliveries:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        fetchDeliveries(currentUser);
      } else {
        setUser(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const updateStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId);
      await updateDoc(orderRef, { shippingStatus: newStatus });
      setDeliveries(deliveries.map(item => item.id === orderId ? { ...item, shippingStatus: newStatus } : item));
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
      <div style={{ padding: "30px", maxWidth: "1200px", margin: "0 auto", fontFamily: "system-ui, sans-serif", color: "#0f172a" }}>
        
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", color: "#64748b", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>Delivery Management</span>
            <h1 style={{ fontSize: "2rem", fontWeight: "800", marginTop: "4px" }}>Shipping & Deliveries</h1>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginTop: "4px" }}>Manage active deliveries and update each order’s shipping status seamlessly.</p>
          </div>
          <button 
            onClick={() => user && fetchDeliveries(user)}
            style={{
              background: "#fff",
              border: "1px solid #cbd5e1",
              padding: "10px 18px",
              borderRadius: "10px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
            }}
          >
            🔄 Refresh deliveries
          </button>
        </div>

        {message && (
          <div style={{ marginBottom: "20px", padding: "12px 16px", background: "#ecfdf5", border: "1px solid #10b981", color: "#065f46", borderRadius: "8px", fontWeight: "600" }}>
            {message}
          </div>
        )}

        {/* Metrics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "30px" }}>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>Processing / Being Prepared</span>
            <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "#d97706", marginTop: "8px" }}>{processingCount}</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>Shipped / In Transit</span>
            <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "#2563eb", marginTop: "8px" }}>{shippedCount}</div>
          </div>
          <div style={{ background: "#fff", padding: "20px", borderRadius: "16px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
            <span style={{ fontSize: "0.85rem", color: "#64748b", fontWeight: "600" }}>Delivered / Completed</span>
            <div style={{ fontSize: "2.2rem", fontWeight: "800", color: "#10b981", marginTop: "8px" }}>{deliveredCount}</div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "20px", borderBottom: "1px solid #e2e8f0", paddingBottom: "15px" }}>
          {["all", "processing", "shipped", "delivered"].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                background: filter === tab ? "#0f172a" : "#f1f5f9",
                color: filter === tab ? "#fff" : "#475569",
                fontWeight: "600",
                cursor: "pointer",
                textTransform: "capitalize",
                fontSize: "0.9rem"
              }}
            >
              {tab} ({tab === "all" ? deliveries.length : deliveries.filter(d => (d.shippingStatus || "Processing").toLowerCase() === tab).length})
            </button>
          ))}
        </div>

        {/* Content List */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>Loading deliveries...</div>
        ) : filteredDeliveries.length === 0 ? (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "60px 20px", textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "10px" }}>📦</div>
            <h3 style={{ fontSize: "1.2rem", fontWeight: "700", marginBottom: "6px" }}>No deliveries yet</h3>
            <p style={{ color: "#64748b", fontSize: "0.95rem" }}>Orders will appear here once their status changes to Processing, Shipped, or Delivered.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
            {filteredDeliveries.map((order) => {
              const currentStatus = order.shippingStatus || "Processing";
              return (
                <div key={order.id} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: "14px", padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.02)" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
                      <span style={{ fontWeight: "700", fontSize: "1.05rem" }}>Order #{order.id.slice(0, 8)}</span>
                      <span style={{
                        padding: "4px 10px",
                        borderRadius: "20px",
                        fontSize: "0.75rem",
                        fontWeight: "700",
                        background: currentStatus === "Delivered" ? "#ecfdf5" : currentStatus === "Shipped" ? "#eff6ff" : "#fef3c7",
                        color: currentStatus === "Delivered" ? "#059669" : currentStatus === "Shipped" ? "#1d4ed8" : "#d97706"
                      }}>
                        {currentStatus}
                      </span>
                    </div>
                    <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "2px 0" }}>Customer: {order.customerName || order.email || "Guest Customer"}</p>
                    <p style={{ color: "#64748b", fontSize: "0.9rem", margin: "2px 0" }}>Total Amount: ${order.totalAmount || order.total || "0.00"}</p>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    <select
                      value={currentStatus}
                      onChange={(e) => updateStatus(order.id, e.target.value)}
                      style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid #cbd5e1", background: "#fff", fontWeight: "600", fontSize: "0.9rem" }}
                    >
                      <option value="Processing">Processing</option>
                      <option value="Shipped">Shipped</option>
                      <option value="Delivered">Delivered</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
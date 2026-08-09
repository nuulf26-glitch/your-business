import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import DashboardLayout from "../layouts/DashboardLayout";
import { db } from "../firebase";

function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [savingTracking, setSavingTracking] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [shippingCompany, setShippingCompany] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");

  useEffect(() => {
    async function loadOrder() {
      try {
        setLoading(true);
        setError("");

        const orderReference = doc(db, "orders", orderId);
        const orderSnapshot = await getDoc(orderReference);

        if (!orderSnapshot.exists()) {
          setError("Order not found.");
          return;
        }

        const orderData = {
          id: orderSnapshot.id,
          ...orderSnapshot.data(),
        };

        setOrder(orderData);
        setShippingCompany(orderData.shippingCompany || "");
        setTrackingNumber(orderData.trackingNumber || "");
        setTrackingUrl(orderData.trackingUrl || "");
      } catch (loadError) {
        console.error("Error loading order:", loadError);
        setError("Could not load the order.");
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId]);

  const orderItems = useMemo(() => {
    if (Array.isArray(order?.items) && order.items.length > 0) {
      return order.items;
    }

    if (order?.productName) {
      return [
        {
          id: order.productId || "single-product",
          name: order.productName,
          description: order.productDescription || "",
          imageUrl: order.productImageUrl || "",
          price: Number(order.productPrice || 0),
          quantity: 1,
        },
      ];
    }

    return [];
  }, [order]);

  const totalItems = useMemo(() => {
    return orderItems.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
  }, [orderItems]);

  const totalAmount = useMemo(() => {
    if (order?.totalAmount !== undefined) {
      return Number(order.totalAmount || 0);
    }

    return orderItems.reduce((total, item) => {
      return (
        total +
        Number(item.price || 0) * Number(item.quantity || 0)
      );
    }, 0);
  }, [order, orderItems]);

  async function handleStatusChange(newStatus) {
    try {
      setUpdating(true);
      setError("");
      setSuccessMessage("");

      const orderReference = doc(db, "orders", orderId);

      await updateDoc(orderReference, {
        status: newStatus,
      });

      setOrder((currentOrder) => ({
        ...currentOrder,
        status: newStatus,
      }));

      setSuccessMessage("Order status updated successfully.");
    } catch (statusError) {
      console.error("Error updating order status:", statusError);
      setError("Could not update the order status.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleSaveTracking(event) {
    event.preventDefault();

    if (!shippingCompany.trim() || !trackingNumber.trim()) {
      setError("Please enter the shipping company and tracking number.");
      setSuccessMessage("");
      return;
    }

    try {
      setSavingTracking(true);
      setError("");
      setSuccessMessage("");

      const trackingData = {
        shippingCompany: shippingCompany.trim(),
        trackingNumber: trackingNumber.trim(),
        trackingUrl: trackingUrl.trim(),
        shippingUpdatedAt: new Date().toISOString(),
      };

      const orderReference = doc(db, "orders", orderId);

      await updateDoc(orderReference, trackingData);

      setOrder((currentOrder) => ({
        ...currentOrder,
        ...trackingData,
      }));

      setSuccessMessage("Tracking information saved successfully.");
    } catch (trackingError) {
      console.error("Error saving tracking information:", trackingError);
      setError("Could not save the tracking information.");
    } finally {
      setSavingTracking(false);
    }
  }

  function formatDate(createdAt) {
    if (!createdAt) {
      return "No date";
    }

    if (createdAt.toDate) {
      return createdAt.toDate().toLocaleString();
    }

    const date = new Date(createdAt);

    if (Number.isNaN(date.getTime())) {
      return "No date";
    }

    return date.toLocaleString();
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div style={styles.messageBox}>
          <h2>Loading order...</h2>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !order) {
    return (
      <DashboardLayout>
        <div style={styles.messageBox}>
          <h2>{error}</h2>

          <button
            type="button"
            style={styles.backButton}
            onClick={() => navigate("/orders")}
          >
            Back to Orders
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div style={styles.page}>
        <div style={styles.header}>
          <div>
            <button
              type="button"
              style={styles.smallBackButton}
              onClick={() => navigate("/orders")}
            >
              ← Back to Orders
            </button>

            <h1 style={styles.title}>Order Details</h1>

            <p style={styles.subtitle}>
              Review customer, products, delivery, and tracking information.
            </p>
          </div>

          <div style={styles.statusArea}>
            <label htmlFor="status" style={styles.statusLabel}>
              Order Status
            </label>

            <select
              id="status"
              value={order.status || "New"}
              disabled={updating}
              onChange={(event) =>
                handleStatusChange(event.target.value)
              }
              style={styles.statusSelect}
            >
              <option value="New">New</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Completed">Completed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {error && <div style={styles.errorMessage}>{error}</div>}

        {successMessage && (
          <div style={styles.successMessage}>
            {successMessage}
          </div>
        )}

        <div style={styles.layout}>
          <div style={styles.leftColumn}>
            <section style={styles.mainCard}>
              <h2 style={styles.sectionTitle}>
                Customer Information
              </h2>

              <div style={styles.infoGrid}>
                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>Full Name</span>

                  <strong style={styles.infoValue}>
                    {order.fullName || "Not provided"}
                  </strong>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>
                    Phone Number
                  </span>

                  <strong style={styles.infoValue}>
                    {order.phone || "Not provided"}
                  </strong>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>City</span>

                  <strong style={styles.infoValue}>
                    {order.city || "Not provided"}
                  </strong>
                </div>

                <div style={styles.infoBox}>
                  <span style={styles.infoLabel}>Order Date</span>

                  <strong style={styles.infoValue}>
                    {formatDate(order.createdAt)}
                  </strong>
                </div>
              </div>

              <div style={styles.addressBox}>
                <span style={styles.infoLabel}>
                  Delivery Address
                </span>

                <strong style={styles.infoValue}>
                  {order.address || "Not provided"}
                </strong>
              </div>

              {order.notes && (
                <div style={styles.notesBox}>
                  <span style={styles.infoLabel}>Order Notes</span>

                  <strong style={styles.infoValue}>
                    {order.notes}
                  </strong>
                </div>
              )}
            </section>

            <section style={styles.productsCard}>
              <h2 style={styles.sectionTitle}>
                Products ({totalItems})
              </h2>

              <div style={styles.productsList}>
                {orderItems.map((item, index) => (
                  <div
                    key={item.id || `${item.name}-${index}`}
                    style={styles.productItem}
                  >
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        style={styles.productImage}
                      />
                    ) : (
                      <div style={styles.imagePlaceholder}>
                        No image
                      </div>
                    )}

                    <div style={styles.productInformation}>
                      <h3 style={styles.productName}>
                        {item.name || "Product"}
                      </h3>

                      <p style={styles.productDescription}>
                        {item.description ||
                          "No description available."}
                      </p>

                      <p style={styles.quantityText}>
                        Quantity: {Number(item.quantity || 1)}
                      </p>
                    </div>

                    <div style={styles.productPriceArea}>
                      <span style={styles.unitPrice}>
                        {Number(item.price || 0).toFixed(2)} USD each
                      </span>

                      <strong style={styles.price}>
                        {(
                          Number(item.price || 0) *
                          Number(item.quantity || 1)
                        ).toFixed(2)}{" "}
                        USD
                      </strong>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section style={styles.trackingCard}>
              <h2 style={styles.sectionTitle}>
                Shipping and Tracking
              </h2>

              <p style={styles.trackingDescription}>
                Add the shipping company and tracking details for this
                order.
              </p>

              <form
                onSubmit={handleSaveTracking}
                style={styles.trackingForm}
              >
                <div style={styles.fieldGroup}>
                  <label
                    htmlFor="shippingCompany"
                    style={styles.label}
                  >
                    Shipping Company
                  </label>

                  <input
                    id="shippingCompany"
                    type="text"
                    value={shippingCompany}
                    onChange={(event) =>
                      setShippingCompany(event.target.value)
                    }
                    placeholder="Example: Aramex"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label
                    htmlFor="trackingNumber"
                    style={styles.label}
                  >
                    Tracking Number
                  </label>

                  <input
                    id="trackingNumber"
                    type="text"
                    value={trackingNumber}
                    onChange={(event) =>
                      setTrackingNumber(event.target.value)
                    }
                    placeholder="Enter tracking number"
                    style={styles.input}
                  />
                </div>

                <div style={styles.fieldGroup}>
                  <label
                    htmlFor="trackingUrl"
                    style={styles.label}
                  >
                    Tracking Link
                  </label>

                  <input
                    id="trackingUrl"
                    type="url"
                    value={trackingUrl}
                    onChange={(event) =>
                      setTrackingUrl(event.target.value)
                    }
                    placeholder="https://example.com/track"
                    style={styles.input}
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingTracking}
                  style={{
                    ...styles.saveButton,
                    opacity: savingTracking ? 0.7 : 1,
                    cursor: savingTracking
                      ? "not-allowed"
                      : "pointer",
                  }}
                >
                  {savingTracking
                    ? "Saving..."
                    : "Save Tracking Information"}
                </button>
              </form>

              {order.trackingNumber && (
                <div style={styles.savedTrackingBox}>
                  <h3 style={styles.savedTrackingTitle}>
                    Saved Tracking Details
                  </h3>

                  <p style={styles.savedTrackingText}>
                    <strong>Company:</strong>{" "}
                    {order.shippingCompany || "Not available"}
                  </p>

                  <p style={styles.savedTrackingText}>
                    <strong>Tracking Number:</strong>{" "}
                    {order.trackingNumber}
                  </p>

                  {order.trackingUrl && (
                    <a
                      href={order.trackingUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={styles.trackingLink}
                    >
                      Open Tracking Link
                    </a>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside style={styles.summaryCard}>
            <h2 style={styles.sectionTitle}>Order Summary</h2>

            <div style={styles.summaryRow}>
              <span>Store</span>
              <strong>{order.storeName || "Store"}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Store URL</span>
              <strong>{order.storeUrl || "Not available"}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Items</span>
              <strong>{totalItems}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Checkout Type</span>
              <strong>
                {order.checkoutType === "cart"
                  ? "Cart"
                  : "Buy Now"}
              </strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Status</span>
              <strong>{order.status || "New"}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Payment</span>
              <strong>{order.paymentStatus || "Pending"}</strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Shipping Company</span>
              <strong>
                {order.shippingCompany || "Not added"}
              </strong>
            </div>

            <div style={styles.summaryRow}>
              <span>Tracking Number</span>
              <strong>
                {order.trackingNumber || "Not added"}
              </strong>
            </div>

            <div style={styles.totalRow}>
              <span>Total</span>

              <strong>{totalAmount.toFixed(2)} USD</strong>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}

const styles = {
  page: {
    padding: "10px",
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "20px",
    marginBottom: "30px",
    flexWrap: "wrap",
  },

  smallBackButton: {
    border: "none",
    backgroundColor: "transparent",
    padding: 0,
    marginBottom: "15px",
    color: "#555555",
    cursor: "pointer",
    fontSize: "15px",
  },

  title: {
    margin: "0 0 8px",
    fontSize: "34px",
    color: "#111111",
  },

  subtitle: {
    margin: 0,
    color: "#666666",
  },

  statusArea: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    minWidth: "200px",
  },

  statusLabel: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333333",
  },

  statusSelect: {
    border: "1px solid #d8d8d8",
    borderRadius: "9px",
    padding: "11px 12px",
    backgroundColor: "#ffffff",
    fontSize: "15px",
  },

  layout: {
    display: "grid",
    gridTemplateColumns:
      "minmax(0, 1.4fr) minmax(280px, 0.7fr)",
    gap: "24px",
    alignItems: "start",
  },

  leftColumn: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
  },

  mainCard: {
    backgroundColor: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #e8e8e8",
  },

  productsCard: {
    backgroundColor: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #e8e8e8",
  },

  trackingCard: {
    backgroundColor: "#ffffff",
    padding: "28px",
    borderRadius: "16px",
    border: "1px solid #e8e8e8",
  },

  summaryCard: {
    backgroundColor: "#ffffff",
    padding: "24px",
    borderRadius: "16px",
    border: "1px solid #e8e8e8",
    position: "sticky",
    top: "20px",
  },

  sectionTitle: {
    margin: "0 0 20px",
    fontSize: "22px",
    color: "#111111",
  },

  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: "14px",
    marginBottom: "14px",
  },

  infoBox: {
    backgroundColor: "#f8f8f8",
    padding: "16px",
    borderRadius: "10px",
  },

  addressBox: {
    backgroundColor: "#f8f8f8",
    padding: "16px",
    borderRadius: "10px",
    marginBottom: "14px",
  },

  notesBox: {
    backgroundColor: "#fffaf0",
    padding: "16px",
    borderRadius: "10px",
  },

  infoLabel: {
    display: "block",
    marginBottom: "6px",
    color: "#777777",
    fontSize: "13px",
  },

  infoValue: {
    color: "#222222",
    overflowWrap: "anywhere",
  },

  productsList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },

  productItem: {
    display: "grid",
    gridTemplateColumns: "100px 1fr auto",
    gap: "18px",
    alignItems: "center",
    padding: "18px",
    borderRadius: "12px",
    backgroundColor: "#f8f8f8",
  },

  productImage: {
    width: "100px",
    height: "100px",
    objectFit: "cover",
    borderRadius: "10px",
  },

  imagePlaceholder: {
    width: "100px",
    height: "100px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "10px",
    backgroundColor: "#eeeeee",
    color: "#777777",
  },

  productInformation: {
    minWidth: 0,
  },

  productName: {
    margin: "0 0 8px",
    fontSize: "19px",
    color: "#111111",
  },

  productDescription: {
    margin: "0 0 9px",
    color: "#666666",
    lineHeight: 1.5,
  },

  quantityText: {
    margin: 0,
    color: "#444444",
    fontWeight: "600",
  },

  productPriceArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "8px",
    textAlign: "right",
  },

  unitPrice: {
    color: "#777777",
    fontSize: "13px",
  },

  price: {
    fontSize: "18px",
    color: "#111111",
  },

  trackingDescription: {
    margin: "-8px 0 24px",
    color: "#666666",
    lineHeight: 1.6,
  },

  trackingForm: {
    display: "flex",
    flexDirection: "column",
    gap: "18px",
  },

  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  label: {
    fontSize: "14px",
    fontWeight: "600",
    color: "#333333",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    border: "1px solid #d8d8d8",
    borderRadius: "9px",
    padding: "12px 13px",
    fontSize: "15px",
    outline: "none",
  },

  saveButton: {
    border: "none",
    borderRadius: "9px",
    padding: "13px 18px",
    backgroundColor: "#111111",
    color: "#ffffff",
    fontSize: "15px",
    fontWeight: "600",
  },

  savedTrackingBox: {
    marginTop: "24px",
    padding: "18px",
    borderRadius: "12px",
    backgroundColor: "#f7f7f7",
    border: "1px solid #e6e6e6",
  },

  savedTrackingTitle: {
    margin: "0 0 12px",
    fontSize: "18px",
    color: "#111111",
  },

  savedTrackingText: {
    margin: "0 0 8px",
    color: "#444444",
  },

  trackingLink: {
    display: "inline-block",
    marginTop: "8px",
    color: "#111111",
    fontWeight: "600",
  },

  summaryRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    padding: "15px 0",
    borderBottom: "1px solid #eeeeee",
    color: "#444444",
  },

  totalRow: {
    display: "flex",
    justifyContent: "space-between",
    gap: "15px",
    paddingTop: "18px",
    fontSize: "20px",
    color: "#111111",
  },

  errorMessage: {
    marginBottom: "20px",
    padding: "13px 15px",
    borderRadius: "9px",
    backgroundColor: "#fff0f0",
    color: "#b42318",
    border: "1px solid #ffc9c9",
  },

  successMessage: {
    marginBottom: "20px",
    padding: "13px 15px",
    borderRadius: "9px",
    backgroundColor: "#eaf8ef",
    color: "#157347",
    border: "1px solid #b7e4c7",
  },

  messageBox: {
    backgroundColor: "#ffffff",
    padding: "60px 20px",
    textAlign: "center",
    borderRadius: "16px",
    border: "1px solid #e8e8e8",
  },

  backButton: {
    border: "none",
    borderRadius: "8px",
    padding: "12px 20px",
    backgroundColor: "#111111",
    color: "#ffffff",
    cursor: "pointer",
    marginTop: "15px",
  },
};

export default OrderDetails;
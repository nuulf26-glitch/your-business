import { useEffect, useMemo, useState } from "react";
import "../styles/orders.css";
import DashboardLayout from "../layouts/DashboardLayout";
import { getOrders, updateOrderStatus as saveOrderStatus, updatePaymentStatus as savePaymentStatus, deleteOrder as removeOrder } from "../services/orderService";
import { InlineState } from "../components/ui/DesignPrimitives";
import { orderMetrics } from "../business/metrics";
const statuses = [
  "New",
  "Processing",
  "Packed",
  "Shipped",
  "Delivered",
  "Cancelled",
  "Returned",
];

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [listState, setListState] = useState("loading");
  const [loadVersion, setLoadVersion] = useState(0);
  const [paymentUpdates, setPaymentUpdates] = useState({});
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadOrders() {
      setListState("loading");
      try {
        const data = await getOrders();
        if (active) {
          setOrders(data);
          setListState("ready");
        }
      } catch (error) {
        console.error("Could not load orders:", error);
        if (active) {
          setOrders([]);
          setListState("error");
        }
      }
    }
    loadOrders();
    return () => { active = false; };
  }, [loadVersion]);
 

  const filteredOrders = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return orders.filter((order) => {
      const orderId = String(order.id || "").toLowerCase();
      const customerName = String(
        order.customerName || order.fullName || ""
      ).toLowerCase();
      const email = String(order.email || "").toLowerCase();
      const productName = String(
        order.productName || ""
      ).toLowerCase();

      const matchesSearch =
        orderId.includes(normalizedSearch) ||
        customerName.includes(normalizedSearch) ||
        email.includes(normalizedSearch) ||
        productName.includes(normalizedSearch) ||
        String(order.orderNumber || "").toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "All" ||
        order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [orders, search, statusFilter]);

  const totals = useMemo(() => {
    return orders.reduce(
      (result, order) => {
        const payment = orderMetrics([order]);
        result.revenue += payment.netRevenue;
        result.grossCollected += payment.grossCollected;
        result.refunds += payment.refunds;

        if (order.status === "New") {
          result.newOrders += 1;
        }

        if (order.status === "Processing") {
          result.processing += 1;
        }

        if (order.status === "Delivered") {
          result.delivered += 1;
        }

        return result;
      },
      {
        revenue: 0,
        grossCollected: 0,
        refunds: 0,
        newOrders: 0,
        processing: 0,
        delivered: 0,
      }
    );
  }, [orders]);

    async function updateStatus(orderId, newStatus) {
  try {
    await saveOrderStatus(orderId, newStatus);

    setOrders((currentOrders) =>
      currentOrders.map((item) =>
        item.id === orderId
          ? {
              ...item,
              status: newStatus,
            }
          : item
      )
    );

  } catch (error) {
    console.error(
      "Could not update order status:",
      error
    );
  }
}

  async function updatePaymentStatus(orderId, status) {
    if (paymentUpdates[orderId]) return;
    setPaymentUpdates(current => ({ ...current, [orderId]: true }));
    setActionError("");
    try {
      const savedOrder = await savePaymentStatus(orderId, status);
      setOrders(current => current.map(item => item.id === orderId ? { ...item, ...savedOrder } : item));
    } catch (error) {
      setActionError(error.message || "Could not update order payment status. Please retry.");
    } finally {
      setPaymentUpdates(current => ({ ...current, [orderId]: false }));
    }
  }
  async function deleteOrder(orderId) {
  const confirmed = window.confirm(
    "Are you sure you want to delete this order?"
  );

  if (!confirmed) {
    return;
  }

  try {
    await removeOrder(orderId);

    setOrders((currentOrders) =>
      currentOrders.filter(
        (item) => item.id !== orderId
      )
    );

  } catch (error) {
    console.error(
      "Could not delete order:",
      error
    );
  }
}
  function getCustomerName(order) {
    return order.customerName || order.fullName || "Customer";
  }

  function getOrderDate(order) {
    const rawDate = order.date || order.createdAt;

    if (!rawDate) {
      return "Not available";
    }

    const parsedDate = new Date(rawDate);

    if (Number.isNaN(parsedDate.getTime())) {
      return String(rawDate);
    }

    return parsedDate.toLocaleDateString("en-US");
  }

  function getStatusClass(status) {
    return `status-${String(status || "new")
      .toLowerCase()
      .replace(/\s+/g, "-")}`;
  }

  return (
    <DashboardLayout>
    <div className="orders-page">
      {actionError && <p role="alert" className="orders-action-error">{actionError}</p>}
      <header className="orders-header">
        <div>
          <span>Order management</span>
          <h1>Orders</h1>

          <p>
            View customer orders, update their status,
            and track your sales.
          </p>
        </div>
      </header>

      <section className="orders-summary-grid">
        <article>
          <span>Net revenue</span>
          <strong>{formatCurrency(totals.revenue)}</strong>
          <p>Gross collected {formatCurrency(totals.grossCollected)} · refunds {formatCurrency(totals.refunds)}</p>
        </article>

        <article>
          <span>New orders</span>
          <strong>{totals.newOrders}</strong>
          <p>Orders waiting for review</p>
        </article>

        <article>
          <span>Processing</span>
          <strong>{totals.processing}</strong>
          <p>Orders currently being prepared</p>
        </article>

        <article>
          <span>Delivered</span>
          <strong>{totals.delivered}</strong>
          <p>Successfully completed orders</p>
        </article>
      </section>

      <section className="orders-card">
        <div className="orders-card-heading">
          <div>
            <span>All orders</span>
            <h2>Customer orders</h2>
          </div>

          <strong>{filteredOrders.length} shown</strong>
        </div>

        <div className="orders-tools">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search by order, customer, email, or product..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="All">All statuses</option>

            {statuses.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        {listState === "loading" ? (
          <InlineState kind="loading" title="Loading orders" description="Your latest order list is being prepared." />
        ) : listState === "error" ? (
          <InlineState kind="error" title="Orders could not load" description="Check your connection and try again. No order changes were made." onRetry={() => setLoadVersion(version => version + 1)} />
        ) : filteredOrders.length === 0 ? (
          <div className="orders-empty-state">
            <h3>No orders yet</h3>

            <p>
              Customer orders will appear here after
              checkout.
            </p>
          </div>
        ) : (
          <div className="orders-table-wrapper">
            <div className="orders-table">
              <div className="orders-row orders-row-header">
                <span>Order</span>
                <span>Customer</span>
                <span>Product</span>
                <span>Quantity</span>
                <span>Total</span>
                <span>Date</span>
                <span>Status</span>
                <span>Actions</span>
              </div>

              {filteredOrders.map((order) => (
                <div className="orders-row" key={order.id}>
                  <strong>#{order.orderNumber || order.id}</strong>

                  <div className="orders-customer">
                    <strong>{getCustomerName(order)}</strong>
                    <span>{order.email || "No email"}</span>
                    <span>{order.phone || "No phone"}</span>
                  </div>

                  <span>{order.productName || "Product"}</span>
                  <span>{Number(order.quantity) || 1}</span>
                  <strong>{formatCurrency(order.total)}</strong>
                  <span>{getOrderDate(order)}</span>

                  <div className="order-fulfillment-and-payment">
                    <select className={`order-status-select ${getStatusClass(order.fulfillmentStatus || order.status)}`} value={String(order.fulfillmentStatus || order.status || "New").replace(/^./, letter => letter.toUpperCase())} onChange={event => updateStatus(order.id, event.target.value)}>
                      {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                    <small>Payment: {order.paymentStatus || "Pending"}</small>
                    {String(order.paymentStatus || "").toLowerCase() !== "paid" && String(order.paymentStatus || "").toLowerCase() !== "refunded" && <button type="button" disabled={!!paymentUpdates[order.id]} onClick={() => updatePaymentStatus(order.id, "paid")}>{paymentUpdates[order.id] ? "Saving…" : "Mark collected"}</button>}
                    {String(order.paymentStatus || "").toLowerCase() === "paid" && <button type="button" disabled={!!paymentUpdates[order.id]} onClick={() => updatePaymentStatus(order.id, "refunded")}>{paymentUpdates[order.id] ? "Saving…" : "Record refund"}</button>}
                  </div>

                  <button
                    type="button"
                    className="order-delete-button"
                    onClick={() => deleteOrder(order.id)}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
    </DashboardLayout>
  );
}

export default Orders;

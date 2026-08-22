import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";

import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../firebase";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function readLocalStorageArray(key) {
  try {
    const saved = localStorage.getItem(key);
    const parsed = saved ? JSON.parse(saved) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error(`Could not load ${key}:`, error);
    return [];
  }
}

function Dashboard() {
  const navigate = useNavigate();
 const [orders, setOrders] = useState([]);
const [customers, setCustomers] = useState([]);
const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadDashboardData() {
      try {
        const user = auth.currentUser;

        if (!user) {
          setOrders([]);
          setCustomers([]);
          return;
        }

        const storeUrl =
          localStorage.getItem("storeUrl") ||
          JSON.parse(
            localStorage.getItem("websiteSetup")
          )?.storeUrl ||
          "";

        if (!storeUrl) {
          return;
        }

        const ordersQuery = query(
          collection(db, "orders"),
          where("storeUrl", "==", storeUrl)
        );

        const customersQuery = query(
          collection(db, "customers"),
          where("storeUrl", "==", storeUrl)
        );

        const ordersSnapshot = await getDocs(
          ordersQuery
        );

        const customersSnapshot = await getDocs(
          customersQuery
        );

        setOrders(
          ordersSnapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

        setCustomers(
          customersSnapshot.docs.map((item) => ({
            id: item.id,
            ...item.data(),
          }))
        );

      } catch (error) {
        console.error(
          "Could not load dashboard data:",
          error
        );
      }
    }

    loadDashboardData();
  }, []);
  // Load baseline configurations
  const websiteSetup = useMemo(() => {
    try {
      const saved = localStorage.getItem("websiteSetup");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Could not load website setup:", error);
      return null;
    }
  }, []);

  const editorData = useMemo(() => {
    try {
      const saved = localStorage.getItem("websiteEditorData");
      return saved ? JSON.parse(saved) : null;
    } catch (error) {
      console.error("Could not load editor data:", error);
      return null;
    }
  }, []);


  const businessName =
    editorData?.brandName ||
    websiteSetup?.businessName ||
    "Your Business";

  const selectedTemplate =
    editorData?.template ||
    websiteSetup?.template ||
    localStorage.getItem("selectedTemplate") ||
    "minimal";

  // Dynamic calculations based on storage values
  const totalRevenue = useMemo(() => {
    return orders.reduce(
      (total, order) => total + (Number(order.total) || 0),
      0
    );
  }, [orders]);

  const averageOrder = useMemo(() => {
    if (orders.length === 0) {
      return 0;
    }
    return totalRevenue / orders.length;
  }, [orders, totalRevenue]);

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      const stock = Number(product.stock) || 0;
      return stock > 0 && stock <= 5;
    }).length;
  }, [products]);

  const recentOrders = useMemo(() => {
    return [...orders]
      .sort((a, b) => {
        const firstDate = new Date(a.createdAt || a.date || 0);
        const secondDate = new Date(b.createdAt || b.date || 0);
        return secondDate - firstDate;
      })
      .slice(0, 3);
  }, [orders]);

  function getOrderId(order) {
    return String(order.id || "Order");
  }

  function getCustomerName(order) {
    return order.customerName || order.fullName || "Customer";
  }

  function getOrderStatus(order) {
    return order.status || "New";
  }

  function getStatusClass(status) {
    return String(status || "new")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  function getTemplateName(templateId) {
    const templateNames = {
      minimal: "Ivory",
      luxury: "Champagne",
      bold: "Midnight",
    };
    return templateNames[templateId] || templateId || "Not selected";
  }

  return (
    <div className="dashboard-page">
      <aside className="dashboard-sidebar">
        <button
          type="button"
          className="dashboard-logo"
          onClick={() => navigate("/")}
        >
          Your Business
        </button>

        <nav className="dashboard-navigation">
          <button type="button" className="active">
            Overview
          </button>

          <button
            type="button"
            onClick={() => navigate("/editor")}
          >
            Website Editor
          </button>

          

          <button
            type="button"
            onClick={() => navigate("/products")}
          >
            Products
          </button>

          <button
            type="button"
            onClick={() => navigate("/orders")}
          >
            Orders
          </button>

          <button
            type="button"
            onClick={() => navigate("/customers")}
          >
            Customers
          </button>
        </nav>

        <div className="dashboard-sidebar-bottom">
          <button
            type="button"
            onClick={() => navigate("/settings")}
          >
            Settings
          </button>

          <button
            type="button"
            onClick={() => navigate("/")}
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-header">
          <div>
            <span>Business dashboard</span>
            <h1>Welcome back, {businessName}</h1>
            <p>
              Manage your website, products, orders, and
              customers from one place.
            </p>
          </div>

          <div className="dashboard-header-actions">
            <button
              type="button"
              className="dashboard-secondary-button"
              onClick={() => navigate("/editor")}
            >
              Edit website
            </button>

            <button
              type="button"
              className="dashboard-primary-button"
              onClick={() =>
                navigate(
                  websiteSetup?.storeUrl
  ? `/store/${websiteSetup.storeUrl}`
  : "/editor"
  
                )
              }
            >
              View website
            </button>
          </div>
        </header>

        {/* Top Stat Summary Grid */}
        <section className="dashboard-stats-grid">
          <article className="dashboard-stat-card">
            <div>
              <span>Total revenue</span>
              <strong>{formatCurrency(totalRevenue)}</strong>
            </div>
            <p>Revenue from all orders</p>
          </article>

          <article className="dashboard-stat-card">
            <div>
              <span>Orders</span>
              <strong>{orders.length}</strong>
            </div>
            <p>Total customer orders</p>
          </article>

          <article className="dashboard-stat-card">
            <div>
              <span>Customers</span>
              <strong>{customers.length}</strong>
            </div>
            <p>Customers saved in your store</p>
          </article>

          <article className="dashboard-stat-card">
            <div>
              <span>Products</span>
              <strong>{products.length}</strong>
            </div>
            <p>
              {lowStockProducts > 0
                ? `${lowStockProducts} low in stock`
                : "No low-stock products"}
            </p>
          </article>
        </section>

        {/* Main Section Columns */}
        <section className="dashboard-main-grid">
          <article className="dashboard-card dashboard-sales-card">
            <div className="dashboard-card-heading">
              <div>
                <span>Sales overview</span>
                <h2>Revenue performance</h2>
              </div>
            </div>

            <div className="dashboard-sales-summary">
              <div>
                <span>Total sales</span>
                <strong>{formatCurrency(totalRevenue)}</strong>
              </div>

              <div>
                <span>Average order</span>
                <strong>{formatCurrency(averageOrder)}</strong>
              </div>

              <div>
                <span>Total orders</span>
                <strong>{orders.length}</strong>
              </div>
            </div>

            {orders.length === 0 ? (
              <div className="dashboard-empty-state">
                <h3>No sales data yet</h3>
                <p>
                  Sales information will appear after
                  customers place orders.
                </p>
              </div>
            ) : (
              <div className="dashboard-chart">
                {orders.slice(0, 12).map((order, index) => {
                  const total = Number(order.total) || 0;
                  const height = Math.max(
                    24,
                    Math.min(118, total / 4)
                  );

                  return (
                    <div key={order.id || index}>
                      <span
                        style={{
                          height: `${height}px`,
                        }}
                      ></span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className="dashboard-card dashboard-website-card">
            <div className="dashboard-card-heading">
              <div>
                <span>Your website</span>
                <h2>Website status</h2>
              </div>
            </div>

            <div className="dashboard-website-preview">
              <div
                className={`dashboard-mini-site ${selectedTemplate}`}
              >
                <div className="dashboard-mini-navbar">
                  <strong>{businessName}</strong>
                  <span>Menu</span>
                </div>

                <div className="dashboard-mini-hero">
                  <span>
                    {editorData?.eyebrow || "Your collection"}
                  </span>

                  <h3>
                    {editorData?.headline ||
                      "Build a brand people remember."}
                  </h3>

                  <button type="button">
                    {editorData?.buttonText || "Shop now"}
                  </button>
                </div>
              </div>
            </div>

            <div className="dashboard-website-details">
              <div>
                <span>Status</span>
                <strong>
                  {localStorage.getItem("websitePublished") ===
                  "true"
                    ? "Published"
                    : "Draft"}
                </strong>
              </div>

              <div>
                <span>Template</span>
                <strong>
                  {getTemplateName(selectedTemplate)}
                </strong>
              </div>

              <div>
                <span>Website address</span>
                <strong>
                  {websiteSetup?.storeUrl || "Not selected"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="dashboard-full-button"
              onClick={() => navigate("/editor")}
            >
              Open website editor
            </button>
          </article>
        </section>

        {/* Bottom Activity Section */}
        <section className="dashboard-bottom-grid">
          <article className="dashboard-card">
            <div className="dashboard-card-heading">
              <div>
                <span>Latest activity</span>
                <h2>Recent orders</h2>
              </div>

              <button
                type="button"
                onClick={() => navigate("/orders")}
              >
                View all
              </button>
            </div>

            {recentOrders.length === 0 ? (
              <div className="dashboard-empty-state">
                <h3>No orders yet</h3>
                <p>
                  Recent customer orders will appear here.
                </p>
              </div>
            ) : (
              <div className="dashboard-orders-table">
                <div className="dashboard-order-row header">
                  <span>Order</span>
                  <span>Customer</span>
                  <span>Product</span>
                  <span>Total</span>
                  <span>Status</span>
                </div>

                {recentOrders.map((order) => {
                  const status = getOrderStatus(order);

                  return (
                    <div
                      className="dashboard-order-row"
                      key={order.id}
                    >
                      <strong>
                        #{getOrderId(order)}
                      </strong>

                      <span>
                        {getCustomerName(order)}
                      </span>

                      <span>
                        {order.productName || "Product"}
                      </span>

                      <span>
                        {formatCurrency(order.total)}
                      </span>

                      <span
                        className={`dashboard-status ${getStatusClass(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </article>

          <article className="dashboard-card dashboard-quick-card">
            <div className="dashboard-card-heading">
              <div>
                <span>Quick actions</span>
                <h2>Keep building</h2>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate("/products")}
            >
              Add a new product
            </button>

            <button
              type="button"
              onClick={() => navigate("/editor")}
            >
              Customize website
            </button>

            <button
              type="button"
              onClick={() => navigate("/orders")}
            >
              Manage orders
            </button>

            <button
              type="button"
              onClick={() => navigate("/customers")}
            >
              View customers
            </button>
          </article>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
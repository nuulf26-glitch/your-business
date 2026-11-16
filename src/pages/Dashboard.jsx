import { getStore } from "../services/storeService";
import { getProducts } from "../services/productService";
import { orderMetrics } from "../business/metrics";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/dashboard.css";
import DashboardLayout from "../layouts/DashboardLayout";
import { getOrders } from "../services/orderService";
import { getCustomers } from "../services/customerService";
import { customBackendRequest, getAppUser } from "../services/customBackendSession";
import { loadWebsiteRecord } from "../editor/versionService";
import { websitePublicationStatus } from "../editor/websiteStatus";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function Dashboard() {
  const navigate = useNavigate();
  const [store, setStore] = useState(null);
 const [orders, setOrders] = useState([]);
const [customers, setCustomers] = useState([]);
const [products, setProducts] = useState([]);
const [userProfile, setUserProfile] = useState(null);
  const [refundLoading, setRefundLoading] = useState(false);
  const [refundMessage, setRefundMessage] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [websiteRecord, setWebsiteRecord] = useState(null);
  const [websiteStatus, setWebsiteStatus] = useState("Checking…");
  const [stripeStatus, setStripeStatus] = useState(null);
  const [stripeStatusError, setStripeStatusError] = useState("");
  const [stripeStatusLoading, setStripeStatusLoading] = useState(false);
  const [dashboardLoadState, setDashboardLoadState] = useState("loading");
  const [dashboardRetryCount, setDashboardRetryCount] = useState(0);
  useEffect(() => {
    let active = true;

    async function loadDashboardData() {
      setDashboardLoadState("loading");
      try {
        const user = await getAppUser();
        if (!active) return;
        setUserProfile(user || null);
        if (!user) {
          navigate("/login", { replace: true });
          return;
        }

        const [storeResult, websiteResult, productResult, ordersResult, customersResult, commerceResult] = await Promise.allSettled([getStore(), loadWebsiteRecord(), getProducts(), getOrders(), getCustomers(), customBackendRequest("/business/mine/commerce-analytics")]);
        if (!active) return;
        const failedResult = [storeResult, websiteResult, productResult, ordersResult, customersResult, commerceResult].find((result) => result.status === "rejected");
        if (failedResult) throw failedResult.reason;

        if (storeResult.status === 'fulfilled') setStore(storeResult.value);
        if (websiteResult.status === 'fulfilled') {
          setWebsiteRecord(websiteResult.value);
          setWebsiteStatus(websitePublicationStatus(websiteResult.value));
        } else setWebsiteStatus('Unavailable');
        if (productResult.status === 'fulfilled') setProducts(productResult.value);
        const ordersData = ordersResult.status === 'fulfilled' ? ordersResult.value : [];
        const customersData = customersResult.status === 'fulfilled' ? customersResult.value : [];
        setOrders(ordersData);
        setCustomers(customersData);
        if (commerceResult.status === "fulfilled") setCommerceAnalytics(commerceResult.value);
        setDashboardLoadState("ready");

      } catch (error) {
        console.error(
          "Could not load dashboard data:",
          error
        );
        if (active) setDashboardLoadState("error");
      }
    }

    loadDashboardData();
    return () => { active = false; };
  }, [dashboardRetryCount, navigate]);
  async function requestRefund() {
    if (!window.confirm("Cancel your CYB access and refund the $246 lifetime payment?")) return;
    setRefundLoading(true);
    setRefundMessage("");
    try {
      await customBackendRequest("/payments/platform-access/refund", { method: "POST" });
      setUserProfile(await getAppUser());
      setRefundMessage("Your refund has been issued. Your account is now inactive.");
    } catch (error) {
      setRefundMessage(error.message || "We could not process the refund. Please try again.");
    } finally {
      setRefundLoading(false);
    }
  }

  const websiteSetup = store;
  const isStaging = window.location.hostname === "getcyb-staging-web.onrender.com";
  const editorData = websiteRecord?.draft || store?.draftEditorData || store?.editorData;
  const businessName = editorData?.brandName || store?.businessName || store?.storeName || 'Your Business';
  const selectedTemplate = editorData?.template || store?.template || 'minimal';
  const metrics = useMemo(() => orderMetrics(orders), [orders]);
  const totalRevenue = metrics.revenue;
  const averageOrder = metrics.average;

  const lowStockProducts = useMemo(() => {
    return products.filter((product) => {
      if (product.stock === undefined || product.stock === null || String(product.stock).trim() === "") return false;
      const stock = Number(product.stock);
      return Number.isFinite(stock) && stock >= 0 && stock <= 5;
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
    <DashboardLayout>
    <div className="dashboard-page">
      <main className="dashboard-main" aria-busy={dashboardLoadState === "loading"}>
        {dashboardLoadState === "loading" ? (
          <div className="dashboard-load-state" role="status" aria-live="polite">
            <span className="dashboard-loading-indicator" aria-hidden="true" />
            <p>Loading your business dashboard…</p>
          </div>
        ) : dashboardLoadState === "error" ? (
          <div className="dashboard-load-state dashboard-load-error" role="alert">
            <h1>We couldn’t load your dashboard.</h1>
            <p>Your business data is unchanged. Check your connection and try again.</p>
            <button type="button" className="dashboard-primary-button" onClick={() => setDashboardRetryCount((count) => count + 1)}>
              Try again
            </button>
          </div>
        ) : (
          <>
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
            <div className="dashboard-notification-wrap">
              <button type="button" className="dashboard-notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(open => !open)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {notificationsOpen && <div className="dashboard-notification-popover" role="status"><strong>You’re all caught up</strong><p>New account and store updates will appear here.</p></div>}
            </div>
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
<section className="dashboard-payment-card">

  {userProfile?.paid ? (
    <>
      <span>Account status</span>
      <h2>Active account ✓</h2>
      <p>
        Your Business platform is unlocked.
      </p>
      <p>You can cancel and request a full refund within 30 days of payment.</p>
      <button type="button" className="dashboard-secondary-button" onClick={requestRefund} disabled={refundLoading}>
        {refundLoading ? "Processing refund…" : "Cancel account & get refund"}
      </button>
    </>
  ) : (
    <>
      <span>Account status</span>
      <h2>Your account is ready</h2>
      <p>
        Your draft is saved. Activate CYB Lifetime Access with a one-time
        $246 payment to publish your website and unlock the full platform.
      </p>

      <button
        type="button"
        className="dashboard-primary-button"
        onClick={() => navigate("/platform-payment")}
      >
        Activate for $246 — one-time
      </button>
    </>
  )}
  {refundMessage && <p role="status">{refundMessage}</p>}

</section>
        {isStaging && (
          <section className="dashboard-payment-card" aria-labelledby="staging-stripe-title">
            <span>Staging diagnostics</span>
            <h2 id="staging-stripe-title">Verify Stripe test mode</h2>
            <p>Read-only check. No checkout or payment is created.</p>
            <button
              type="button"
              className="dashboard-secondary-button"
              disabled={stripeStatusLoading}
              onClick={async () => {
                setStripeStatusLoading(true);
                setStripeStatusError("");
                try {
                  setStripeStatus(await customBackendRequest("/payments/stripe/staging-status"));
                } catch (error) {
                  setStripeStatusError(error instanceof Error ? error.message : "Could not verify Stripe configuration.");
                } finally {
                  setStripeStatusLoading(false);
                }
              }}
            >
              {stripeStatusLoading ? "Checking…" : "Check test-mode status"}
            </button>
            {stripeStatus && (
              <p role="status" aria-live="polite">
                {stripeStatus.verified && stripeStatus.amountCents === 24600
                  ? `Verified test mode · $${(stripeStatus.amountCents / 100).toFixed(2)} ${stripeStatus.currency?.toUpperCase()}`
                  : `Test mode: ${stripeStatus.testMode ? "yes" : "no"} · Verified: ${stripeStatus.verified ? "yes" : "no"} · Amount: ${stripeStatus.amountCents == null ? "invalid" : `$${(stripeStatus.amountCents / 100).toFixed(2)}`} ${stripeStatus.currency?.toUpperCase() || ""}`}
              </p>
            )}
            {stripeStatusError && <p role="alert">{stripeStatusError}</p>}
          </section>
        )}
        <button type="button" className="dashboard-secondary-button" onClick={() => navigate('/business')}>Business workspace ↗</button>
        <section className="dashboard-stats-grid"><article className="dashboard-stat-card"><span>Net profit</span><strong>{metrics.profit == null ? 'Not available' : formatCurrency(metrics.profit)}</strong><p>{metrics.profit == null ? 'Add order cost of goods and expenses to calculate profit.' : 'Based on recorded order costs and expenses.'}</p></article><article className="dashboard-stat-card"><span>Profit margin</span><strong>{metrics.margin == null ? '—' : `${metrics.margin.toFixed(1)}%`}</strong></article></section>
        {/* Top Stat Summary Grid */}
        <section className="dashboard-stats-grid">
          <article className="dashboard-stat-card">
            <div>
              <span>Total revenue</span>
              <strong>{formatCurrency(totalRevenue)}</strong>
            </div>
            <p>Paid, completed or delivered orders</p>
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

        {commerceAnalytics && <section className="dashboard-stats-grid" aria-label="Store analytics">
          <article className="dashboard-stat-card"><span>Collected revenue</span><strong>{formatCurrency(commerceAnalytics.revenue)}</strong><p>{commerceAnalytics.paidOrders || 0} collected orders · {commerceAnalytics.orders || 0} total orders</p></article>
          <article className="dashboard-stat-card"><span>Average paid order</span><strong>{formatCurrency(commerceAnalytics.averageOrderValue)}</strong><p>Unpaid COD is excluded</p></article>
          <article className="dashboard-stat-card"><span>Unpaid COD</span><strong>{commerceAnalytics.unpaidCodOrders || 0}</strong><p>Orders awaiting collection</p></article>
          <article className="dashboard-stat-card"><span>Refunds</span><strong>{formatCurrency(commerceAnalytics.refunds)}</strong><p>Recorded refunded amount</p></article>
          <article className="dashboard-stat-card"><span>Store conversion</span><strong>{commerceAnalytics.conversionRate == null ? "Not measurable" : `${(commerceAnalytics.conversionRate * 100).toFixed(1)}%`}</strong><p>{commerceAnalytics.uniqueVisits || 0} unique visits counted</p></article>
          <article className="dashboard-stat-card"><span>Best sellers</span><strong>{commerceAnalytics.bestSellers?.[0]?.name || "No paid sales yet"}</strong><p>{commerceAnalytics.bestSellers?.[0]?.quantity || 0} units sold</p></article>
          <article className="dashboard-stat-card"><span>Inventory alerts</span><strong>{commerceAnalytics.inventoryAlerts?.length || 0}</strong><p>{commerceAnalytics.inventoryAlerts?.slice(0, 3).map(item => `${item.name}: ${item.stock}`).join(" · ") || "All tracked stock is above threshold"}</p></article>
        </section>}
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
                  {websiteStatus}
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
          </>
        )}
      </main>
    </div>
    </DashboardLayout>
  );
}

export default Dashboard;

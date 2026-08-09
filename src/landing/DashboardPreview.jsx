import "./landing.css";

function DashboardPreview() {
  const recentOrders = [
    {
      customer: "Olivia Carter",
      product: "Classic Leather Bag",
      total: "$420.00",
      status: "Completed",
    },
    {
      customer: "Emma Wilson",
      product: "Silk Evening Dress",
      total: "$680.00",
      status: "Processing",
    },
    {
      customer: "Sophia Bennett",
      product: "Luxury Skincare Set",
      total: "$245.00",
      status: "Completed",
    },
  ];

  const topProducts = [
    {
      name: "Classic Leather Bag",
      sales: "1,284 sales",
      revenue: "$84,720",
    },
    {
      name: "Silk Evening Dress",
      sales: "936 sales",
      revenue: "$71,480",
    },
    {
      name: "Luxury Skincare Set",
      sales: "842 sales",
      revenue: "$46,310",
    },
  ];

  return (
    <section
      id="platform-preview"
      className="dashboard-preview-section"
    >
      <div className="dashboard-preview-container">
        <div className="dashboard-preview-heading">
          <div className="dashboard-preview-copy">
            <p className="section-eyebrow">
              BUSINESS DASHBOARD
            </p>

            <h2>
              Manage your entire business
              <span> from one beautiful dashboard.</span>
            </h2>

            <p>
              Track revenue, profit, customers, products, and orders
              in real time. Everything stays organized, clear, and
              easy to understand.
            </p>

            <button
              type="button"
              className="dashboard-preview-button"
            >
              Explore Dashboard
              <span>→</span>
            </button>
          </div>

          <div className="dashboard-preview-note">
            <span>Live business overview</span>
            <strong>Maison Belle</strong>
          </div>
        </div>

        <div className="dashboard-window">
          <aside className="dashboard-window-sidebar">
            <div className="dashboard-logo">
              <span>M</span>
            </div>

            <nav>
              <button className="dashboard-nav-active">
                Overview
              </button>
              <button>Orders</button>
              <button>Products</button>
              <button>Customers</button>
              <button>Analytics</button>
              <button>Settings</button>
            </nav>

            <div className="dashboard-sidebar-profile">
              <div className="dashboard-avatar">OC</div>

              <div>
                <strong>Olivia Carter</strong>
                <span>Administrator</span>
              </div>
            </div>
          </aside>

          <main className="dashboard-window-main">
            <div className="dashboard-main-header">
              <div>
                <p>Monday, July 20</p>
                <h3>Good morning, Olivia.</h3>
              </div>

              <button type="button">Open Store ↗</button>
            </div>

            <div className="dashboard-stat-grid">
              <article>
                <span>Revenue</span>
                <strong>$284,920</strong>
                <small>+24.8% this month</small>
              </article>

              <article>
                <span>Profit</span>
                <strong>$173,680</strong>
                <small>+18.2% this month</small>
              </article>

              <article>
                <span>Orders</span>
                <strong>5,214</strong>
                <small>184 new orders</small>
              </article>

              <article>
                <span>Customers</span>
                <strong>3,486</strong>
                <small>+312 this month</small>
              </article>

              <article>
                <span>Products</span>
                <strong>892</strong>
                <small>47 low in stock</small>
              </article>
            </div>

            <div className="dashboard-content-grid">
              <section className="dashboard-sales-card">
                <div className="dashboard-card-heading">
                  <div>
                    <span>Sales performance</span>
                    <strong>$284,920</strong>
                  </div>

                  <select defaultValue="12-months">
                    <option value="12-months">
                      Last 12 months
                    </option>
                    <option value="6-months">
                      Last 6 months
                    </option>
                  </select>
                </div>

                <div className="dashboard-chart">
                  <div className="dashboard-chart-lines">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>

                  <svg
                    viewBox="0 0 700 250"
                    preserveAspectRatio="none"
                    aria-label="Sales growth chart"
                  >
                    <defs>
                      <linearGradient
                        id="dashboardArea"
                        x1="0"
                        x2="0"
                        y1="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#8a6b55"
                          stopOpacity="0.28"
                        />

                        <stop
                          offset="100%"
                          stopColor="#8a6b55"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>

                    <path
                      className="dashboard-chart-area"
                      d="M0,210 C70,185 105,190 150,158 C205,120 245,148 300,110 C350,75 400,110 455,65 C515,18 560,70 610,42 C650,24 680,20 700,12 L700,250 L0,250 Z"
                    />

                    <path
                      className="dashboard-chart-line"
                      d="M0,210 C70,185 105,190 150,158 C205,120 245,148 300,110 C350,75 400,110 455,65 C515,18 560,70 610,42 C650,24 680,20 700,12"
                    />
                  </svg>

                  <div className="dashboard-chart-months">
                    <span>Aug</span>
                    <span>Oct</span>
                    <span>Dec</span>
                    <span>Feb</span>
                    <span>Apr</span>
                    <span>Jun</span>
                    <span>Jul</span>
                  </div>
                </div>
              </section>

              <section className="dashboard-summary-card">
                <div className="dashboard-card-heading">
                  <div>
                    <span>Store performance</span>
                    <strong>Excellent</strong>
                  </div>
                </div>

                <div className="dashboard-performance-ring">
                  <div>
                    <strong>92</strong>
                    <span>Score</span>
                  </div>
                </div>

                <div className="dashboard-performance-list">
                  <div>
                    <span>Conversion rate</span>
                    <strong>8.7%</strong>
                  </div>

                  <div>
                    <span>Average order</span>
                    <strong>$152.40</strong>
                  </div>

                  <div>
                    <span>Returning customers</span>
                    <strong>42%</strong>
                  </div>
                </div>
              </section>
            </div>

            <div className="dashboard-bottom-grid">
              <section className="dashboard-table-card">
                <div className="dashboard-card-heading">
                  <div>
                    <span>Recent orders</span>
                    <strong>Latest activity</strong>
                  </div>

                  <button type="button">View all</button>
                </div>

                <div className="dashboard-order-table">
                  {recentOrders.map((order) => (
                    <div
                      className="dashboard-order-row"
                      key={`${order.customer}-${order.product}`}
                    >
                      <div>
                        <strong>{order.customer}</strong>
                        <span>{order.product}</span>
                      </div>

                      <strong>{order.total}</strong>

                      <span
                        className={
                          order.status === "Completed"
                            ? "dashboard-status completed"
                            : "dashboard-status processing"
                        }
                      >
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="dashboard-products-card">
                <div className="dashboard-card-heading">
                  <div>
                    <span>Best selling products</span>
                    <strong>Top performers</strong>
                  </div>
                </div>

                <div className="dashboard-top-products">
                  {topProducts.map((product, index) => (
                    <div key={product.name}>
                      <span className="dashboard-product-rank">
                        0{index + 1}
                      </span>

                      <div>
                        <strong>{product.name}</strong>
                        <span>{product.sales}</span>
                      </div>

                      <strong>{product.revenue}</strong>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </main>
        </div>

        <div className="dashboard-benefit-grid">
          <article>
            <span>01</span>
            <div>
              <h3>Real-time Revenue</h3>
              <p>
                See exactly how much your store is earning as
                new orders arrive.
              </p>
            </div>
          </article>

          <article>
            <span>02</span>
            <div>
              <h3>Organized Orders</h3>
              <p>
                Manage every order, customer, and delivery update
                from one place.
              </p>
            </div>
          </article>

          <article>
            <span>03</span>
            <div>
              <h3>Clear Analytics</h3>
              <p>
                Understand what is selling and where your business
                is growing.
              </p>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

export default DashboardPreview;
import { useNavigate } from "react-router-dom";
import "./landing.css";

const analyticsCards = [
  {
    title: "Total revenue",
    value: "usd 48,620",
    change: "+18.4%",
    text: "Compared with last month",
  },
  {
    title: "Orders",
    value: "326",
    change: "+12.7%",
    text: "New and completed orders",
  },
  {
    title: "Customers",
    value: "1,284",
    change: "+21.3%",
    text: "Returning and new customers",
  },
];

const chartBars = [42, 58, 48, 74, 66, 88, 78, 95, 84, 100, 92, 112];

function Analytics() {
  const navigate = useNavigate();

  return (
    <section className="analytics-section" id="analytics">
      <div className="landing-container">
        <div className="analytics-layout">
          <div className="analytics-preview">
            <div className="analytics-window">
              <div className="analytics-window-header">
                <div>
                  <span className="analytics-small-label">
                    Business analytics
                  </span>
                  <h3>Performance overview</h3>
                </div>

                <div className="analytics-date-filter">
                  Last 30 days
                </div>
              </div>

              <div className="analytics-cards-grid">
                {analyticsCards.map((card) => (
                  <article
                    className="analytics-stat-card"
                    key={card.title}
                  >
                    <p>{card.title}</p>
                    <h4>{card.value}</h4>

                    <div className="analytics-card-footer">
                      <span>{card.change}</span>
                      <small>{card.text}</small>
                    </div>
                  </article>
                ))}
              </div>

              <div className="analytics-chart-card">
                <div className="analytics-chart-heading">
                  <div>
                    <p>Revenue</p>
                    <h4>usd 48,620</h4>
                  </div>

                  <span>Monthly growth</span>
                </div>

                <div className="analytics-chart">
                  <div className="analytics-chart-lines">
                    <span></span>
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>

                  <div className="analytics-bars">
                    {chartBars.map((height, index) => (
                      <div
                        className="analytics-bar"
                        key={`${height}-${index}`}
                      >
                        <span style={{ height: `${height}px` }}></span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="analytics-months">
                  <span>Jan</span>
                  <span>Feb</span>
                  <span>Mar</span>
                  <span>Apr</span>
                  <span>May</span>
                  <span>Jun</span>
                  <span>Jul</span>
                  <span>Aug</span>
                  <span>Sep</span>
                  <span>Oct</span>
                  <span>Nov</span>
                  <span>Dec</span>
                </div>
              </div>

              <div className="analytics-bottom-grid">
                <div className="analytics-list-card">
                  <div className="analytics-list-heading">
                    <h4>Top products</h4>
                    <span>View all</span>
                  </div>

                  <div className="analytics-product-row">
                    <div className="analytics-product-image"></div>
                    <div>
                      <strong>Essential collection</strong>
                      <p>86 orders</p>
                    </div>
                    <span> usd 12,900</span>
                  </div>

                  <div className="analytics-product-row">
                    <div className="analytics-product-image second"></div>
                    <div>
                      <strong>Signature product</strong>
                      <p>64 orders</p>
                    </div>
                    <span>usd 9,480</span>
                  </div>

                  <div className="analytics-product-row">
                    <div className="analytics-product-image third"></div>
                    <div>
                      <strong>New arrival</strong>
                      <p>51 orders</p>
                    </div>
                    <span>usd 7,650</span>
                  </div>
                </div>

                <div className="analytics-progress-card">
                  <div className="analytics-list-heading">
                    <h4>Sales channels</h4>
                    <span>This month</span>
                  </div>

                  <div className="analytics-progress-item">
                    <div>
                      <span>Online store</span>
                      <strong>72%</strong>
                    </div>
                    <div className="analytics-progress-track">
                      <span style={{ width: "72%" }}></span>
                    </div>
                  </div>

                  <div className="analytics-progress-item">
                    <div>
                      <span>Social media</span>
                      <strong>18%</strong>
                    </div>
                    <div className="analytics-progress-track">
                      <span style={{ width: "18%" }}></span>
                    </div>
                  </div>

                  <div className="analytics-progress-item">
                    <div>
                      <span>Direct orders</span>
                      <strong>10%</strong>
                    </div>
                    <div className="analytics-progress-track">
                      <span style={{ width: "10%" }}></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="analytics-content">
            <span className="section-label">Analytics</span>

            <h2>
              Understand your business
              <br />
              with clear insights
            </h2>

            <p>
              Track sales, orders, customers, products, and growth from one
              simple dashboard. See what is working and make better business
              decisions.
            </p>

            <div className="analytics-feature-list">
              <div>
                <span>01</span>
                <div>
                  <h3>Track your sales</h3>
                  <p>
                    Monitor revenue, order value, and business performance
                    over time.
                  </p>
                </div>
              </div>

              <div>
                <span>02</span>
                <div>
                  <h3>Know your customers</h3>
                  <p>
                    Understand customer activity, returning buyers, and
                    purchasing behavior.
                  </p>
                </div>
              </div>

              <div>
                <span>03</span>
                <div>
                  <h3>Find your best products</h3>
                  <p>
                    Discover which products generate the most sales and
                    attention.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="primary-landing-button"
              onClick={() => navigate("/signup")}
            >
              Start your business
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Analytics;
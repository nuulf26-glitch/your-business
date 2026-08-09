import "./landing.css";

const features = [
  {
    number: "01",
    title: "Build Without Coding",
    text: "Create a polished business website using simple controls, ready-made sections, and professional layouts.",
  },
  {
    number: "02",
    title: "Choose Beautiful Templates",
    text: "Start with a professionally designed template for fashion, beauty, food, retail, lifestyle, and more.",
  },
  {
    number: "03",
    title: "Sell Your Products",
    text: "Upload product images, organize categories, set prices, and let customers shop from your website.",
  },
  {
    number: "04",
    title: "Manage Every Order",
    text: "View customer details, order totals, delivery information, and order status from one organized place.",
  },
  {
    number: "05",
    title: "Understand Your Business",
    text: "Track revenue, profit, loss, orders, customers, and product performance through a clear dashboard.",
  },
  {
    number: "06",
    title: "Design It Your Way",
    text: "Upload your own logo and images, choose your colors, and customize the website to match your brand.",
  },
];

function Features() {
  return (
    <section className="features-section">
      <div className="features-container">
        <div className="features-heading">
          <p className="section-eyebrow">EVERYTHING IN ONE PLACE</p>

          <h2>
            Everything your business needs
            <span> to look professional and grow.</span>
          </h2>

          <p>
            From your first website to your first order, the platform gives you
            the tools to build, manage, and understand your online business
            without needing technical experience.
          </p>
        </div>

        <div className="features-grid">
          {features.map((feature) => (
            <article className="feature-card" key={feature.number}>
              <div className="feature-number">{feature.number}</div>

              <div>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
              </div>

              <div className="feature-arrow">↗</div>
            </article>
          ))}
        </div>

        <div className="features-highlight">
          <div className="features-highlight-copy">
            <p className="section-eyebrow">BUILT FOR REAL BUSINESSES</p>

            <h3>
              Start simple.
              <br />
              Grow without rebuilding everything.
            </h3>

            <p>
              Begin with the tools you need today, then expand your products,
              website, team, and operations as your business grows.
            </p>
          </div>

          <div className="features-highlight-stats">
            <div>
              <span>One platform</span>
              <strong>Website + Store</strong>
            </div>

            <div>
              <span>Simple controls</span>
              <strong>No coding</strong>
            </div>

            <div>
              <span>Clear insights</span>
              <strong>Profit + Orders</strong>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Features;
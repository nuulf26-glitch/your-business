import { useNavigate } from "react-router-dom";
import "./landing.css";

const includedFeatures = [
  "Create and customize your business website",
  "Professional website templates",
  "Mobile-friendly online store",
  "Add and manage unlimited products",
  "Orders and customers dashboard",
  "Business analytics and sales reports",
  "Product pages, cart, and checkout",
  "Custom business website link",
  "Website editor with live preview",
  "Future platform updates included",
];

function Pricing() {
  const navigate = useNavigate();

  return (
    <section 
      id="pricing" 
      style={{ 
        backgroundColor: "#f9f8f6", 
        color: "#111", 
        padding: "100px 5%", 
        fontFamily: "'Mograp', sans-serif",
        borderBottom: "1px solid #e5e5e0"
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Top Index Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666", marginBottom: "40px" }}>
          <span>[ 05 — INVESTMENT ]</span>
          <span>SIMPLE PRICING</span>
        </div>

        {/* Pricing Heading */}
        <div style={{ maxWidth: "800px", marginBottom: "60px" }}>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", display: "block", marginBottom: "15px", fontFamily: "'Mograp', sans-serif" }}>
            Simple pricing
          </span>

          <h2 style={{ 
            fontSize: "clamp(2.2rem, 4.5vw, 3.5rem)", 
            fontWeight: "400", 
            lineHeight: "1.1", 
            letterSpacing: "-0.03em", 
            margin: "0 0 20px 0",
            textTransform: "lowercase",
            fontFamily: "'Mograp', sans-serif"
          }}>
            Everything your business needs.
            <br />
            <span style={{ color: "#666" }}>One simple price.</span>
          </h2>

          <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
            Build your website, sell your products, manage your orders, and
            grow your business without complicated plans or hidden platform
            fees.
          </p>
        </div>

        {/* Pricing Layout */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "60px", alignItems: "start", marginBottom: "60px" }}>
          
          {/* Left Information Items */}
          <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", borderTop: "1px solid #e5e5e0", paddingTop: "20px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", fontFamily: "'Mograp', sans-serif" }}>01</span>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "500", margin: "0 0 8px 0", color: "#111", fontFamily: "'Mograp', sans-serif" }}>No monthly subscription</h3>
                <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.5", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
                  Pay once and continue using your business website without a
                  recurring platform subscription.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", borderTop: "1px solid #e5e5e0", paddingTop: "20px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", fontFamily: "'Mograp', sans-serif" }}>02</span>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "500", margin: "0 0 8px 0", color: "#111", fontFamily: "'Mograp', sans-serif" }}>Everything included</h3>
                <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.5", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
                  Get access to the website builder, store management,
                  analytics, products, orders, and customers.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", borderTop: "1px solid #e5e5e0", paddingTop: "20px" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", fontFamily: "'Mograp', sans-serif" }}>03</span>
              <div>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "500", margin: "0 0 8px 0", color: "#111", fontFamily: "'Mograp', sans-serif" }}>Start before you pay</h3>
                <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.5", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
                  Create your account and explore the platform with a 14-day
                  free trial before purchasing.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", background: "#f1f0ec", padding: "25px", border: "1px solid #e5e5e0", marginTop: "10px" }}>
              <div style={{ width: "24px", height: "24px", background: "#111", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", fontSize: "0.8rem", flexShrink: 0 }}>✓</div>
              <div>
                <h3 style={{ fontSize: "1rem", fontWeight: "500", margin: "0 0 6px 0", color: "#111", fontFamily: "'Mograp', sans-serif" }}>Built for growing businesses</h3>
                <p style={{ color: "#555", fontSize: "0.9rem", lineHeight: "1.5", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
                  Start small and continue managing your website as your
                  products, customers, and orders grow.
                </p>
              </div>
            </div>
          </div>

          {/* Right Pricing Card */}
          <article style={{ background: "#fff", border: "1px solid #111", padding: "40px", borderRadius: "0px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <span style={{ fontSize: "0.75rem", textTransform: "uppercase", letterSpacing: "1.5px", color: "#888", display: "block", marginBottom: "6px", fontFamily: "'Mograp', sans-serif" }}>Complete plan</span>
                <h3 style={{ fontSize: "1.5rem", fontWeight: "400", margin: 0, fontFamily: "'Mograp', sans-serif" }}>Your Business</h3>
              </div>

              <span style={{ background: "#111", color: "#fff", padding: "4px 10px", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1px", fontFamily: "'Mograp', sans-serif" }}>Best value</span>
            </div>

            <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.5", margin: "0 0 25px 0", fontFamily: "'Mograp', sans-serif" }}>
              Everything you need to create, publish, and manage your
              professional online business.
            </p>

            <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginBottom: "8px" }}>
              <span style={{ fontSize: "0.8rem", textTransform: "uppercase", color: "#888", fontFamily: "'Mograp', sans-serif" }}>USD</span>
              <strong style={{ fontSize: "3rem", fontWeight: "400", lineHeight: "1", letterSpacing: "-0.03em", fontFamily: "'Mograp', sans-serif" }}>246</strong>
            </div>

            <p style={{ fontSize: "0.85rem", color: "#666", margin: "0 0 30px 0", fontFamily: "'Mograp', sans-serif" }}>
              One-time payment · No monthly platform subscription
            </p>

            <button
              type="button"
              onClick={() => navigate("/signup")}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "16px",
                fontSize: "0.95rem",
                fontWeight: "500",
                letterSpacing: "0.5px",
                borderRadius: "0px",
                cursor: "pointer",
                fontFamily: "'Mograp', sans-serif",
                width: "100%",
                marginBottom: "10px"
              }}
            >
              Start your 14-day free trial
            </button>

            <p style={{ textAlign: "center", fontSize: "0.80rem", color: "#666", margin: "0 0 30px 0", fontFamily: "'Mograp', sans-serif" }}>
              No payment required to create your account
            </p>

            <div style={{ borderTop: "1px solid #e5e5e0", paddingTop: "30px" }}>
              <h4 style={{ fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "1.5px", color: "#888", margin: "0 0 20px 0", fontFamily: "'Mograp', sans-serif" }}>Everything included:</h4>

              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                {includedFeatures.map((feature) => (
                  <li key={feature} style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "0.9rem", color: "#333", fontFamily: "'Mograp', sans-serif" }}>
                    <span style={{ color: "#111", fontWeight: "bold" }}>✓</span>
                    <p style={{ margin: 0 }}>{feature}</p>
                  </li>
                ))}
              </ul>
            </div>
          </article>

        </div>

        {/* Bottom Note */}
        <div style={{ borderTop: "1px solid #e5e5e0", paddingTop: "25px", textAlign: "center" }}>
          <p style={{ color: "#666", fontSize: "0.85rem", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
            Payment processing fees, custom domains, and third-party delivery
            services may have separate charges from their providers.
          </p>
        </div>

      </div>
    </section>
  );
}

export default Pricing;
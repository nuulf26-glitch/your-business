import { useNavigate } from "react-router-dom";

function Pricing() {
  const navigate = useNavigate();

  function handleGetStarted() {
    navigate("/signup");
  }

  return (
    <section style={styles.section}>
      <div style={styles.container}>
        <p style={styles.eyebrow}>PRICING</p>

        <h2 style={styles.title}>Simple Pricing</h2>

        <p style={styles.subtitle}>
          Start your online business with one clear plan.
        </p>

        <div style={styles.card}>
          <div style={styles.badge}>Starter</div>

          <div style={styles.priceRow}>
            <span style={styles.price}>246</span>
            <span style={styles.currency}>usd</span>
          </div>

          <p style={styles.paymentType}>One-Time Payment</p>

          <div style={styles.divider} />

          <ul style={styles.features}>
          
            <li style={styles.feature}>✓ Website Builder</li>
            <li style={styles.feature}>✓ Store Designer</li>
            <li style={styles.feature}>✓ Products</li>
            <li style={styles.feature}>✓ Orders</li>
            <li style={styles.feature}>✓ Customers</li>
            <li style={styles.feature}>✓ Shipping Management</li>
            <li style={styles.feature}>✓ Dashboard</li>
          </ul>

            

          <button
            type="button"
            onClick={handleGetStarted}
            style={styles.button}
          >
            Get Started
          </button>

          <p style={styles.consentText}>
            You will review and approve the recurring subscription terms
            before payment.
          </p>
        </div>
      </div>
    </section>
  );
}

const styles = {
  section: {
    padding: "90px 20px",
    backgroundColor: "#f7f7fb",
  },

  container: {
    maxWidth: "1100px",
    margin: "0 auto",
    textAlign: "center",
  },

  eyebrow: {
    margin: 0,
    color: "#6b7280",
    fontSize: "13px",
    fontWeight: "700",
    letterSpacing: "1.6px",
  },

  title: {
    margin: "10px 0",
    color: "#111827",
    fontSize: "42px",
  },

  subtitle: {
    margin: "0 auto 40px",
    maxWidth: "600px",
    color: "#6b7280",
    fontSize: "17px",
    lineHeight: 1.7,
  },

  card: {
    width: "100%",
    maxWidth: "430px",
    margin: "0 auto",
    padding: "34px",
    boxSizing: "border-box",
    borderRadius: "22px",
    backgroundColor: "#ffffff",
    border: "1px solid #e5e7eb",
    boxShadow: "0 18px 45px rgba(17, 24, 39, 0.08)",
    textAlign: "left",
  },

  badge: {
    display: "inline-block",
    padding: "7px 13px",
    borderRadius: "999px",
    backgroundColor: "#111827",
    color: "#ffffff",
    fontSize: "13px",
    fontWeight: "700",
  },

  priceRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    marginTop: "24px",
  },

  price: {
    color: "#111827",
    fontSize: "58px",
    fontWeight: "800",
    lineHeight: 1,
  },

  currency: {
    marginBottom: "7px",
    color: "#6b7280",
    fontSize: "18px",
    fontWeight: "700",
  },

  paymentType: {
    margin: "10px 0 0",
    color: "#4b5563",
    fontSize: "15px",
  },

  divider: {
    height: "1px",
    margin: "26px 0",
    backgroundColor: "#e5e7eb",
  },

  features: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },

  feature: {
    color: "#374151",
    fontSize: "16px",
    lineHeight: 1.5,
  },

  notice: {
    marginTop: "26px",
    padding: "15px",
    borderRadius: "12px",
    backgroundColor: "#f3f4f6",
    color: "#374151",
    fontSize: "14px",
    lineHeight: 1.6,
  },

  button: {
    width: "100%",
    marginTop: "22px",
    padding: "15px",
    border: "none",
    borderRadius: "12px",
    backgroundColor: "#111827",
    color: "#ffffff",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
  },

  consentText: {
    margin: "14px 0 0",
    color: "#6b7280",
    fontSize: "12px",
    lineHeight: 1.5,
    textAlign: "center",
  },
};

export default Pricing;
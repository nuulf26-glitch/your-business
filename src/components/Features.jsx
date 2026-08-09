function Features() {
  const cardStyle = {
    background: "white",
    padding: "30px",
    borderRadius: "18px",
    boxShadow: "0 10px 30px rgba(0,0,0,.08)",
    textAlign: "center",
  };

  return (
    <section
      style={{
        padding: "90px 60px",
        background: "#f7f7fb",
      }}
    >
      <h2
        style={{
          textAlign: "center",
          fontSize: "42px",
          marginBottom: "50px",
        }}
      >
        Everything You Need
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          gap: "25px",
          maxWidth: "1200px",
          margin: "auto",
        }}
      >
        <div style={cardStyle}>
          <h3>🛍️ Online Store</h3>
          <p>Create your own professional store.</p>
        </div>

        <div style={cardStyle}>
          <h3>📦 Products</h3>
          <p>Add and manage unlimited products.</p>
        </div>

        <div style={cardStyle}>
          <h3>🛒 Orders</h3>
          <p>Track every order easily.</p>
        </div>

        <div style={cardStyle}>
          <h3>💳 Payments</h3>
          <p>Accept online payments.</p>
        </div>

        <div style={cardStyle}>
          <h3>🚚 Shipping</h3>
          <p>Manage deliveries in one place.</p>
        </div>

        <div style={cardStyle}>
          <h3>📊 Dashboard</h3>
          <p>See your business analytics instantly.</p>
        </div>
      </div>
    </section>
  );
}

export default Features;
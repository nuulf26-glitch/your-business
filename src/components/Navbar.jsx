function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "20px 60px",
        background: "white",
      }}
    >
      <h2>Your Business</h2>

      <div style={{ display: "flex", gap: "20px" }}>
        <a href="#">Features</a>
        <a href="#">Pricing</a>
        <a href="#">Login</a>
        <button>Start Free</button>
      </div>
    </nav>
  );
}

export default Navbar;
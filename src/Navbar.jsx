function Navbar() {
  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "22px 70px",
        background: "white",
        borderBottom: "1px solid #eee",
      }}
    >
      <h2
        style={{
          color: "#6D28D9",
          fontWeight: "700",
        }}
      >
        Your Business
      </h2>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "35px",
        }}
      >
        <a href="#">Features</a>
        <a href="#">Pricing</a>
        <a href="#">Login</a>

        <button
          style={{
            background: "#6D28D9",
            color: "white",
            border: "none",
            padding: "12px 26px",
            borderRadius: "12px",
            cursor: "pointer",
            fontWeight: "600",
          }}
        >
          Start Free
        </button>
      </div>
    </nav>
  );
}

export default Navbar;
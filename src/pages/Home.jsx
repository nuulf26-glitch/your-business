function Home() {
  return (
    <main
      style={{
        minHeight: "90vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f7f7fb",
        textAlign: "center",
        padding: "40px",
      }}
    >
      <div style={{ maxWidth: "850px" }}>
        <h1
          style={{
            fontSize: "72px",
            fontWeight: "800",
            lineHeight: "1.1",
          }}
        >
          Build Your Online Store
          <br />
          In Minutes
        </h1>

        <p
          style={{
            marginTop: "25px",
            fontSize: "22px",
            color: "#6b7280",
            lineHeight: "1.6",
          }}
        >
          Create your website, sell products, manage orders,
          shipping and customers from one place.
        </p>

        <button
          style={{
            marginTop: "40px",
            background: "#6D28D9",
            color: "white",
            border: "none",
            padding: "18px 42px",
            borderRadius: "14px",
            fontSize: "18px",
            cursor: "pointer",
          }}
        >
          Start 14-Day Free Trial
        </button>
      </div>
    </main>
  );
}

export default Home;
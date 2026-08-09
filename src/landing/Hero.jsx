import { useNavigate } from "react-router-dom";
import "./landing.css";

export default function Hero() {
  const navigate = useNavigate();

  function handleWatchDemo() {
    const demoSection = document.getElementById("platform-preview");

    if (demoSection) {
      demoSection.scrollIntoView({
        behavior: "smooth",
      });
    }
  }

  return (
    <section style={{ 
      backgroundColor: "#f9f8f6", 
      color: "#111", 
      padding: "80px 5% 40px", 
      fontFamily: "'Mograp', sans-serif",
      borderBottom: "1px solid #e5e5e0"
    }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        
        {/* Top Badge */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "#f1f0ec", padding: "6px 14px", borderRadius: "20px", fontSize: "0.85rem", marginBottom: "25px", color: "#333" }}>
          <span style={{ width: "6px", height: "6px", background: "#111", borderRadius: "50%" }} />
          Website building, made simple
        </div>

        {/* Main Title (Original Text) */}
        <h1 style={{ 
          fontSize: "clamp(2.5rem, 5.5vw, 4.5rem)", 
          fontWeight: "400", 
          lineHeight: "1.1", 
          letterSpacing: "-0.03em", 
          margin: "0 0 25px 0",
          textTransform: "lowercase",
          fontFamily: "'Mograp', sans-serif"
        }}>
          Build the website <br/>
          <span style={{ color: "#666" }}>your business deserves.</span>
        </h1>

        {/* Description (Original Text) */}
        <p style={{ maxWidth: "650px", fontSize: "1.05rem", lineHeight: "1.6", color: "#555", margin: "0 0 40px 0", fontFamily: "'Mograp', sans-serif" }}>
          Create a professional online store without coding. Choose a beautiful template, customize every detail, upload your products, manage orders, and track your business performance from one powerful platform.
        </p>

        {/* Buttons (Original) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "center", marginBottom: "60px" }}>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            style={{
              background: "#111",
              color: "#fff",
              border: "none",
              padding: "16px 32px",
              fontSize: "0.95rem",
              fontWeight: "500",
              letterSpacing: "0.5px",
              borderRadius: "0px",
              cursor: "pointer",
              fontFamily: "'Mograp', sans-serif",
            }}
          >
            Start Building →
          </button>

          <button
            type="button"
            onClick={handleWatchDemo}
            style={{
              background: "transparent",
              color: "#111",
              border: "1px solid #111",
              padding: "16px 32px",
              fontSize: "0.95rem",
              fontWeight: "500",
              letterSpacing: "0.5px",
              borderRadius: "0px",
              cursor: "pointer",
              fontFamily: "'Mograp', sans-serif",
            }}
          >
            Watch Demo
          </button>
        </div>

      </div>

      {/* Bottom Bar / Rows (الأسطر السفلية) */}
      <div style={{ maxWidth: "1100px", margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.85rem", color: "#666", borderTop: "1px solid #e5e5e0", paddingTop: "25px", flexWrap: "wrap", gap: "15px" }}>
        <span>No coding required</span>
        <span>•</span>
        <span>Professional templates</span>
        <span>•</span>
        <span>Products and orders</span>
        <span>•</span>
        <span>Business analytics</span>
      </div>

    </section>
  );
}
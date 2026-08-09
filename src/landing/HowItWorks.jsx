import { useNavigate } from "react-router-dom";
import "./landing.css";

const steps = [
  {
    number: "01",
    title: "Create your account",
    text: "Sign up in minutes and access everything you need to start building your online business.",
  },
  {
    number: "02",
    title: "Choose a template",
    text: "Select a professionally designed template that matches your business and style.",
  },
  {
    number: "03",
    title: "Upload your brand",
    text: "Add your logo, cover images, product photos, and business information directly from your device.",
  },
  {
    number: "04",
    title: "Customize everything",
    text: "Choose your colors, fonts, layouts, product cards, and website sections without writing code.",
  },
  {
    number: "05",
    title: "Add your products",
    text: "Upload products, set prices in USD, organize categories, and prepare your store for customers.",
  },
  {
    number: "06",
    title: "Publish and start selling",
    text: "Launch your website, receive orders, manage customers, and track your business performance.",
  },
];

function HowItWorks() {
  const navigate = useNavigate();

  return (
    <section style={{ 
      backgroundColor: "#f9f8f6", 
      color: "#111", 
      padding: "100px 5%", 
      fontFamily: "'Mograp', sans-serif",
      borderBottom: "1px solid #e5e5e0"
    }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        
        {/* Top Header Index */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666", marginBottom: "40px" }}>
          <span>[ 02 — WORKFLOW ]</span>
          <span>HOW IT WORKS</span>
        </div>

        {/* Heading & Intro */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "30px", marginBottom: "80px", borderBottom: "1px solid #e5e5e0", paddingBottom: "40px" }}>
          <div>
            <p style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", marginBottom: "15px", fontFamily: "'Mograp', sans-serif" }}>
              HOW IT WORKS
            </p>
            <h2 style={{ 
              fontSize: "clamp(2.2rem, 4.5vw, 4rem)", 
              fontWeight: "400", 
              lineHeight: "1.1", 
              letterSpacing: "-0.03em", 
              margin: 0,
              textTransform: "lowercase",
              fontFamily: "'Mograp', sans-serif"
            }}>
              From idea to online store <br/>
              <span style={{ color: "#666" }}>in six simple steps.</span>
            </h2>
          </div>

          <div style={{ maxWidth: "400px" }}>
            <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.6", marginBottom: "20px", fontFamily: "'Mograp', sans-serif" }}>
              You do not need coding experience, a designer, or a technical team. We guide you through every step until your website is ready to publish.
            </p>
            <button
              type="button"
              onClick={() => navigate("/signup")}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "14px 28px",
                fontSize: "0.9rem",
                fontWeight: "500",
                letterSpacing: "0.5px",
                borderRadius: "0px",
                cursor: "pointer",
                fontFamily: "'Mograp', sans-serif",
              }}
            >
              Start Building →
            </button>
          </div>
        </div>

        {/* Steps Grid (Editorial Minimal Style) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "40px", marginBottom: "100px" }}>
          {steps.map((step) => (
            <div key={step.number} style={{ borderTop: "1px solid #111", paddingTop: "25px" }}>
              <div style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", marginBottom: "15px", fontFamily: "'Mograp', sans-serif" }}>
                {step.number}
              </div>
              <h3 style={{ fontSize: "1.2rem", fontWeight: "500", marginBottom: "12px", color: "#111", fontFamily: "'Mograp', sans-serif" }}>
                {step.title}
              </h3>
              <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.6", margin: 0, fontFamily: "'Mograp', sans-serif" }}>
                {step.text}
              </p>
            </div>
          ))}
        </div>

        {/* Builder Preview Section */}
        <div style={{ background: "#f1f0ec", padding: "60px 40px", borderRadius: "0px", border: "1px solid #e5e5e0" }}>
          <div style={{ maxWidth: "700px", marginBottom: "40px" }}>
            <p style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", marginBottom: "10px", fontFamily: "'Mograp', sans-serif" }}>
              SIMPLE WEBSITE BUILDER
            </p>
            <h3 style={{ fontSize: "2.2rem", fontWeight: "400", lineHeight: "1.2", marginBottom: "20px", textTransform: "lowercase", fontFamily: "'Mograp', sans-serif" }}>
              Make changes visually. See every update instantly.
            </h3>
            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6", fontFamily: "'Mograp', sans-serif" }}>
              Add sections, remove sections, change colors, upload images, rearrange content, and preview your website before publishing.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "30px", borderTop: "1px solid #dcdad4", paddingTop: "40px" }}>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", marginBottom: "8px", color: "#111", fontFamily: "'Mograp', sans-serif" }}>+ Add sections</strong>
              <p style={{ color: "#666", fontSize: "0.9rem", margin: 0, fontFamily: "'Mograp', sans-serif" }}>Build your page with ready-made blocks.</p>
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", marginBottom: "8px", color: "#111", fontFamily: "'Mograp', sans-serif" }}>− Remove anything</strong>
              <p style={{ color: "#666", fontSize: "0.9rem", margin: 0, fontFamily: "'Mograp', sans-serif" }}>Keep only the sections your business needs.</p>
            </div>
            <div>
              <strong style={{ display: "block", fontSize: "1rem", marginBottom: "8px", color: "#111", fontFamily: "'Mograp', sans-serif" }}>✓ Save your design</strong>
              <p style={{ color: "#666", fontSize: "0.9rem", margin: 0, fontFamily: "'Mograp', sans-serif" }}>Preview and publish when everything looks right.</p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}

export default HowItWorks;
import React from "react";
import "./landing.css";

export default function Reviews() {
  const reviews = [
    { 
      name: "Youssef Ahmed", 
      role: "Founder, Cairo Modern", 
      text: "Switching to this platform was a game-changer. Managing products and tracking real-time orders has never been smoother." 
    },
    { 
      name: "Oliver Smith", 
      role: "Owner, London Goods", 
      text: "The multi-currency support and seamless shipping manager helped us scale internationally without technical headaches." 
    },
    { 
      name: "Charlotte Williams", 
      role: "Director, Luxe London", 
      text: "Clean interface, lightning-fast setup, and extremely professional dashboards. Highly recommended!" 
    },
    { 
      name: "George Taylor", 
      role: "Manager, British Apparel", 
      text: "An incredible experience from start to finish. Our online store looks stunning and professional." 
    },
    { 
      name: "Emily Brown", 
      role: "Founder, Oxford Style", 
      text: "We launched our store in days instead of months. The template design is gorgeous." 
    },
    { 
      name: "Mateo Fernández", 
      role: "Owner, Madrid Studio", 
      text: "The visual editor is intuitive and powerful. Perfect for high-end digital brands." 
    },
    { 
      name: "Leonardo Rossi", 
      role: "Director, Milan Craft", 
      text: "Exceptional quality and minimal aesthetic. Exactly what our brand needed." 
    }
  ];

  return (
    <section 
      id="reviews" 
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
          <span>[ 04 — SUCCESS STORIES ]</span>
          <span>TESTIMONIALS</span>
        </div>

        <div style={{ marginBottom: "60px" }}>
          <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", display: "block", marginBottom: "15px", fontFamily: "'Mograp', sans-serif" }}>
            Success Stories
          </span>
          <h2 style={{ 
            fontSize: "clamp(2.2rem, 4.5vw, 3.5rem)", 
            fontWeight: "400", 
            lineHeight: "1.1", 
            letterSpacing: "-0.03em", 
            margin: 0,
            textTransform: "lowercase",
            fontFamily: "'Mograp', sans-serif"
          }}>
            Trusted by modern
            <br />
            <span style={{ color: "#666" }}>entrepreneurs.</span>
          </h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "40px" }}>
          {reviews.map((review, idx) => (
            <div 
              key={idx} 
              style={{ 
                background: "#fff", 
                padding: "40px 30px", 
                border: "1px solid #e5e5e0", 
                display: "flex", 
                flexDirection: "column", 
                justifyContent: "space-between",
                borderRadius: "0px"
              }}
            >
              <div>
                <div style={{ color: "#111", fontSize: "0.9rem", letterSpacing: "2px", marginBottom: "20px" }}>★★★★★</div>
                <p style={{ color: "#333", fontSize: "1rem", lineHeight: "1.6", margin: "0 0 30px 0", fontFamily: "'Mograp', sans-serif" }}>
                  "{review.text}"
                </p>
              </div>
              <div style={{ borderTop: "1px solid #e5e5e0", paddingTop: "20px" }}>
                <div style={{ fontWeight: "500", color: "#111", fontSize: "0.95rem", fontFamily: "'Mograp', sans-serif" }}>
                  {review.name}
                </div>
                <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "4px", fontFamily: "'Mograp', sans-serif" }}>
                  {review.role}
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
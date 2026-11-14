import { useNavigate } from "react-router-dom";
import "./landing.css";

const builderFeatures = [
  {
    number: "01",
    title: "Drag and drop sections",
    text: "Add, remove, and rearrange website sections without writing any code.",
  },
  {
    number: "02",
    title: "Customize your design",
    text: "Change colors, fonts, spacing, buttons, images, and layouts to match your brand.",
  },
  {
    number: "03",
    title: "Edit your content",
    text: "Update headlines, descriptions, product information, and business details instantly.",
  },
  {
    number: "04",
    title: "Preview every screen",
    text: "See how your website looks on desktop, tablet, and mobile before publishing.",
  },
];

function WebsiteBuilder() {
  const navigate = useNavigate();

  return (
    <section 
      id="website-builder" 
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
          <span>[ 03 — INTERACTIVE PREVIEW ]</span>
          <span>WEBSITE BUILDER</span>
        </div>

        {/* Main Layout Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "60px", alignItems: "start", marginBottom: "80px" }}>
          
          {/* Left Content */}
          <div>
            <span style={{ fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "2px", color: "#888", display: "block", marginBottom: "15px", fontFamily: "'Mograp', sans-serif" }}>
              Website builder
            </span>

            <h2 style={{ 
              fontSize: "clamp(2.2rem, 4vw, 3.5rem)", 
              fontWeight: "400", 
              lineHeight: "1.1", 
              letterSpacing: "-0.03em", 
              margin: "0 0 20px 0",
              textTransform: "lowercase",
              fontFamily: "'Mograp', sans-serif"
            }}>
              Create your website
              <br />
              <span style={{ color: "#666" }}>exactly how you want it</span>
            </h2>

            <p style={{ color: "#555", fontSize: "1rem", lineHeight: "1.6", marginBottom: "40px", fontFamily: "'Mograp', sans-serif" }}>
              Create a professional business website with a simple visual editor.
              Customize its sections and preview changes before publishing.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "30px", marginBottom: "40px" }}>
              {builderFeatures.map((feature) => (
                <div key={feature.number} style={{ display: "flex", gap: "20px", alignItems: "flex-start", borderTop: "1px solid #e5e5e0", paddingTop: "20px" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: "600", color: "#666", fontFamily: "'Mograp', sans-serif" }}>
                    {feature.number}
                  </span>

                  <div>
                    <h3 style={{ fontSize: "1.1rem", fontWeight: "500", margin: "0 0 8px 0", color: "#111", fontFamily: "'Mograp', sans-serif" }}>{feature.title}</h3>
                    <p style={{ color: "#555", fontSize: "0.95rem", lineHeight: "1.5", margin: 0, fontFamily: "'Mograp', sans-serif" }}>{feature.text}</p>
                  </div>
                </div>
              ))}
            </div>

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
              Start building →
            </button>
          </div>

          {/* Right Visual Window Preview */}
          <div style={{ background: "#fff", border: "1px solid #111", borderRadius: "0px", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.03)" }}>
            
            {/* Window Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", background: "#f9f8f6", borderBottom: "1px solid #e5e5e0" }}>
              <div style={{ display: "flex", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", background: "#ddd", borderRadius: "50%", display: "inline-block" }}></span>
                <span style={{ width: "10px", height: "10px", background: "#ddd", borderRadius: "50%", display: "inline-block" }}></span>
                <span style={{ width: "10px", height: "10px", background: "#ddd", borderRadius: "50%", display: "inline-block" }}></span>
              </div>

              <span style={{ fontSize: "0.85rem", fontWeight: "500", color: "#333", fontFamily: "'Mograp', sans-serif" }}>Website editor</span>

              <button type="button" style={{ background: "#111", color: "#fff", border: "none", padding: "6px 14px", fontSize: "0.75rem", cursor: "pointer", fontFamily: "'Mograp', sans-serif" }}>
                Publish
              </button>
            </div>

            {/* Window Body */}
            <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 180px", minHeight: "450px" }} className="builder-window-body-grid">
              
              {/* Sidebar: Sections */}
              <aside style={{ background: "#f9f8f6", borderRight: "1px solid #e5e5e0", padding: "20px 15px", display: "flex", flexDirection: "column", gap: "8px" }}>
                <p style={{ fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: "1.5px", color: "#888", marginBottom: "10px", fontFamily: "'Mograp', sans-serif" }}>Sections</p>
                {["Header", "Hero", "Products", "About", "Contact"].map((sec, idx) => (
                  <button key={sec} type="button" style={{ textAlign: "left", padding: "8px 10px", background: idx === 1 ? "#111" : "transparent", color: idx === 1 ? "#fff" : "#333", border: "none", fontSize: "0.85rem", cursor: "pointer", fontFamily: "'Mograp', sans-serif" }}>
                    {sec}
                  </button>
                ))}
              </aside>

              {/* Canvas */}
              <div style={{ background: "#fff", padding: "20px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ display: "flex", justifyContent: "center", gap: "15px", fontSize: "0.75rem", color: "#888", marginBottom: "15px", borderBottom: "1px solid #e5e5e0", paddingBottom: "10px", fontFamily: "'Mograp', sans-serif" }}>
               …6627 tokens truncated…;
  const group = useMemo(() => proposalGroups.find(item => item.id === groupId) || proposalGroups[0], [groupId]);
  return <main className="proposal-workspace">
    <aside className="proposal-sidebar"><Link className="proposal-brand" to="/">CYB<span>STUDIO</span></Link><p className="proposal-sidebar-note">Visual concepts for features with unrecovered requirements.</p>{proposalGroups.map(section => <section key={section.id}><span className="proposal-nav-label">{section.label}</span>{section.items.map(item => <button key={item} type="button" className={item === screenTitle ? "active" : ""} onClick={() => { setGroupId(section.id); setScreenTitle(item); }}>{item}</button>)}</section>)}<Link className="proposal-back" to="/">← Back to CYB</Link></aside>
    <section className="proposal-main"><header className="proposal-topbar"><div><span>DESIGN REVIEW · ISOLATED PREVIEW</span><h1>{screenTitle}</h1></div><StatusBadge tone="warning">PROPOSED · APPROVAL REQUIRED</StatusBadge></header><div className="proposal-canvas"><div className="proposal-canvas-meta"><span>{group.label}</span><span>Preview only · no operational data</span></div><ScreenContent title={screenTitle} group={groupId} /></div></section>
  </main>;
}

import { useNavigate } from "react-router-dom";
import "./landing.css";

const steps = [
  ["01", "Describe the site", "Tell CYB what you sell, who you serve, and the style you want."],
  ["02", "Review the draft", "Generate editable sections, then preview the proposed design before applying it."],
  ["03", "Refine with prompts", "Ask for focused changes to colours, copy, section order, or layout."],
  ["04", "Keep control", "Continue editing by hand, undo changes, save a draft, and publish when ready."],
];

export default function AiDesignFeature() {
  const navigate = useNavigate();
  return <section id="ai-design" style={{ background: "#f9f8f6", color: "#171513", padding: "100px 5%", borderBottom: "1px solid #e5e5e0" }}>
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 24, fontSize: ".75rem", letterSpacing: "1.5px", textTransform: "uppercase", color: "#666", marginBottom: 38 }}><span>CYB AI DESIGN</span><span>EDITABLE BY YOU</span></div>
      <div className="ai-design-layout" style={{ display: "grid", gridTemplateColumns: "minmax(0,1.1fr) minmax(280px,.9fr)", gap: "8%", alignItems: "start" }}>
        <div><h2 style={{ fontSize: "clamp(2.2rem,4.5vw,3.5rem)", fontWeight: 400, lineHeight: 1.1, letterSpacing: "-.03em", margin: "0 0 22px", textTransform: "lowercase" }}>Start with a prompt.<br/><span style={{ color: "#666" }}>Keep every detail editable.</span></h2><p style={{ color: "#555", lineHeight: 1.7, maxWidth: 640 }}>CYB AI can create an editable website draft and prepare focused changes to your existing design. Review proposed changes before applying them, then continue in the visual editor.</p><div style={{ background: "#fff", border: "1px solid #e5e5e0", padding: "22px 24px", marginTop: 28 }}><small style={{ display: "block", color: "#777", letterSpacing: ".12em", textTransform: "uppercase", marginBottom: 10 }}>Example request</small><p style={{ margin: 0, fontFamily: "Georgia,serif", fontSize: "1.15rem", lineHeight: 1.55 }}>“Create a beige skincare website with a product gallery, a clear contact section, and a large editorial headline.”</p></div><button type="button" onClick={() => navigate("/signup")} style={{ background: "#171513", color: "white", border: 0, padding: "15px 22px", marginTop: 28, cursor: "pointer" }}>Try CYB AI</button></div>
        <div style={{ display: "grid", gap: 20 }}>{steps.map(([number, title, copy]) => <article key={number} style={{ borderTop: "1px solid #d9d6cf", paddingTop: 18, display: "grid", gridTemplateColumns: "38px 1fr", gap: 14 }}><span style={{ color: "#777", fontSize: ".8rem" }}>{number}</span><div><h3 style={{ margin: "0 0 8px", fontSize: "1.05rem", fontWeight: 500 }}>{title}</h3><p style={{ margin: 0, color: "#666", lineHeight: 1.6, fontSize: ".92rem" }}>{copy}</p></div></article>)}</div>
      </div>
    </div>
  </section>;
}

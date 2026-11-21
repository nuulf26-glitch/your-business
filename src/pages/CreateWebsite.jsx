import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/createWebsite.css";
import { saveStore } from "../services/storeService";

import { BUSINESS_CATEGORIES } from "../business/categories";
const businessGoals = BUSINESS_CATEGORIES;

function CreateWebsite() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState(""); 
  const [storeUrl, setStoreUrl] = useState("");
  const [startingPoint, setStartingPoint] = useState("template");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function handleFinish() {
    if (creating) return;
    setError("");

    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!businessGoal) {
      setError("Please select your business goal.");
      return;
    }
    const normalizedStoreUrl = storeUrl.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(normalizedStoreUrl)) {
      setError("Please choose your website URL.");
      return;
    }

    const websiteData = {
      businessName: businessName.trim(),
      description: description.trim(),
      businessGoal: businessGoal,
      businessCategory: businessGoal,
      storeUrl: normalizedStoreUrl,
    };

    setCreating(true);
    try {
      await saveStore(websiteData);
      try { localStorage.setItem("websiteSetup", JSON.stringify(websiteData)); } catch { /* The saved account remains the source of truth. */ }
      navigate(startingPoint === "ai" ? "/editor?start=ai" : "/templates?onboarding=1");
    } catch {
      setError("We couldn’t save your website. Check your connection and try again.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="create-website-page">
      <div className="create-website-shell">
        
        <aside className="wizard-sidebar">
          <button type="button" className="wizard-logo" onClick={() => navigate("/")}>
            CYB
          </button>
          <div className="wizard-sidebar-content">
            <span className="wizard-eyebrow">Website Setup</span>
            <h1>Create your business website</h1>
            <p>Complete these details to prepare your online presence in one single step.</p>
          </div>
          <p className="wizard-sidebar-footer">You can customize everything inside the editor later.</p>
        </aside>

        <main className="wizard-main" aria-busy={creating}>
          <div className="wizard-card">
            <div className="wizard-step-content">
              
              {/* 1. Business Name */}
              <div className="wizard-field">
                <label htmlFor="businessName">Business name</label>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
                  required
                  maxLength={120}
                />
              </div>

              {/* 2. Business Description */}
              <div className="wizard-field" style={{ marginTop: "25px" }}>
                <label htmlFor="businessDescription">Business Description</label>
                <textarea
                  id="businessDescription"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what your business sells or offers..."
                  rows="3"
                />
              </div>

              {/* 3. The 6 Original Generic Options */}
              <div className="wizard-field" style={{ marginTop: "30px" }}>
                <label id="business-type-label">What type of business do you run?</label>
                <div className="template-choice-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginTop: "10px" }}>
                  {businessGoals.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`template-choice-card ${businessGoal === item.id ? "selected" : ""}`}
                      onClick={() => setBusinessGoal(item.id)}
                      aria-pressed={businessGoal === item.id}
                      style={{ padding: "15px", textAlign: "left", display: "block", height: "auto" }}
                    >
                      <strong style={{ display: "block", fontSize: "1rem", marginBottom: "4px" }}>{item.title}</strong>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#666", lineHeight: "1.3" }}>{item.description}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Store URL */}
              <div className="wizard-field" style={{ marginTop: "35px" }}>
                <label htmlFor="storeUrl">Website Address</label>
                <div className="wizard-url-field">
                  <span aria-hidden="true">store/</span>
                  <input
                    id="storeUrl"
                    type="text"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="your-store-name"
                    required
                    maxLength={100}
                    pattern="[a-z0-9-]+"
                    aria-describedby="store-url-help"
                  />
                  <small id="store-url-help">Use letters, numbers, and hyphens.</small>
                </div>
              </div>

              <fieldset className="wizard-start-choice">
                <legend>How would you like to start?</legend>
                <label className={startingPoint === "template" ? "selected" : ""}>
                  <input type="radio" name="startingPoint" value="template" checked={startingPoint === "template"} onChange={() => setStartingPoint("template")} />
                  <span><strong>Choose a template</strong><small>Pick a starting design, then customize it.</small></span>
                </label>
                <label className={startingPoint === "ai" ? "selected" : ""}>
                  <input type="radio" name="startingPoint" value="ai" checked={startingPoint === "ai"} onChange={() => setStartingPoint("ai")} />
                  <span><strong>Start with AI</strong><small>Describe your business and review an editable draft.</small></span>
                </label>
              </fieldset>

            </div>

            {error && <p className="wizard-error" role="alert">{error}</p>}

            <div className="wizard-actions" style={{ marginTop: "30px", justifyContent: "flex-end" }}>
              <button type="button" className="wizard-next-button" onClick={handleFinish} disabled={creating}>
                {creating ? "Saving your website…" : "Continue"}
              </button>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

export default CreateWebsite;

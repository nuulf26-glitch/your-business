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
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  async function handleFinish(event) {
    event.preventDefault();
    if (saving) return;
    setError("");

    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!businessGoal) {
      setError("Choose a business type to continue.");
      document.querySelector(".template-choice-card")?.focus();
      return;
    }
    if (!storeUrl.trim()) {
      setError("Please choose your website URL.");
      return;
    }

    const websiteData = {
      businessName: businessName.trim(),
      description: description.trim(),
      businessGoal: businessGoal,
      businessCategory: businessGoal,
      template: "luxury", 
      storeUrl: storeUrl
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-"),
    };

    setSaving(true);
    try {
      const store = await saveStore(websiteData);
      try { localStorage.setItem("websiteSetup", JSON.stringify(store || websiteData)); } catch { /* The server saved the setup. */ }
      navigate("/editor");
    } catch (error) {
      setError(error.status === 409 ? "That website address is already in use. Choose another address and try again." : "We couldn’t save your setup. Your details are still here. Try again.");
    } finally {
      setSaving(false);
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
            <p>Choose a name and address. Next, you’ll edit your first page before publishing.</p>
          </div>
          <p className="wizard-sidebar-footer">You can customize everything inside the editor later.</p>
        </aside>

        <main className="wizard-main">
          <form className="wizard-card" onSubmit={handleFinish} aria-busy={saving}>
            <div className="wizard-step-content">
              
              {/* 1. Business Name */}
              <div className="wizard-field">
                <label htmlFor="businessName">Business Name</label>
                <input
                  id="businessName" required autoComplete="organization"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
                />
              </div>

              {/* 2. Business Description */}
              <div className="wizard-field" style={{ marginTop: "25px" }}>
                <label htmlFor="businessDescription">Business description (optional)</label>
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
                <span id="business-type-label">What type of business do you run?</span>
                <div role="group" aria-labelledby="business-type-label" className="template-choice-grid" style={{ gap: "12px", marginTop: "10px" }}>
                  {businessGoals.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      aria-pressed={businessGoal === item.id}
                      className={`template-choice-card ${businessGoal === item.id ? "selected" : ""}`}
                      onClick={() => setBusinessGoal(item.id)}
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
                  <span>store/</span>
                  <input
                    id="storeUrl" required
                    type="text"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    placeholder="your-store-name"
                  />
                </div>
              </div>

            </div>

            {error && <p className="wizard-error" role="alert">{error}</p>}

            <div className="wizard-actions" style={{ marginTop: "30px", justifyContent: "flex-end" }}>
              <button type="submit" disabled={saving} className="wizard-next-button">
                {saving ? "Saving setup…" : "Save and open editor"}
              </button>
            </div>

          </form>
        </main>

      </div>
    </div>
  );
}

export default CreateWebsite;
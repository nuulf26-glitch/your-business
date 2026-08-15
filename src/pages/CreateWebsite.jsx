import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/createWebsite.css";
import { saveStore } from "../services/storeService";

// Generic descriptions with no third-party platform names
const businessGoals = [
  { id: 'sell_online', title: 'Sell Online', description: 'Start a brand new online store from scratch.' },
  { id: 'move_web', title: 'Move Existing Website', description: 'Migrate your current store from another e-commerce platform smoothly.' },
  { id: 'sell_store', title: 'Sell in Store & Online', description: 'Connect your physical boutique or retail shop with your online store.' },
  { id: 'showcase', title: 'Just Showcasing', description: 'Display your products beautifully as a portfolio without online checkout.' },
  { id: 'social_seller', title: 'Social Media Seller', description: 'Transform your social media channel sales into a professional website.' },
  { id: 'pre_order', title: 'Pre-order / Launching Soon', description: 'Build anticipation and collect customer emails before your big launch.' }
];

function CreateWebsite() {
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState("");
  const [description, setDescription] = useState("");
  const [businessGoal, setBusinessGoal] = useState(""); 
  const [storeUrl, setStoreUrl] = useState("");
  const [error, setError] = useState("");

  function handleFinish() {
    setError("");

    if (!businessName.trim()) {
      setError("Please enter your business name.");
      return;
    }
    if (!businessGoal) {
      setError("Please select your business goal.");
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
      template: "luxury", 
      storeUrl: storeUrl
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-"),
    };

localStorage.setItem("websiteSetup", JSON.stringify(websiteData));

saveStore(websiteData);
    navigate("/dashboard");
  }

  return (
    <div className="create-website-page">
      <div className="create-website-shell">
        
        <aside className="wizard-sidebar">
          <button type="button" className="wizard-logo" onClick={() => navigate("/")}>
            Your Business
          </button>
          <div className="wizard-sidebar-content">
            <span className="wizard-eyebrow">Website Setup</span>
            <h1>Create your business website</h1>
            <p>Complete these details to prepare your online presence in one single step.</p>
          </div>
          <p className="wizard-sidebar-footer">You can customize everything inside the editor later.</p>
        </aside>

        <main className="wizard-main">
          <div className="wizard-card">
            <div className="wizard-step-content">
              
              {/* 1. Business Name */}
              <div className="wizard-field">
                <label htmlFor="businessName">Business Name</label>
                <input
                  id="businessName"
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="Enter your business name"
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
                <label>What is your current business goal?</label>
                <div className="template-choice-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", gap: "12px", marginTop: "10px" }}>
                  {businessGoals.map((item) => (
                    <button
                      type="button"
                      key={item.id}
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
                    id="storeUrl"
                    type="text"
                    value={storeUrl}
                    onChange={(e) => setStoreUrl(e.target.value)}
                    placeholder="your-store-name"
                  />
                </div>
              </div>

            </div>

            {error && <p className="wizard-error">{error}</p>}

            <div className="wizard-actions" style={{ marginTop: "30px", justifyContent: "flex-end" }}>
              <button type="button" className="wizard-next-button" onClick={handleFinish}>
                Create Website
              </button>
            </div>

          </div>
        </main>

      </div>
    </div>
  );
}

export default CreateWebsite;
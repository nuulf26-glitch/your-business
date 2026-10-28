import { useEffect, useState } from "react";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/aiDesigner.css";

export default function AiDesigner({ model = {}, onApply, onClose, initialTab = "design", publicMode = false }) {
  const [tab, setTab] = useState(initialTab);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState({ freeDesignUsed: false, aiPremium: false, monthlyPrice: null });
  const [pendingModel, setPendingModel] = useState(null);

  useEffect(() => {
    if (publicMode) return;
    customBackendRequest("/websites/ai/status").then(result => { setStatus(result); if (initialTab === "help" && !result.aiPremium && result.aiHelpFreeUsed) setTab("upgrade"); }).catch(() => {});
    const params = new URLSearchParams(window.location.search);
    const subscriptionId = params.get("subscription_id") || params.get("token");
    if (params.get("aiSubscription") === "success" && subscriptionId) {
      setBusy(true);
      customBackendRequest("/payments/paypal/ai-subscriptions/activate", { method: "POST", body: JSON.stringify({ subscriptionId }) })
        .then(() => customBackendRequest("/websites/ai/status")).then(setStatus)
        .catch(() => setError("We could not confirm the subscription. Please try again."))
        .finally(() => { setBusy(false); window.history.replaceState({}, "", window.location.pathname); });
    } else if (params.get("aiSubscription") === "cancelled") {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [publicMode, initialTab]);

  async function design(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await customBackendRequest("/websites/ai/design", { method: "POST", body: JSON.stringify({ prompt }) });
      setPendingModel(result.model); setStatus(current => ({ ...current, freeDesignUsed: result.freeDesignUsed || current.freeDesignUsed, aiPremium: result.aiPremium || current.aiPremium }));
    } catch (e) {
      if (e.status === 409) setTab("upgrade"); else setError(e.message);
    } finally { setBusy(false); }
  }

  async function ask(event) {
    event.preventDefault(); if (!question.trim()) return;
    const next = [...messages, { role: "user", text: question.trim() }]; setMessages(next); setQuestion(""); setBusy(true); setError("");
    try {
      const endpoint = publicMode ? "/websites/public/ai/help" : "/websites/ai/help";
      const result = await customBackendRequest(endpoint, { method: "POST", body: JSON.stringify({ message: next.at(-1).text, context: { brandName: model.brandName, pages: model.pages?.map(page => ({ title: page.title, sections: page.sections?.map(section => section.type) })) || model.sections?.map(section => section.type), history: next.slice(-8) } }) });
      setMessages([...next, { role: "assistant", text: result.answer }]); if (!publicMode) setStatus(current => ({ ...current, aiHelpFreeUsed: result.aiHelpFreeUsed || current.aiHelpFreeUsed }));
    } catch (e) { if (e.status === 409) setTab("upgrade"); else setError(e.message); }
    finally { setBusy(false); }
  }

  async function upgrade() {
    setBusy(true); setError("");
    try { const result = await customBackendRequest("/payments/paypal/ai-subscriptions", { method: "POST" }); if (!result.approvalUrl) throw new Error("The PayPal approval page is unavailable."); window.location.assign(result.approvalUrl); }
    catch (e) { setError(e.message); setBusy(false); }
  }

  return <div className="ai-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title">
      <header className="ai-header"><div><span className="ai-kicker">GETCYB AI</span><h2 id="ai-title">{publicMode ? "Get help with GETCYB" : "Build your website with AI"}</h2></div><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
      <nav className="ai-tabs" aria-label="AI tools">{!publicMode && <button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>Design for me</button>}<button className={tab === "help" ? "active" : ""} onClick={() => setTab("help")}>Ask for help</button>{!publicMode && !status.aiPremium && (status.freeDesignUsed || status.aiHelpFreeUsed) && <button className={tab === "upgrade" ? "active" : ""} onClick={() => setTab("upgrade")}>Upgrade</button>}</nav>
      {tab === "design" && <>{pendingModel ? <div className="ai-result"><p>Your first draft is ready. Apply it to the editor and keep refining it whenever you like.</p><div className="ai-result-preview"><strong>{pendingModel.brandName}</strong><span>{pendingModel.pages?.[0]?.sections?.map(section => section.title).filter(Boolean).slice(0, 4).join(" · ")}</span></div><div className="ai-actions"><button type="button" className="ai-secondary" onClick={() => setPendingModel(null)}>Try another idea</button><button type="button" className="ai-primary" onClick={() => { onApply(pendingModel); onClose(); }}>Apply design</button></div></div> : <form className="ai-form" onSubmit={design}><p>Tell us what your business does and what you want your website to feel like. GETCYB AI will create a complete first draft in your editor.</p><label htmlFor="ai-prompt">Describe your business</label><textarea id="ai-prompt" rows="5" maxLength={1200} required minLength={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Example: A modern flower shop in Dubai. Soft cream and sage colours, elegant product pages, and a warm story about locally grown flowers."/><small>{status.freeDesignUsed && !status.aiPremium ? "Your free first design has been used. Upgrade for more AI designs." : status.aiPremium ? "AI monthly is active. Generate as many new drafts as you need." : "Your first AI design is free."}</small><button className="ai-primary" disabled={busy}>{busy ? "Creating your draft…" : status.freeDesignUsed && !status.aiPremium ? "Upgrade to create again" : "Create my website"}</button></form>}</>}
      {tab === "help" && <div className="ai-chat"><div className="ai-chat-log">{messages.length ? messages.map((message,index) => <p key={index} className={`ai-message ${message.role}`}>{message.text}</p>) : <p className="ai-chat-intro">{publicMode ? "Ask us about GETCYB, building a website, or getting started. For help with your own account, sign in first." : "Ask how to change colours, add products, create a page, publish your site, or anything else in the editor. Your first help question is free."}</p>}</div><form onSubmit={ask}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={publicMode ? "Ask a question about GETCYB…" : "What do you need help with?"} maxLength={2000}/><button className="ai-primary" disabled={busy}>Send</button></form></div>}
      {tab === "upgrade" && <div className="ai-upgrade"><span className="ai-star">✦</span><h3>Keep creating with GETCYB AI</h3><p>Get more AI website designs and a guide that answers questions while you build.</p><div className="ai-price">{status.monthlyPrice || "Monthly AI plan"}<small>Renews monthly through PayPal. Cancel anytime in your PayPal account.</small></div><button className="ai-primary" type="button" disabled={busy || !status.monthlyPrice} onClick={upgrade}>{busy ? "Opening secure checkout…" : status.monthlyPrice ? "Upgrade monthly" : "Monthly plan setup in progress"}</button></div>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <footer className="ai-footer">{publicMode ? "GETCYB AI can guide you before you create an account." : "AI drafts are editable. Review details and products before publishing."}</footer>
    </section>
  </div>;
}

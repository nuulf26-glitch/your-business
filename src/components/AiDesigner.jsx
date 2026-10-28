import { useState } from "react";
import { customBackendRequest } from "../services/customBackendSession";
import "../styles/aiDesigner.css";

export default function AiDesigner({ model = {}, onApply, onClose, initialTab = "design", publicMode = false }) {
  const [tab, setTab] = useState(initialTab === "help" || publicMode ? "help" : "design");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pendingModel, setPendingModel] = useState(null);

  async function design(event) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await customBackendRequest("/websites/ai/design", { method: "POST", body: JSON.stringify({ prompt }) });
      setPendingModel(result.model);
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  }

  async function ask(event) {
    event.preventDefault(); if (!question.trim()) return;
    const next = [...messages, { role: "user", text: question.trim() }]; setMessages(next); setQuestion(""); setBusy(true); setError("");
    try {
      const endpoint = publicMode ? "/websites/public/ai/help" : "/websites/ai/help";
      const result = await customBackendRequest(endpoint, { method: "POST", body: JSON.stringify({ message: next.at(-1).text, context: { brandName: model.brandName, pages: model.pages?.map(page => ({ title: page.title, sections: page.sections?.map(section => section.type) })) || model.sections?.map(section => section.type), history: next.slice(-8) } }) });
      if (!result.answer?.trim()) throw new Error("AI returned an empty reply. Please try again."); setMessages([...next, { role: "assistant", text: result.answer }]);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  return <div className="ai-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-dialog" role="dialog" aria-modal="true" aria-labelledby="ai-title">
      <header className="ai-header"><div><span className="ai-kicker">GETCYB AI</span><h2 id="ai-title">{publicMode ? "Get help with GETCYB" : "Build your website with AI"}</h2></div><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
      <nav className="ai-tabs" aria-label="AI tools">{!publicMode && <button className={tab === "design" ? "active" : ""} onClick={() => setTab("design")}>Design for me</button>}<button className={tab === "help" ? "active" : ""} onClick={() => setTab("help")}>Ask for help</button></nav>
      {tab === "design" && <>{pendingModel ? <div className="ai-result"><p>Your first draft is ready. Apply it to the editor and keep refining it whenever you like.</p><div className="ai-result-preview"><strong>{pendingModel.brandName}</strong><span>{pendingModel.pages?.[0]?.sections?.map(section => section.title).filter(Boolean).slice(0, 4).join(" · ")}</span></div><div className="ai-actions"><button type="button" className="ai-secondary" onClick={() => setPendingModel(null)}>Try another idea</button><button type="button" className="ai-primary" onClick={() => { onApply(pendingModel); onClose(); }}>Apply design</button></div></div> : <form className="ai-form" onSubmit={design}><p>Tell us what your business does and what you want your website to feel like. GETCYB AI will create a complete first draft in your editor.</p><label htmlFor="ai-prompt">Describe your business</label><textarea id="ai-prompt" rows="5" maxLength={1200} required minLength={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Example: A modern flower shop in Dubai. Soft cream and sage colours, elegant product pages, and a warm story about locally grown flowers."/><small>Describe a new idea whenever you want to create another design.</small><button className="ai-primary" disabled={busy}>{busy ? "Creating your draft…" : "Create my website"}</button></form>}</>}
      {tab === "help" && <div className="ai-chat"><div className="ai-chat-log">{messages.length ? messages.map((message,index) => <p key={index} className={`ai-message ${message.role}`}>{message.text}</p>) : <p className="ai-chat-intro">{publicMode ? "Ask us about GETCYB, building a website, or getting started. For help with your own account, sign in first." : "Ask how to change colours, add products, create a page, publish your site, or anything else in the editor."}</p>}</div><form onSubmit={ask}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={publicMode ? "Ask a question about GETCYB…" : "What do you need help with?"} maxLength={2000}/><button className="ai-primary" disabled={busy}>Send</button></form></div>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <footer className="ai-footer">{publicMode ? "GETCYB AI can guide you before you create an account." : "AI drafts are editable. Review details and products before publishing."}</footer>
    </section>
  </div>;
}

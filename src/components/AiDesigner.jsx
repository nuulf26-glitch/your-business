import { useRef, useState } from "react";
import WebsiteRenderer from "../editor/WebsiteRenderer";
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
  const [pendingSummary, setPendingSummary] = useState("");
  const [previewDevice, setPreviewDevice] = useState("laptop");
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [appliedNotice, setAppliedNotice] = useState("");
  const inFlight = useRef(false);
  const hasExistingWebsite = Boolean(model.pages?.some(page => page.sections?.length) || model.sections?.length);

  async function design(event, mode = "create") {
    event.preventDefault(); if (inFlight.current || !prompt.trim()) return; inFlight.current = true; setBusy(true); setError(""); setAppliedNotice("");
    try {
      const result = await customBackendRequest("/websites/ai/design", { method: "POST", body: JSON.stringify({ prompt: prompt.trim(), mode, ...(mode === "modify" ? { model } : {}) }) });
      setPendingModel(result.model);
      setPendingSummary(result.changesSummary || "A complete editable first draft");
    } catch (e) {
      setError(e.message);
    } finally { inFlight.current = false; setBusy(false); }
  }

  async function ask(event) {
    event.preventDefault(); if (inFlight.current || !question.trim()) return; inFlight.current = true;
    const next = [...messages, { role: "user", text: question.trim() }]; setMessages(next); setBusy(true); setError("");
    try {
      const endpoint = publicMode ? "/websites/public/ai/help" : "/websites/ai/help";
      const result = await customBackendRequest(endpoint, { method: "POST", body: JSON.stringify({ message: next.at(-1).text, context: { brandName: model.brandName, pages: model.pages?.map(page => ({ title: page.title, sections: page.sections?.map(section => section.type) })) || model.sections?.map(section => section.type), history: next.slice(-8) } }) });
      if (!result.answer?.trim()) throw new Error("AI returned an empty reply. Please try again."); setMessages([...next, { role: "assistant", text: result.answer }]); setQuestion("");
    } catch (e) { setError(e.message); setQuestion(next.at(-1).text); }
    finally { inFlight.current = false; setBusy(false); }
  }

  function applyPendingDesign() {
    if (!pendingModel) return;
    if (tab === "design" && hasExistingWebsite && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    onApply(pendingModel);
    setPendingModel(null);
    setPendingSummary("");
    setConfirmOverwrite(false);
    setPrompt("");
    setAppliedNotice("Changes are in your editor as an editable draft. You can ask CYB AI for another change now.");
    if (tab === "design") setTab("edit");
  }

  function cancelPreview() {
    setPendingModel(null);
    setConfirmOverwrite(false);
    onClose();
  }

  return <div className="ai-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="ai-dialog" role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby="ai-title">
      <header className="ai-header"><div><span className="ai-kicker">CYB AI</span><h2 id="ai-title">{publicMode ? "Get help with CYB" : "Create or edit your website with AI"}</h2></div><button type="button" aria-label="Close" onClick={onClose}>×</button></header>
      <nav className="ai-tabs" aria-label="AI tools">{!publicMode && <><button type="button" className={tab === "design" ? "active" : ""} onClick={() => { setTab("design"); setPendingModel(null); setConfirmOverwrite(false); setError(""); }}>Create Website with AI</button><button type="button" className={tab === "edit" ? "active" : ""} onClick={() => { setTab("edit"); setPendingModel(null); setConfirmOverwrite(false); setError(""); }}>Edit Website with AI</button></>}<button type="button" className={tab === "help" ? "active" : ""} onClick={() => { setTab("help"); setPendingModel(null); setConfirmOverwrite(false); setError(""); }}>Ask for help</button></nav>
      {(tab === "design" || tab === "edit") && <>{appliedNotice && <p className="ai-success" role="status">{appliedNotice}</p>}{pendingModel ? <div className="ai-result"><p>{tab === "edit" ? "Preview the proposed edits. Your current website stays unchanged until you apply them." : "Preview your editable first draft before applying it to the editor."}</p><div className="ai-result-preview"><strong>{pendingModel.brandName}</strong><span>{pendingSummary || pendingModel.pages?.[0]?.sections?.map(section => section.title).filter(Boolean).slice(0, 4).join(" · ")}</span></div><div className="ai-preview-devices" role="group" aria-label="Preview size">{["laptop", "ipad", "phone"].map(device => <button type="button" key={device} className={previewDevice === device ? "active" : ""} onClick={() => setPreviewDevice(device)}>{device === "ipad" ? "Tablet" : device === "phone" ? "Mobile" : "Desktop"}</button>)}</div><div className={`ai-visual-preview ${previewDevice}`}><WebsiteRenderer model={pendingModel} device={previewDevice} /></div>{confirmOverwrite && <p className="ai-confirm" role="alert">This will replace the current website draft in your editor. Confirm only if you want to replace it.</p>}<div className="ai-actions">{confirmOverwrite ? <><button type="button" className="ai-secondary" onClick={() => setConfirmOverwrite(false)}>Keep current website</button><button type="button" className="ai-primary" onClick={applyPendingDesign}>Confirm replacement</button></> : <><button type="button" className="ai-secondary" onClick={() => setPendingModel(null)}>Try another prompt</button><button type="button" className="ai-secondary" onClick={cancelPreview}>Cancel</button><button type="button" className="ai-primary" onClick={applyPendingDesign}>{tab === "edit" ? "Apply changes" : hasExistingWebsite ? "Replace website…" : "Apply design"}</button></>}</div></div> : <form className="ai-form" onSubmit={event => design(event, tab === "edit" ? "modify" : "create")}><p>{tab === "edit" ? "Describe a change in plain language. CYB AI will prepare an editable update and preserve the rest of your website." : "Describe your business and the website you want. CYB AI will create an editable first draft."}</p><label htmlFor="ai-prompt">{tab === "edit" ? "What should I change?" : "Describe your website"}</label><textarea id="ai-prompt" rows="5" maxLength={1200} required minLength={8} value={prompt} onChange={event => setPrompt(event.target.value)} placeholder={tab === "edit" ? "Example: Make the background black, make the main heading larger, and move the story section above the products." : "Example: Create a luxury skincare website with beige colours, a hero, product gallery, testimonials, and contact form."}/><small>{tab === "edit" ? "You can ask for another change after this one." : "You can keep editing the result in the visual editor."}</small><button className="ai-primary" disabled={busy || prompt.trim().length < 8}>{busy ? <><span className="ai-spinner" aria-hidden="true" />{tab === "edit" ? "Preparing your changes…" : "Creating your draft…"}</> : (tab === "edit" ? "Preview changes" : "Create my website")}</button></form>}</>}
      {tab === "help" && <div className="ai-chat"><div className="ai-chat-log">{messages.length ? messages.map((message,index) => <p key={index} className={`ai-message ${message.role}`}>{message.text}</p>) : <p className="ai-chat-intro">{publicMode ? "Ask us about CYB, building a website, or getting started. For help with your own account, sign in first." : "Ask how to change colours, add products, create a page, publish your site, or anything else in the editor."}</p>}</div><form onSubmit={ask}><input value={question} onChange={event => setQuestion(event.target.value)} placeholder={publicMode ? "Ask a question about CYB…" : "What do you need help with?"} maxLength={2000} disabled={busy}/><button className="ai-primary" disabled={busy || !question.trim()}>{busy ? <><span className="ai-spinner" aria-hidden="true"/>Sending…</> : "Send"}</button></form></div>}
      {error && <p className="ai-error" role="alert">{error}</p>}
      <footer className="ai-footer">{publicMode ? "CYB AI can guide you before you create an account." : "AI drafts are editable. Review the result before publishing."}</footer>
    </section>
  </div>;
}

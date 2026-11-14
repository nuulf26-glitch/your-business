import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/design-proposals.css";
import { EmptyState, StatusBadge } from "../components/ui/DesignPrimitives";

const proposalGroups = [
  { id: "public", label: "Public pages", items: ["About CYB", "Contact"] },
  { id: "workspace", label: "Workspace", items: ["Project management", "Notifications"] },
  { id: "commerce", label: "Commerce", items: ["Discounts"] },
  { id: "business", label: "Business tools", items: ["Marketing", "Domains", "CMS", "Blog"] },
  { id: "advanced", label: "Advanced concepts", items: ["Memberships", "Courses", "Community", "Unified Inbox", "Customer Support", "AI Support", "AI Operations", "AI Credits", "Project Wallets", "Recovery Center", "Reliability Center"] },
];

function ScreenContent({ title, group }) {
  if (title === "About CYB") {
    return <div className="proposal-about"><span className="proposal-kicker">A calmer way to build</span><h2>Bring your business online<br /><em>with clarity.</em></h2><p>Proposed brand story layout. The final CYB story and company details need your approval.</p><div className="proposal-values"><article><span>01</span><strong>Make it simple</strong><p>Proposed story block</p></article><article><span>02</span><strong>Keep it yours</strong><p>Proposed story block</p></article><article><span>03</span><strong>Grow with confidence</strong><p>Proposed story block</p></article></div></div>;
  }
  if (title === "Contact") {
    return <div className="proposal-contact"><div><span className="proposal-kicker">We’re here to help</span><h2>Let’s talk about<br /><em>your next step.</em></h2><p>Proposed contact page. Recipient, response expectations and form handling await approval.</p><div className="proposal-contact-note">Contact details will appear here after approval.</div></div><form onSubmit={event => event.preventDefault()}><label>Name<input disabled placeholder="Your name" /></label><label>Email<input disabled placeholder="name@example.com" /></label><label>How can we help?<textarea disabled rows="4" placeholder="Tell us a little about it" /></label><button type="button" disabled>Preview only</button></form></div>;
  }
  const hint = group === "advanced" ? "The workflow, roles and data handling for this feature are not yet approved." : "The product requirements and available actions need approval before this screen becomes operational.";
  return <div className="proposal-empty"><EmptyState title={title} description={hint} /><div className="proposal-action-row"><button type="button" disabled>Primary action</button><button type="button" disabled>Secondary action</button></div><div className="proposal-placeholder-table" aria-label="Example layout only"><div><span>Workspace section</span><span>Design placeholder</span><span>Status</span></div><div className="proposal-table-empty"><strong>No connected data</strong><span>Items and actions will appear after the design and requirements are approved.</span></div></div></div>;
}

export default function DesignProposals() {
  const [groupId, setGroupId] = useState("public");
  const [screenTitle, setScreenTitle] = useState("About CYB");
  const group = useMemo(() => proposalGroups.find(item => item.id === groupId) || proposalGroups[0], [groupId]);
  return <main className="proposal-workspace">
    <aside className="proposal-sidebar"><Link className="proposal-brand" to="/">CYB<span>STUDIO</span></Link><p className="proposal-sidebar-note">Visual concepts for features with unrecovered requirements.</p>{proposalGroups.map(section => <section key={section.id}><span className="proposal-nav-label">{section.label}</span>{section.items.map(item => <button key={item} type="button" className={item === screenTitle ? "active" : ""} onClick={() => { setGroupId(section.id); setScreenTitle(item); }}>{item}</button>)}</section>)}<Link className="proposal-back" to="/">← Back to CYB</Link></aside>
    <section className="proposal-main"><header className="proposal-topbar"><div><span>DESIGN REVIEW · ISOLATED PREVIEW</span><h1>{screenTitle}</h1></div><StatusBadge tone="warning">PROPOSED · APPROVAL REQUIRED</StatusBadge></header><div className="proposal-canvas"><div className="proposal-canvas-meta"><span>{group.label}</span><span>Preview only · no operational data</span></div><ScreenContent title={screenTitle} group={groupId} /></div></section>
  </main>;
}

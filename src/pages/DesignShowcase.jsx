import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import "./design-showcase.css";

const groups = [
  { id: "public", label: "Public website", items: ["Homepage", "Features", "Pricing", "Templates", "About", "Contact", "Login", "Signup", "Forgot Password", "Reset Password"] },
  { id: "dashboard", label: "Dashboard", items: ["Dashboard overview", "Projects", "Project creation", "Website management", "Notifications", "Settings"] },
  { id: "builder", label: "Website builder", items: ["Editor", "Elements", "Pages", "Layers", "Media library", "Brand Kit", "Responsive preview", "Save & publish"] },
  { id: "commerce", label: "Online store", items: ["Store overview", "Products", "Product editor", "Inventory", "Orders", "Order details", "Customers", "Shipping", "Discounts", "Store designer", "Storefront", "Product detail", "Cart", "Checkout", "Order confirmation"] },
  { id: "business", label: "Business tools", items: ["CRM", "Customer profile", "Analytics", "Reports", "Forms", "Bookings", "Marketing", "SEO", "Domains", "CMS", "Blog"] },
  { id: "advanced", label: "Advanced proposals", items: ["Memberships", "Courses", "Student Portal", "Community", "Unified Inbox", "Customer Support", "AI Support", "AI Operations", "AI Credits", "Project Wallets", "Recovery Center", "Reliability Center"] },
];

const proposalScreens = new Set(["Projects", "Notifications", "Discounts", "CRM", "Reports", "Forms", "Bookings", "Marketing", "SEO", "Domains", "CMS", "Blog", "Memberships", "Courses", "Student Portal", "Community", "Unified Inbox", "Customer Support", "AI Support", "AI Operations", "AI Credits", "Project Wallets", "Recovery Center", "Reliability Center"]);
const fixtureScreens = new Set(["Dashboard overview", "Products", "Product editor", "Inventory", "Orders", "Order details", "Customers", "Customer profile", "Analytics", "Store overview", "Storefront", "Product detail", "Cart", "Checkout", "Order confirmation"]);
const descriptions = {
  Homepage: "The approved CYB public direction, shown as a contained preview.",
  Features: "A public feature story using the existing CYB voice and visual language.",
  Pricing: "The existing pricing presentation, isolated from payment actions.",
  Templates: "Template discovery using the two current template families.",
  About: "A visual story about CYB, presented as an isolated concept.",
  Contact: "A considered contact page layout. Submissions are disabled.",
  Login: "Authentication screen styling only. This preview cannot sign in.",
  Signup: "Account creation visual only. No account is created here.",
  "Forgot Password": "Password recovery layout only. No email is sent.",
  "Reset Password": "Password reset layout only. No credentials are submitted.",
  "Dashboard overview": "A dashboard composition with synthetic preview fixtures only.",
  Projects: "Proposal: project switching and lifecycle rules require product approval.",
  "Project creation": "Existing project setup structure shown without submitting data.",
  "Website management": "A contained overview of draft and published site controls.",
  Notifications: "Proposal: delivery rules and notification types require approval.",
  Settings: "Account preferences visual only. No settings are saved.",
  Editor: "Dark editor workspace with a preview canvas and non-operational controls.",
  Elements: "Editor insert panel composition, shown independently from editor state.",
  Pages: "Page organization concept with a clear, isolated preview label.",
  Layers: "Layer hierarchy concept for the builder workspace.",
  "Media library": "Media browsing concept. Files are illustrative blocks, not stored assets.",
  "Brand Kit": "Brand tokens and identity controls, presented as a design concept.",
  "Responsive preview": "The editor's desktop, tablet and mobile controls as a visual preview.",
  "Save & publish": "Draft and publishing status composition. No save or publish occurs.",
  "Store overview": "Illustrative store dashboard fixtures, not account or financial data.",
  Products: "A synthetic catalog layout for visual review only.",
  "Product editor": "Product editing form layout. Changes are not persisted.",
  Inventory: "Synthetic inventory presentation with no connection to stock records.",
  Orders: "Synthetic order table. No customer or order records are accessed.",
  "Order details": "Illustrative order detail structure without payment processing.",
  Customers: "Synthetic customer rows, shown only inside this isolated showcase.",
  Shipping: "Shipping settings visual. Provider and rate rules remain unconfigured.",
  Discounts: "Proposal: discount eligibility and stacking rules need approval.",
  "Store designer": "Store theme controls, separate from live storefront settings.",
  Storefront: "A synthetic storefront composition with sample products and labels.",
  "Product detail": "A synthetic product detail layout. Cart actions are disabled.",
  Cart: "Illustrative cart contents. No basket or checkout state is created.",
  Checkout: "Checkout layout only; no payment fields transmit or process data.",
  "Order confirmation": "Visual confirmation state using an illustrative order reference.",
  CRM: "Proposal: contact sources, consent and lifecycle stages need approval.",
  "Customer profile": "Synthetic profile layout with clearly labeled example details.",
  Analytics: "Illustrative metrics. Values in this screen are not CYB account data.",
  Reports: "Proposal: report definitions, sharing and exports need approval.",
  Forms: "Proposal: form submission and retention behavior need approval.",
  Bookings: "Proposal: availability, cancellations and reminders need approval.",
  Marketing: "Proposal: consent, campaigns and unsubscribe behavior need approval.",
  SEO: "Proposal: indexing, metadata and technical defaults need approval.",
  Domains: "Proposal: provider, verification and DNS workflows need approval.",
  CMS: "Proposal: content types, roles and publishing workflow need approval.",
  Blog: "Proposal: editorial workflow and publishing rules need approval.",
  Memberships: "Proposal: access, entitlements and billing rules need approval.",
  Courses: "Proposal: curriculum and enrollment rules need approval.",
  "Student Portal": "Proposal: learner access, progress and completion rules need approval.",
  Community: "Proposal: privacy and moderation rules need approval.",
  "Unified Inbox": "Proposal: channel routing and message ownership need approval.",
  "Customer Support": "Proposal: ticket states, roles and history need approval.",
  "AI Support": "Proposal: operating modes and escalation rules need approval.",
  "AI Operations": "Proposal: approvals, audit history and cost controls need approval.",
  "AI Credits": "Proposal: allocation, expiry and pricing need approval.",
  "Project Wallets": "Proposal: ownership, transfers and reconciliation need approval.",
  "Recovery Center": "Proposal: restore scope and data integrity rules need approval.",
  "Reliability Center": "Proposal: severity, metrics and operator roles need approval.",
};

function Icon({ name = "grid" }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    window: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M3 9h5"/></>,
    bag: <><path d="M5 8h14l-1 12H6L5 8Z"/><path d="M9 9V6a3 3 0 0 1 6 0v3"/></>,
    chart: <><path d="M4 19V5M4 19h17"/><path d="m7 15 4-4 3 2 6-7"/></>,
    person: <><circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/></>,
    sparkle: <><path d="m12 3 1.7 5.3L19 10l-5.3 1.7L12 17l-1.7-5.3L5 10l5.3-1.7L12 3Z"/><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/></>,
  };
  return <svg className="cyb-showcase-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

function Kpi({ label, value, change = "Illustrative" }) {
  return <article className="showcase-kpi"><span>{label}</span><strong>{value}</strong><small>{change}</small></article>;
}

function Badge({ children, kind = "neutral" }) { return <span className={`showcase-badge ${kind}`}>{children}</span>; }

function TablePreview({ headings, rows, emptyCopy = "No records are included in this visual fixture." }) {
  return <div className="showcase-table-scroll"><table className="showcase-table"><thead><tr>{headings.map((item) => <th key={item}>{item}</th>)}</tr></thead><tbody>{rows?.length ? rows.map((row, index) => <tr key={`${row[0]}-${index}`}>{row.map((cell, i) => <td key={`${cell}-${i}`}>{i === row.length - 1 ? <Badge kind={index % 2 ? "neutral" : "soft"}>{cell}</Badge> : cell}</td>)}</tr>) : <tr><td colSpan={headings.length} className="showcase-table-empty">{emptyCopy}</td></tr>}</tbody></table></div>;
}

function PageTitle({ screen, proposal }) {
  return <div className="showcase-page-title"><div><div className="showcase-eyebrow">CYB DESIGN REVIEW / {proposal ? "PROPOSAL" : "INTERFACE"}</div><h2>{screen}</h2><p>{descriptions[screen]}</p></div><Badge kind={proposal ? "proposal" : "preview"}>{proposal ? "Proposal · approval required" : "Visual preview"}</Badge></div>;
}

function SectionCard({ title, extra, children, className = "" }) {
  return <section className={`showcase-card ${className}`}><div className="showcase-card-head"><h3>{title}</h3>{extra && <span>{extra}</span>}</div>{children}</section>;
}

function EmptyPanel({ title = "Nothing here yet", copy = "This state is included for visual review only." }) {
  return <div className="showcase-empty"><span className="empty-orbit" aria-hidden="true">✳</span><strong>{title}</strong><p>{copy}</p></div>;
}

function LoadingPanel() {
  return <div className="showcase-loading" role="status" aria-label="Illustrative loading state"><span/><span/><span/><span/><i>Illustrative loading state</i></div>;
}

function ErrorPanel() {
  return <div className="showcase-error" role="status"><strong>Preview state: unable to load</strong><p>This error appearance is synthetic. No request was sent and nothing needs retrying.</p><button type="button" disabled>Retry preview</button></div>;
}

function SampleLabel() { return <div className="showcase-fixture-note"><Icon name="sparkle"/><span><strong>Isolated design fixture.</strong> Every example record, value and state here is synthetic; this showcase has no API, account or database access.</span></div>; }

function ScreenContent({ screen, state }) {
  if (state === "empty") return <EmptyPanel title={`No ${screen.toLowerCase()} to display`} copy="Purpose-built empty state preview. No real account data is used."/>;
  if (state === "loading") return <LoadingPanel/>;
  if (state === "error") return <ErrorPanel/>;

  if (["Homepage", "Features", "Pricing", "Templates", "About", "Contact"].includes(screen)) return <PublicPreview screen={screen}/>;
  if (["Login", "Signup", "Forgot Password", "Reset Password"].includes(screen)) return <AuthPreview screen={screen}/>;
  if (["Editor", "Elements", "Pages", "Layers", "Media library", "Brand Kit", "Responsive preview", "Save & publish"].includes(screen)) return <WorkspacePreview screen={screen}/>;
  if (["Storefront", "Product detail", "Cart", "Checkout", "Order confirmation"].includes(screen)) return <CustomerPreview screen={screen}/>;
  if (["Dashboard overview", "Store overview"].includes(screen)) return <OverviewPreview screen={screen}/>;
  if (["Projects", "Notifications", "Discounts", "CRM", "Reports", "Forms", "Bookings", "Marketing", "SEO", "Domains", "CMS", "Blog", "Memberships", "Courses", "Student Portal", "Community", "Unified Inbox", "Customer Support", "AI Support", "AI Operations", "AI Credits", "Project Wallets", "Recovery Center", "Reliability Center"].includes(screen)) return <ProposalPreview screen={screen}/>;
  if (["Dashboard overview", "Products", "Product editor", "Inventory", "Orders", "Order details", "Customers", "Customer profile", "Analytics"].includes(screen)) return <RecordsPreview screen={screen}/>;
  return <WorkspacePreview screen={screen}/>;
}

function PublicPreview({ screen }) {
  const data = {
    Homepage: ["A thoughtful home for your business", "Design, manage and grow with CYB", "Explore the platform"],
    Features: ["Everything you need to get online", "Build your website, then run your business", "Explore features"],
    Pricing: ["One clear way to get started", "Build first. Decide when you are ready.", "View plan details"],
    Templates: ["Find your starting point", "Choose a layout and make it yours.", "Browse template concepts"],
    About: ["A little more room to build", "A considered home for ambitious ideas", "Meet CYB"],
    Contact: ["We would love to hear from you", "Thoughtful support for your next step", "Send a message"],
  }[screen];
  return <div className="showcase-public"><div className="public-top"><b>CYB</b><nav><span>Platform</span><span>Templates</span><span>Pricing</span></nav><Badge>Public preview</Badge></div><div className="public-hero"><span className="showcase-eyebrow">A CALMER WAY TO BUILD</span><h1>{data[0]}<br/><em>{data[1]}</em></h1><p>Warm, clear tools for creating and managing your online business.</p><div className="public-actions"><button disabled>{data[2]}</button><button disabled className="secondary">See how it works</button></div><small>Sample concept — CTAs are intentionally inactive in this showcase.</small></div><div className="public-feature-row">{["Website builder", "Store management", "Business tools"].map((item, i)=><article key={item}><small>0{i+1}</small><strong>{item}</strong><p>Designed to feel simple, clear and consistent.</p></article>)}</div></div>;
}

function AuthPreview({ screen }) {
  const signup = screen === "Signup";
  const forgot = screen === "Forgot Password";
  const reset = screen === "Reset Password";
  const title = signup ? "Create your account" : forgot ? "Reset your password" : reset ? "Choose a new password" : "Welcome back";
  return <div className="showcase-auth"><section className="auth-story"><b>CYB</b><span>WELCOME {signup ? "TO CYB" : "BACK"}</span><h1>{signup ? "Start with a clear idea." : "Manage your business from one place."}</h1><p>Everything your business needs in one carefully considered space.</p><div className="auth-story-steps"><span>01&nbsp; Your website</span><span>02&nbsp; Your store</span><span>03&nbsp; Your growth</span></div></section><section className="auth-form-wrap"><div className="auth-form"><span className="showcase-eyebrow">{signup ? "CREATE ACCOUNT" : forgot ? "ACCOUNT RECOVERY" : reset ? "NEW PASSWORD" : "LOG IN"}</span><h2>{title}</h2><p>{forgot ? "Enter your email address and we will show the recovery confirmation state." : reset ? "Set a new password for your account." : signup ? "A quiet, simple beginning for your business." : "Enter your details to continue to your workspace."}</p>{signup && <label>Full name<input disabled placeholder="Your name"/></label>}<label>Email address<input disabled placeholder="name@example.com"/></label>{!forgot && <label>Password<input disabled placeholder="Enter a password" type="password"/></label>}{reset && <label>Confirm password<input disabled placeholder="Confirm password" type="password"/></label>}<button disabled className="auth-submit">{signup ? "Create account" : forgot ? "Send recovery link" : reset ? "Update password" : "Log in"}</button><small>Non-functional visual preview · no data is collected</small></div></section></div>;
}

function OverviewPreview({ screen }) {
  const store = screen === "Store overview";
  return <><div className="showcase-kpis"><Kpi label={store ? "Products" : "Websites"} value="—"/><Kpi label={store ? "Orders" : "Recent activity"} value="—"/><Kpi label="Setup" value="In progress"/></div><div className="showcase-two-col"><SectionCard title={store ? "Store at a glance" : "Your workspace"} extra="Synthetic fixture"><div className="showcase-quick-grid">{(store ? ["Catalog", "Orders", "Customers", "Store design"] : ["Edit your website", "Manage products", "View business", "Account settings"]).map((x,i)=><button type="button" disabled className="showcase-quick" key={x}><span>0{i+1}</span><strong>{x}</strong><small>Preview navigation</small></button>)}</div></SectionCard><SectionCard title="Recent activity" extra="Example state"><EmptyPanel title="Your activity will appear here" copy="This fixture intentionally contains no account history."/></SectionCard></div></>;
}

function RecordsPreview({ screen }) {
  const configs = {
    Products: { heading: ["Products", "Inventory", "Price", "Status"], rows: [["Sample product A", "12", "AED 80", "Draft"], ["Sample product B", "—", "AED 120", "Active"]], title: "Product catalog" },
    "Product editor": { title: "Product details", fields: ["Product name", "Description", "Price", "Inventory", "Media"] },
    Inventory: { heading: ["Item", "SKU", "On hand", "Status"], rows: [["Sample product A", "DEMO-001", "12", "In stock"], ["Sample product B", "DEMO-002", "—", "Needs review"]], title: "Inventory overview" },
    Orders: { heading: ["Order", "Date", "Items", "Status"], rows: [["DEMO-1001", "Sample date", "2 items", "Processing"], ["DEMO-1002", "Sample date", "1 item", "Pending"]], title: "Orders" },
    "Order details": { title: "Order detail", fields: ["Order summary", "Fulfillment", "Payment status", "Shipping address"] },
    Customers: { heading: ["Customer", "Orders", "Last activity", "Status"], rows: [["Sample customer A", "—", "Sample date", "New"], ["Sample customer B", "—", "Sample date", "Returning"]], title: "Customers" },
    "Customer profile": { title: "Customer profile", fields: ["Profile overview", "Contact preferences", "Order history", "Notes"] },
    Analytics: { title: "Business analytics", fields: ["Performance summary", "Traffic overview", "Product activity", "Reporting period"] },
  }[screen];
  if (configs.fields) return <div className="showcase-two-col"><SectionCard title={configs.title} extra="Illustrative layout"><div className="showcase-form-grid">{configs.fields.map((field)=><label key={field}>{field}<input disabled placeholder="Sample field"/></label>)}</div><button disabled className="showcase-dark-button">Save preview</button></SectionCard><SectionCard title="Supporting details"><EmptyPanel title="No connected data" copy="This isolated preview does not load a real product, order or customer."/></SectionCard></div>;
  return <SectionCard title={configs.title} extra="Synthetic records"><div className="showcase-toolbar"><input disabled placeholder="Search preview records"/><button disabled>Filter</button><button disabled className="showcase-dark-button">Create preview</button></div><TablePreview headings={configs.heading} rows={configs.rows}/></SectionCard>;
}

function WorkspacePreview({ screen }) {
  const fields = {
    "Project creation": ["Business name", "Website type", "Brand direction", "Starting template"],
    "Website management": ["Website status", "Draft activity", "Published version", "Domain"],
    Settings: ["Business profile", "Preferences", "Team access", "Security"],
    Shipping: ["Shipping zones", "Delivery methods", "Handling time", "Fulfillment notes"],
    "Store designer": ["Theme", "Typography", "Colors", "Store layout"],
  }[screen];
  if (fields) return <div className="showcase-two-col"><SectionCard title={screen} extra="Visual only"><div className="showcase-form-grid">{fields.map((field)=><label key={field}>{field}<input disabled placeholder="Preview field"/></label>)}</div><button disabled className="showcase-dark-button">Apply preview</button></SectionCard><SectionCard title="Preview notes"><EmptyPanel title="Changes are not saved" copy="This screen is isolated from functional CYB settings."/></SectionCard></div>;
  const editor = screen === "Editor" || screen === "Elements" || screen === "Pages" || screen === "Layers" || screen === "Media library" || screen === "Brand Kit" || screen === "Responsive preview" || screen === "Save & publish";
  return <div className={`showcase-workspace ${editor ? "editor-workspace" : ""}`}><aside className="showcase-panel-nav"><span>{editor ? "BUILDER" : "WORKSPACE"}</span>{(editor ? ["Elements", "Pages", "Layers", "Media", "Brand Kit"] : ["Overview", "Projects", "Websites", "Settings"]).map((item,i)=><div className={item.toLowerCase().includes(screen.toLowerCase().split(" ")[0]) ? "active" : ""} key={item}><small>0{i+1}</small>{item}</div>)}</aside><section className="showcase-work-area"><div className="work-area-head"><div><span className="showcase-eyebrow">{editor ? "WEBSITE EDITOR" : "SITE MANAGER"}</span><strong>{editor ? "Sample website" : "Workspace overview"}</strong></div><Badge>Preview only</Badge></div>{editor ? <><div className="editor-mock-tools">{["Desktop", "Tablet", "Mobile", "Undo", "Redo"].map((item)=><button disabled key={item}>{item}</button>)}</div><div className="editor-mock-canvas"><div className="editor-mock-site"><div className="mock-site-nav">YOUR BRAND <span>Home&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span></div><div className="mock-site-hero"><small>NEW COLLECTION</small><strong>Make space<br/>for your next idea.</strong><p>Layout preview — no website data loaded.</p><button disabled>Discover</button></div><div className="mock-site-cards"><i/><i/><i/></div></div></div><div className="editor-mock-footer">Draft preview · save and publish controls are inactive</div></> : <div className="showcase-quick-grid">{["Create a website", "Manage products", "Review orders", "Explore business tools"].map((item,i)=><button className="showcase-quick" disabled key={item}><span>0{i+1}</span><strong>{item}</strong><small>Concept entry point</small></button>)}</div>}</section>{editor && <aside className="showcase-properties"><span>PROPERTIES</span>{["Typography", "Color", "Spacing", "Position"].map((item)=><div key={item}>{item}<small>Choose a value</small></div>)}</aside>}</div>;
}

function CustomerPreview({ screen }) {
  return <div className="showcase-customer"><div className="customer-site-nav"><b>ATELIER / DEMO</b><span>Shop&nbsp;&nbsp; About&nbsp;&nbsp; Contact</span><small>Preview storefront</small></div>{screen === "Cart" ? <div className="customer-cart"><div><span className="showcase-eyebrow">YOUR SELECTION</span><h3>Your cart</h3><EmptyPanel title="Sample cart item" copy="Illustrative cart line only. No cart or checkout session is created."/></div><SectionCard title="Order summary"><div className="cart-summary-row"><span>Sample subtotal</span><strong>Illustrative</strong></div><div className="cart-summary-row"><span>Shipping</span><strong>Calculated later</strong></div><button disabled className="showcase-dark-button">Continue preview</button></SectionCard></div> : <div className="customer-product"><div className="product-visual"><div className="product-art"><span>CYB</span></div></div><div className="product-copy"><span className="showcase-eyebrow">SAMPLE COLLECTION</span><h2>{screen === "Order confirmation" ? "Thank you for exploring." : screen === "Checkout" ? "Review your details." : "A considered everyday essential."}</h2><p>Illustrative storefront copy for design review. No payment or personal information is collected.</p><Badge kind="fixture">Synthetic content</Badge><div className="customer-product-lines"><span>Material <b>Preview</b></span><span>Availability <b>Illustrative</b></span><span>Price <b>Sample only</b></span></div><button disabled className="showcase-dark-button">{screen === "Checkout" ? "Continue preview" : screen === "Order confirmation" ? "Back to store preview" : "Add to cart preview"}</button><small>Actions are disabled in this isolated design showcase.</small></div></div>}</div>;
}

function ProposalPreview({ screen }) {
  const content = {
    Projects: ["A calmer workspace for every project", ["Project space", "Website draft", "Brand assets"]],
    Notifications: ["Stay up to date, at your pace", ["Workspace updates", "Website activity", "Account notices"]],
    Discounts: ["Thoughtful promotions, clearly managed", ["Offer setup", "Eligibility rules", "Schedule"]],
    CRM: ["Customer relationships, with context", ["Contact directory", "Relationship stages", "Follow-up notes"]],
    Reports: ["The right view for every decision", ["Report builder", "Saved views", "Export controls"]],
    Forms: ["Capture information with care", ["Form builder", "Submission review", "Consent & retention"]],
    Bookings: ["Make time for what matters", ["Availability", "Booking review", "Customer reminders"]],
    Marketing: ["A considered approach to growth", ["Campaigns", "Audience consent", "Preferences"]],
    SEO: ["Make every page easy to understand", ["Page metadata", "Indexing review", "Technical details"]],
    Domains: ["Bring your brand to your own address", ["Domain connection", "Ownership checks", "Launch readiness"]],
    CMS: ["Shape your content library", ["Collections", "Content fields", "Publishing workflow"]],
    Blog: ["A clear place for your stories", ["Editorial calendar", "Draft review", "Publishing status"]],
    Memberships: ["Create a place for your members", ["Access plans", "Member experience", "Entitlements"]],
    Courses: ["A thoughtful learning experience", ["Course outline", "Lesson library", "Enrollment rules"]],
    "Student Portal": ["Learning, in one calm space", ["Course navigation", "Progress state", "Resources"]],
    Community: ["A welcoming space for your community", ["Member directory", "Discussion spaces", "Moderation"]],
    "Unified Inbox": ["Conversations, in one view", ["Channel list", "Conversation detail", "Reply composer"]],
    "Customer Support": ["Support with clarity and context", ["Ticket queue", "Case detail", "Support policies"]],
    "AI Support": ["A thoughtful assistant, under your control", ["Intent preview", "Escalation rules", "Human handoff"]],
    "AI Operations": ["Keep automation transparent", ["Run approvals", "Activity history", "Cost controls"]],
    "AI Credits": ["Understand usage before it happens", ["Allocation model", "Usage history", "Owner controls"]],
    "Project Wallets": ["Project funds, clearly attributed", ["Wallet overview", "Activity ledger", "Transfer controls"]],
    "Recovery Center": ["A clear path back to a safe state", ["Recovery points", "Restore review", "Owner confirmation"]],
    "Reliability Center": ["Know what needs attention", ["Service health", "Incident review", "Operator roles"]],
  }[screen] || [screen, ["Overview", "Details", "Settings"]];
  return <div className="showcase-proposal-layout"><div className="proposal-callout"><strong>Proposed interface · approval required</strong><span>Requirements are not fully recovered. This concept has no live records, operational actions, or connected workflows.</span></div><div className="proposal-hero"><div><span className="showcase-eyebrow">A CYB DESIGN CONCEPT</span><h3>{content[0]}</h3><p>{descriptions[screen]}</p><button disabled>Action preview · inactive</button></div><div className="proposal-orb" aria-hidden="true"><Icon name="sparkle"/></div></div><div className="proposal-feature-grid">{content[1].map((item,i)=><article key={item}><span>0{i+1}</span><strong>{item}</strong><p>Proposed structure · awaiting product decisions</p></article>)}</div><div className="showcase-two-col"><SectionCard title={`${screen} workspace`} extra="Isolated concept"><EmptyPanel title="No records in this proposal" copy="Synthetic design structure only. Nothing is connected or saved."/></SectionCard><SectionCard title="Decisions to resolve"><ul className="proposal-decision-list">{["Roles and permissions", "Data sources and retention", "Primary workflow and edge states"].map((x)=><li key={x}>{x}<Badge kind="proposal">Approval needed</Badge></li>)}</ul></SectionCard></div></div>;
}

export default function DesignShowcase() {
  const [params, setParams] = useSearchParams();
  const initialScreen = params.get("screen") || "Homepage";
  const [screen, setScreen] = useState(groups.flatMap((g) => g.items).includes(initialScreen) ? initialScreen : "Homepage");
  const [state, setState] = useState("overview");
  const [search, setSearch] = useState("");
  const allScreens = useMemo(() => groups.flatMap((group) => group.items.map((item) => ({ item, group }))), []);
  const selectScreen = (next) => { setScreen(next); setState("overview"); setParams({ screen: next }); };
  const filteredGroups = groups.map((group) => ({ ...group, items: group.items.filter((item) => item.toLowerCase().includes(search.toLowerCase())) })).filter((group) => group.items.length);
  const proposal = proposalScreens.has(screen);
  const fixture = fixtureScreens.has(screen);
  return <div className="design-showcase">
    <a className="showcase-skip" href="#showcase-content">Skip to screen preview</a>
    <aside className="showcase-sidebar"><Link className="showcase-brand" to="/"><span>CYB</span><small>DESIGN REVIEW</small></Link><div className="showcase-sidebar-label">ISOLATED VISUAL SHOWCASE</div><p className="showcase-sidebar-copy">Review every planned interface without signing into a CYB account.</p><label className="showcase-search"><span aria-hidden="true">⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a screen" aria-label="Find a screen"/></label><nav className="showcase-screen-nav" aria-label="All design screens">{filteredGroups.map((group) => <section key={group.id}><h2>{group.label}</h2>{group.items.map((item) => <button type="button" key={item} className={screen === item ? "selected" : ""} aria-current={screen === item ? "page" : undefined} onClick={() => selectScreen(item)}>{item}</button>)}</section>)}</nav><div className="showcase-sidebar-foot"><span className="live-dot"/> No API · no account · no database</div></aside>
    <main className="showcase-main" id="showcase-content"><header className="showcase-topbar"><div><span className="showcase-overline">CYB / PHASE 1</span><strong>Visual design review</strong></div><div className="showcase-top-actions"><Badge kind="fixture">Synthetic fixtures only</Badge><Link to="/design-proposals">Proposal gallery ↗</Link></div></header><SampleLabel/><PageTitle screen={screen} proposal={proposal}/><div className="showcase-state-tabs" role="tablist" aria-label="Preview screen state">{[["overview", "Screen"], ["empty", "Empty state"], ["loading", "Loading state"], ["error", "Error state"]].map(([id,label])=><button role="tab" aria-selected={state === id} className={state === id ? "selected" : ""} type="button" key={id} onClick={() => setState(id)}>{label}</button>)}</div><div className="showcase-screen-stage"><div className="showcase-stage-meta"><span><Icon name="window"/> {screen}</span><span>{proposal ? "Proposal preview" : fixture ? "Synthetic fixture" : "Visual preview"}</span></div><div className="showcase-screen-body"><ScreenContent screen={screen} state={state}/></div></div><footer className="showcase-footer"><span>CYB DESIGN REVIEW · {allScreens.length} SCREENS</span><span>Interactions are inactive in this isolated showcase.</span></footer></main>
  </div>;
}

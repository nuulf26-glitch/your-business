import { useState } from "react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../components/ui/DesignPrimitives";
import "../styles/design-proposals.css";

const sections = [
  { id: "public", label: "Public pages", items: ["About CYB", "Contact"] },
  { id: "workspace", label: "Workspace", items: ["Project management", "Notifications"] },
  { id: "commerce", label: "Commerce", items: ["Discounts"] },
  { id: "business", label: "Business tools", items: ["CRM", "Analytics", "Reports", "Forms", "Bookings", "Marketing", "SEO", "Domains", "CMS", "Blog"] },
  { id: "advanced", label: "Advanced features", items: ["Memberships", "Courses", "Student Portal", "Community", "Unified Inbox", "Customer Support", "AI Support", "AI Operations", "AI Credits", "Project Wallets", "Recovery Center", "Reliability Center"] },
];

function PreviewHeading({ kicker, title, copy, action }) {
  return <div className="concept-heading"><div><span>{kicker}</span><h2>{title}</h2>{copy && <p>{copy}</p>}</div>{action && <button type="button" disabled>{action}</button>}</div>;
}
function PreviewEmpty({ title, copy }) {
  return <div className="concept-empty"><span aria-hidden="true">✳</span><strong>{title}</strong><p>{copy}</p></div>;
}
function ConceptMetric({ label }) {
  return <article className="concept-metric"><span>{label}</span><strong>—</strong><small>Preview field</small></article>;
}

function AboutPreview() {
  return <div className="about-concept"><span className="concept-overline">A calmer way to build</span><h2>Bring your business online<br /><em>with clarity.</em></h2><p>Proposed brand story composition. Final company facts and approved copy are still needed.</p><div className="about-concept-cards">{["Build with confidence", "Keep your brand yours", "Grow at your pace"].map((item,index)=><article key={item}><small>0{index+1}</small><strong>{item}</strong><p>Proposed brand message</p></article>)}</div></div>;
}
function ContactPreview() {
  return <div className="contact-concept"><div><span className="concept-overline">Contact CYB</span><h2>Let’s make room<br />for your next idea.</h2><p>Recipient, response expectations and form processing need approval.</p><StatusBadge tone="warning">Form is not connected</StatusBadge></div><form><label>Name<input disabled placeholder="Your name" /></label><label>Email<input disabled placeholder="name@example.com" /></label><label>How can we help?<textarea disabled rows="4" placeholder="Write a message" /></label><button type="button" disabled>Preview only</button></form></div>;
}
function ProjectManagementPreview() {
  return <><PreviewHeading kicker="Your work" title="Projects" copy="Proposed multi-project switcher. Project ownership, limits and archive behavior need approval." action="Create project"/><div className="project-concept-toolbar"><span>All projects</span><span>Sort and search controls · concept only</span></div><div className="project-concept-grid"><article className="project-create-card"><span>＋</span><strong>Your projects will appear here</strong><p>No projects have been added to this preview.</p><button type="button" disabled>Create a project</button></article><article className="project-create-card"><span>◌</span><strong>Project switching concept</strong><p>A compact project selector could live in the shared workspace header.</p><StatusBadge>Needs approval</StatusBadge></article></div></>;
}
function NotificationsPreview() {
  return <><PreviewHeading kicker="Workspace" title="Notifications" copy="Proposed notification center. Events, read states and preferences need approval." action="Preferences"/><div className="notification-concept"><div className="notification-concept-tabs"><button className="selected" type="button" disabled>All</button><button type="button" disabled>Unread</button></div><PreviewEmpty title="You’re all caught up" copy="Updates will appear here once notification types and delivery rules are approved." /></div></>;
}
function DiscountsPreview() {
  return <><PreviewHeading kicker="Store / promotions" title="Discounts" copy="Proposed promotions workspace. Eligibility, stacking, duration and redemption rules remain unspecified." action="Create discount"/><div className="concept-toolbar"><span>Discounts list</span><button type="button" disabled>Filter</button></div><div className="concept-table"><div className="concept-table-head"><span>Discount</span><span>Type</span><span>Schedule</span><span>Status</span></div><PreviewEmpty title="No discounts in this preview" copy="The list layout is a visual proposal; no discount rules or sample records are active." /></div></>;
}
function MarketingPreview() {
  return <><PreviewHeading kicker="Business tools" title="Marketing" copy="Proposed campaign workspace. Consent, audience sources, unsubscribe handling and automation need product approval." action="New campaign"/><div className="marketing-concept-grid"><section className="concept-panel"><h3>Campaign workspace</h3><PreviewEmpty title="No campaigns shown" copy="Campaign records will appear after the marketing scope is approved." /></section><section className="concept-panel"><h3>Audience and consent</h3><div className="concept-checklist"><span>Audience source <b>Needs approval</b></span><span>Consent policy <b>Needs approval</b></span><span>Unsubscribe flow <b>Needs approval</b></span></div></section></div></>;
}
function CRMPreview() {
  return <><PreviewHeading kicker="Customer relationships" title="CRM" copy="Proposed relationship workspace. Contact source, consent, tags, ownership and retention rules require approval." action="Add contact"/><div className="concept-stat-grid">{["Contacts", "Follow-ups", "Segments"].map(label=><ConceptMetric key={label} label={label}/>)}</div><div className="crm-concept-grid"><section className="concept-panel"><div className="concept-toolbar"><span>Contact directory</span><StatusBadge tone="warning">Workflow proposal</StatusBadge></div><div className="concept-table-head"><span>Contact</span><span>Source</span><span>Last activity</span><span>Owner</span></div><PreviewEmpty title="No CRM contacts" copy="No customer data or sample profiles are included in this concept." /></section><aside className="concept-panel"><h3>Relationship stages</h3>{["New", "In progress", "Follow-up"].map(label=><div className="crm-stage" key={label}><span>{label}</span><strong>—</strong></div>)}<p>Stage definitions and movement rules need approval.</p></aside></div></>;
}
function AnalyticsPreview() {
  return <><PreviewHeading kicker="Business intelligence" title="Analytics" copy="Proposed analytics overview. Metric definitions, date ranges, attribution and permission boundaries need approval."/><div className="concept-stat-grid">{["Visitors", "Conversions", "Collected revenue", "Bookings"].map(label=><ConceptMetric key={label} label={label}/>)}</div><section className="concept-panel analytics-concept-chart"><div className="concept-toolbar"><strong>Performance over time</strong><span>Reporting period · Needs approval</span></div><div className="analytics-chart-empty"><span aria-hidden="true">⌁</span><strong>No chart data in this proposal</strong><p>Only metrics already collected by CYB can appear. No example figures are shown.</p></div></section><section className="concept-panel"><h3>Traffic breakdown</h3><div className="concept-checklist"><span>Pages <b>Data source needs approval</b></span><span>Channels <b>Attribution needs approval</b></span><span>Conversions <b>Definition needs approval</b></span></div></section></>;
}
function ReportsPreview() {
  return <><PreviewHeading kicker="Business intelligence" title="Reports" copy="Proposed saved-report area, separate from the live analytics summary. Report definitions, sharing, retention and export rules need approval." action="New report"/><div className="reports-builder-concept"><section className="concept-panel"><div className="concept-toolbar"><strong>Report configuration</strong><StatusBadge tone="warning">Not configured</StatusBadge></div>{["Report subject", "Date range", "Included metrics", "Delivery and access"].map((field,index)=><div className="reports-field-row" key={field}><span>{field}</span><span>{index===0?"Choose a data source":"Needs approval"}</span><button type="button" disabled>Configure</button></div>)}<button type="button" disabled>Save report preview</button></section><section className="concept-panel"><h3>Saved reports</h3><div className="concept-table-head"><span>Name</span><span>Updated</span><span>Access</span><span>Status</span></div><PreviewEmpty title="No saved reports" copy="No report records, exports or schedules are included in this proposal." /></section></div></>;
}
function FormsPreview() {
  return <><PreviewHeading kicker="Lead capture" title="Forms" copy="Proposed form and submissions manager. Data retention, notifications, spam protection and consent require approval." action="Create a form"/><div className="forms-concept-grid"><section className="concept-panel"><div className="concept-toolbar"><strong>Form preview</strong><StatusBadge tone="warning">Not connected</StatusBadge></div><div className="forms-builder-preview"><span>FORM PREVIEW</span><label>Your name<input disabled placeholder="Field preview"/></label><label>Email address<input disabled placeholder="Field preview"/></label><label>Message<textarea disabled rows="3" placeholder="Field preview"/></label><button disabled type="button">Submit preview</button></div></section><section className="concept-panel"><h3>Form submissions</h3><div className="concept-table-head"><span>Submission</span><span>Received</span><span>Consent</span><span>Status</span></div><PreviewEmpty title="No submissions" copy="No submitted contact data is shown. Submission handling needs approval." /></section></div></>;
}
function BookingsPreview() {
  return <><PreviewHeading kicker="Scheduling" title="Bookings" copy="Proposed booking journey and calendar layout. Availability, cancellation, deposits, reminders and time-zone rules require approval." action="Configure availability"/><div className="booking-concept-grid"><section className="concept-panel"><div className="concept-toolbar"><strong>Availability calendar</strong><span>Calendar concept</span></div><div className="booking-week-head">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(day=><span key={day}>{day}</span>)}</div><div className="booking-calendar-empty"><span>Choose an approved schedule to show available times.</span></div></section><aside className="concept-panel"><h3>Booking details</h3><div className="booking-summary-row"><span>Service selection</span><StatusBadge>Needs approval</StatusBadge></div><div className="booking-summary-row"><span>Guest information</span><StatusBadge>Needs approval</StatusBadge></div><div className="booking-summary-row"><span>Confirmation</span><StatusBadge>Needs approval</StatusBadge></div><button type="button" disabled>Continue preview</button></aside></div><PreviewEmpty title="No appointment records" copy="This concept is not connected to live bookings or customer data." /></>;
}
function SEOPreview() {
  return <><PreviewHeading kicker="Website visibility" title="SEO" copy="Proposed SEO workspace. Search indexing, generated metadata, canonical URLs and structured data require product and technical approval." action="Review site SEO"/><div className="seo-concept-layout"><section className="concept-panel"><h3>Page metadata</h3><div className="seo-page-preview"><span>PAGE TITLE</span><strong>Your page title preview</strong><p>Proposed description preview. This is placeholder copy for layout only.</p><small>Page URL · not connected</small></div><div className="seo-fields"><label>Title field<input disabled placeholder="Title editing proposal"/></label><label>Description<textarea disabled rows="3" placeholder="Description editing proposal"/></label><label>Indexing preference<select disabled defaultValue=""><option value="">Needs approval</option></select></label></div></section><aside className="concept-panel"><h3>Readiness review</h3>{["Metadata coverage", "Indexing controls", "Structured data", "Sitemap behavior"].map(label=><div className="seo-check-row" key={label}><span>{label}</span><StatusBadge tone="warning">Needs approval</StatusBadge></div>)}</aside></div></>;
}
function DomainsPreview() {
  return <><PreviewHeading kicker="Website settings" title="Domains" copy="Proposed domain workspace. Provider, ownership checks, DNS instructions and release behavior need approval." action="Connect a domain"/><div className="domain-concept"><div className="domain-status"><span className="domain-orb">↗</span><div><strong>Connect your website address</strong><p>Domain setup is not enabled in this preview.</p></div><StatusBadge tone="warning">Setup concept</StatusBadge></div><div className="domain-steps">{["Choose a domain", "Verify ownership", "Connect and review"].map((x,i)=><div key={x}><small>STEP 0{i+1}</small><strong>{x}</strong><span>Design placeholder</span></div>)}</div><button type="button" disabled>Start setup</button></div></>;
}
function CMSPreview() {
  return <><PreviewHeading kicker="Content" title="CMS collections" copy="Proposed collection manager. Field types, permissions and publishing rules need approval." action="New collection"/><div className="cms-concept-grid"><section className="concept-panel"><h3>Collections</h3><PreviewEmpty title="No collections yet" copy="A collection list would be managed here after the CMS requirements are approved." /></section><section className="concept-panel"><h3>Collection structure</h3><div className="cms-field-row"><span>Field name</span><span>Field type</span><span>Visibility</span></div><div className="cms-field-empty">Choose a collection to review its fields.</div></section></div></>;
}
function BlogPreview() {
  return <><PreviewHeading kicker="Content" title="Blog" copy="Proposed editorial workspace. Author roles, scheduling, categories and public publishing need approval." action="Write a post"/><div className="blog-concept"><aside><strong>Posts</strong><span>All posts</span><span>Drafts</span><span>Categories</span></aside><section><div className="concept-table-head"><span>Post title</span><span>Author</span><span>Updated</span><span>Status</span></div><PreviewEmpty title="No posts in this preview" copy="The editor and post lifecycle are not connected." /></section></div></>;
}
function MembershipsPreview() {
  return <><PreviewHeading kicker="Audience" title="Memberships" copy="Proposed member access workspace. Entitlements, plan terms and billing dependencies need approval." action="Create a membership"/><div className="membership-concept-grid">{["Access levels", "Member directory", "Entitlements"].map(item=><article className="concept-panel" key={item}><span className="concept-overline">MEMBERSHIPS</span><h3>{item}</h3><p>Structure preview</p><StatusBadge tone="warning">Not configured</StatusBadge></article>)}</div><PreviewEmpty title="No membership records" copy="No plans, members or prices are shown in this proposal." /></>;
}
function CoursesPreview() {
  return <><PreviewHeading kicker="Learning" title="Courses" copy="Proposed course studio. Lesson format, student access and completion rules need approval." action="New course"/><div className="course-concept"><aside><span>Course outline</span><button type="button" disabled>＋ Add module</button><PreviewEmpty title="No modules" copy="Approved course structure will appear here." /></aside><section><div className="course-cover"><span>COURSE COVER PREVIEW</span><strong>Your course title</strong><p>Course description placeholder</p></div><div className="course-outline-row"><span>Module / lesson preview</span><span>Not configured</span></div></section></div></>;
}
function CommunityPreview() {
  return <><PreviewHeading kicker="Audience" title="Community" copy="Proposed member space. Privacy, moderation, posting rules and roles need approval." action="Create a space"/><div className="community-concept"><aside><strong>Spaces</strong><span>Overview</span><span>Topics</span><span>Guidelines</span></aside><section><div className="community-welcome"><span>COMMUNITY SPACE PREVIEW</span><h3>A welcoming place for your members</h3><p>Proposed introduction text. Final community guidelines require approval.</p></div><PreviewEmpty title="No conversations" copy="No member posts or profiles are included in this preview." /></section></div></>;
}
function UnifiedInboxPreview() {
  return <><PreviewHeading kicker="Conversations" title="Unified Inbox" copy="Proposed channel overview. This is distinct from the customer support ticket system."/><div className="inbox-concept"><aside><div className="inbox-filter">All conversations <span>—</span></div><PreviewEmpty title="No conversations" copy="Messages from approved channels would appear here." /></aside><section><div className="inbox-reading-head"><strong>Select a conversation</strong><StatusBadge>Unified inbox concept</StatusBadge></div><div className="inbox-reading-body"><PreviewEmpty title="Conversation details" copy="Choose a conversation to see its message history and assignment details." /></div><div className="inbox-reply"><input disabled placeholder="Reply controls are not connected"/><button disabled type="button">Send</button></div></section></div></>;
}
function CustomerSupportPreview() {
  return <><PreviewHeading kicker="Support" title="Customer Support" copy="Proposed ticket workspace, separate from the Unified Inbox. Roles, states, history and handoff need approval." action="Create ticket"/><div className="support-concept"><aside><span>Ticket queue</span><button disabled type="button">All tickets</button><button disabled type="button">Assigned to me</button><button disabled type="button">Waiting</button></aside><section><div className="concept-table-head"><span>Ticket</span><span>Requester</span><span>Assignee</span><span>Status</span></div><PreviewEmpty title="No support tickets" copy="No customer details or sample tickets are displayed." /></section></div></>;
}
function AISupportPreview() {
  return <><PreviewHeading kicker="Automation" title="AI Support" copy="Proposed assistant settings. The baseline names Off, Suggest Only and Auto-Reply modes; policy and handoff behavior need approval."/><div className="ai-support-concept"><section className="concept-panel"><h3>Support mode</h3>{["Off", "Suggest Only", "Auto-Reply"].map((x,i)=><label className="ai-mode-row" key={x}><input type="radio" name="ai-mode" disabled checked={i===0} readOnly/><span><strong>{x}</strong><small>{i===0?"No automated replies":"Mode definition requires approval"}</small></span><StatusBadge tone={i===0?"neutral":"warning"}>{i===0?"Preview":"Needs approval"}</StatusBadge></label>)}</section><section className="concept-panel"><h3>Human handoff</h3><PreviewEmpty title="Escalation policy not set" copy="Routing, response ownership and approval rules are not active in this design preview." /></section></div></>;
}
function AIOperationsPreview() {
  return <><PreviewHeading kicker="AI governance" title="AI Operations" copy="Proposed operator console. Tool policies, audit events, privacy and cost controls need approval."/><div className="operations-concept-metrics"><ConceptMetric label="Tools configured"/><ConceptMetric label="Audits"/><ConceptMetric label="Cost controls"/></div><div className="concept-table"><div className="concept-table-head"><span>Tool area</span><span>Policy</span><span>Owner</span><span>Review</span></div>{["Content generation", "Design changes", "Customer support"].map(item=><div className="operations-row" key={item}><span>{item}</span><span>Not configured</span><span>—</span><StatusBadge tone="warning">Needs approval</StatusBadge></div>)}</div></>;
}
function AICreditsPreview() {
  return <><PreviewHeading kicker="AI usage" title="AI Credits" copy="Proposed credit and usage view. Packages, prices, grant rules and ledger lifecycle are not finalized." action="Manage credits"/><div className="credits-concept"><section className="credits-balance"><span>Available balance</span><strong>—</strong><small>Balance model needs approval</small></section><section className="concept-panel"><h3>Credit activity</h3><div className="concept-table-head"><span>Date</span><span>Activity</span><span>Change</span><span>Balance</span></div><PreviewEmpty title="No credit activity" copy="No credits or monetary amounts are included in this proposal." /></section></div></>;
}
function WalletsPreview() {
  return <><PreviewHeading kicker="Billing structure" title="Project Wallets" copy="Proposed project-level wallet overview. Ownership, transfers, closure and consolidated billing need approval."/><div className="wallet-concept-grid">{["Project wallet", "Project wallet", "Owner overview"].map((item,index)=><article className="concept-panel" key={`${item}-${index}`}><span className="concept-overline">{index===2?"OWNER VIEW":"PROJECT VIEW"}</span><h3>{item}</h3><div className="wallet-balance">—</div><p>Wallet structure only · no balances</p><StatusBadge tone="warning">Not connected</StatusBadge></article>)}</div></>;
}
function RecoveryPreview() {
  return <><PreviewHeading kicker="Project safety" title="Recovery Center" copy="Proposed recovery interface. Restore permissions, retained versions and financial boundaries need approval." action="Review recovery options"/><div className="recovery-banner"><span>SAFE PREVIEW</span><strong>Nothing can be restored from this concept screen.</strong><p>Recovery actions remain disabled until scope and safeguards are approved.</p></div><section className="concept-panel"><div className="concept-table-head"><span>Recovery item</span><span>Created</span><span>Scope</span><span>Action</span></div><PreviewEmpty title="No recovery points shown" copy="This preview contains no real backups or customer content." /></section></>;
}
function ReliabilityPreview() {
  return <><PreviewHeading kicker="Platform operations" title="Reliability Center" copy="Proposed service health console. Metrics, thresholds, severity and operator permissions need approval."/><div className="reliability-metrics">{["Service health", "Open incidents", "Recent changes"].map(label=><ConceptMetric key={label} label={label} />)}</div><div className="reliability-concept-grid"><section className="concept-panel"><h3>Service status</h3><PreviewEmpty title="No live status connected" copy="This concept is not reading production or staging telemetry." /></section><section className="concept-panel"><h3>Incident history</h3><PreviewEmpty title="No incident records" copy="No incident data is fabricated for this preview." /></section></div></>;
}
function StudentPortalPreview() {
  return <><PreviewHeading kicker="Learning experience" title="Student Portal" copy="Proposed learner view for accessing purchased or assigned course content. Enrollment, lesson access, progress tracking, certificates, and support rules require product approval." action="Continue learning"/><div className="student-portal-concept"><aside className="concept-panel student-course-nav"><span className="student-nav-label">LEARNING SPACE · CONCEPT</span><strong>Course navigation</strong><div className="student-course-placeholder"><span className="student-course-icon">◫</span><span>Course title<small>Access and enrollment not connected</small></span></div>{["Overview", "Lessons", "Resources", "Help"].map((label,index)=><div className={`student-nav-item ${index===0?"current":""}`} key={label}><span>{label}</span><span aria-hidden="true">{index===0?"•":"›"}</span></div>)}<p className="student-nav-note">Navigation labels are a proposal; available sections depend on approved course requirements.</p></aside><section className="student-course-main"><article className="student-welcome-card"><span className="concept-overline">YOUR LEARNING SPACE</span><h3>Welcome back</h3><p>Pick up where you left off when course access and progress are connected.</p><div className="student-progress-line"><span>Course progress</span><strong>—</strong></div><div className="student-progress-track"><span /></div><small>Progress details are not available in this preview.</small></article><div className="student-learning-grid"><section className="concept-panel"><div className="concept-toolbar"><h3>Course content</h3><StatusBadge tone="warning">Proposal</StatusBadge></div><PreviewEmpty title="No lessons available" copy="Course modules and lessons will appear here after the learning structure and access rules are approved." /></section><section className="concept-panel student-next-panel"><h3>Learning resources</h3><PreviewEmpty title="No resources attached" copy="Downloads, notes, and certificates are not connected in this concept." /></section></div><div className="student-portal-footnote">STUDENT PORTAL · VISUAL PROPOSAL · NO COURSE OR LEARNER DATA SHOWN</div></section></div></>;
}

const screenComponents = {
  "About CYB": AboutPreview,
  Contact: ContactPreview,
  "Project management": ProjectManagementPreview,
  Notifications: NotificationsPreview,
  Discounts: DiscountsPreview,
  CRM: CRMPreview,
  Analytics: AnalyticsPreview,
  Reports: ReportsPreview,
  Forms: FormsPreview,
  Bookings: BookingsPreview,
  Marketing: MarketingPreview,
  SEO: SEOPreview,
  Domains: DomainsPreview,
  CMS: CMSPreview,
  Blog: BlogPreview,
  Memberships: MembershipsPreview,
  Courses: CoursesPreview,
  "Student Portal": StudentPortalPreview,
  Community: CommunityPreview,
  "Unified Inbox": UnifiedInboxPreview,
  "Customer Support": CustomerSupportPreview,
  "AI Support": AISupportPreview,
  "AI Operations": AIOperationsPreview,
  "AI Credits": AICreditsPreview,
  "Project Wallets": WalletsPreview,
  "Recovery Center": RecoveryPreview,
  "Reliability Center": ReliabilityPreview,
};

export default function DesignProposals() {
  const [selected, setSelected] = useState(() => {
    const requested = new URLSearchParams(window.location.search).get("screen");
    return screenComponents[requested] ? requested : "About CYB";
  });
  const ActiveScreen = screenComponents[selected] || AboutPreview;
  const group = sections.find(section => section.items.includes(selected)) || sections[0];
  return <main className="proposal-workspace">
    <aside className="proposal-sidebar"><Link className="proposal-brand" to="/">CYB<span>STUDIO</span></Link><p className="proposal-sidebar-note">Individual visual concepts for features awaiting requirements approval.</p>{sections.map(section=><section key={section.id}><span className="proposal-nav-label">{section.label}</span>{section.items.map(item=><button key={item} type="button" className={item===selected?"active":""} onClick={()=>setSelected(item)}>{item}</button>)}</section>)}<Link className="proposal-back" to="/">← Back to CYB</Link></aside>
    <section className="proposal-main"><header className="proposal-topbar"><div><span>INDIVIDUAL DESIGN PREVIEW · {group.label.toUpperCase()}</span><h1>{selected}</h1></div><StatusBadge tone="warning">PROPOSED · APPROVAL REQUIRED</StatusBadge></header><div className="proposal-canvas"><div className="proposal-canvas-meta"><span>{selected} interface concept</span><span>Isolated · no operational data or actions</span></div><div className="proposal-screen"><ActiveScreen /></div></div></section>
  </main>;
}

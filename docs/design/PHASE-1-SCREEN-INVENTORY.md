# CYB Phase 1 — Screen Inventory and Visual Status

**Baseline:** CYB requirements and gap audit, 14 November 2026, plus the UI areas explicitly listed in the Phase 1 request. The audit notes that the original planning conversations for stages 1–44 were not recovered. This inventory records current route/component evidence; it does not claim product behavior is complete.

**Status key**

- **Existing — visual review needed:** a route/component exists; responsive and state coverage still needs visual review.
- **UI implemented — verification blocked:** frontend visual changes are in place, but no real browser screenshot has verified the result.
- **Existing — partial:** some UI exists, while the requested screen/state breadth is not evidenced.
- **Proposed — approval needed:** no sufficient recovered product specification or existing screen; visual concept must be approved before it is treated as final.
- **Not found:** no screen evidence in this frontend snapshot.

| Area | Screen | Current route / component | Design status | Scope note |
|---|---|---|---|---|
| Public | Homepage | `/` — `LandingPage` | Existing — visual review needed | Keep as the approved staging reference. |
| Public | Features | `/` — landing sections | Existing — visual review needed | Section within home, not a separate route today. |
| Public | Pricing | `/` — `Pricing` | Existing — visual review needed | Preserve current pricing behavior and copy. |
| Public | Templates gallery | `/templates` | UI implemented — verification blocked | Warm-neutral responsive gallery; actual two available template families; current favorite/search/filter and existing preview/editor routes preserved. |
| Public | About | `/design-proposals` | Proposed — isolated visual preview | Content and structure not recovered. |
| Public | Contact | `/design-proposals` | Proposed — isolated visual preview | Contact workflow and data handling not specified. |
| Public | Login | `/login` | Existing — visual review needed | Do not change authentication behavior. |
| Public | Signup | `/signup` | Existing — visual review needed | Do not change account creation behavior. |
| Public | Forgot password | `/forgot-password` | Existing — visual review needed | Do not change reset delivery or token behavior. |
| Dashboard | Overview | `/dashboard` | Existing — visual review needed | Reads live account data; prior visual refinements retained; no fixture data added. |
| Dashboard | Project creation | `/create-website` | Existing — partial | Current setup flow exists; multi-project requirements need confirmation. |
| Dashboard | Project management / switching | `/design-proposals` | Proposed — isolated visual preview | Lifecycle and multi-project behavior not fully recovered. |
| Dashboard | Navigation sidebar | `/dashboard`, `/business`, `/products`, `/orders`, `/customers`, `/settings` | UI implemented — verification blocked | Shared workspace navigation extended to Products, Orders and Customers; links use existing routes. |
| Dashboard | Website management | `/dashboard`, `/editor` | Existing — partial | Draft/published mismatch is a known audit follow-up. |
| Dashboard | Notifications | `/dashboard` | Existing — visual empty state implemented | Shows “all caught up”; no fake notification records/counts. |
| Dashboard | Account settings | `/settings` | Existing — visual review needed | Shared workspace styling applied; preserve account operations. |
| Builder | Editor | `/editor` | Existing — visual review needed | Existing dark workspace is retained as the staging visual reference. |
| Builder | Elements, layers, properties | `/editor` | Existing — partial | Component existence does not prove full capability matrix. |
| Builder | Pages manager | `/editor` | Existing — partial | Validate each page action and mobile layout separately. |
| Builder | Templates | `/templates`, `/editor` | Existing — partial | Current family and approved category mapping need source confirmation. |
| Builder | Media library | `/editor` | Existing — partial | Visual states and empty/error/loading coverage need review. |
| Builder | Brand Kit | `/editor` | Existing — partial | Full approved scope unavailable. |
| Builder | Responsive preview | `/editor` | Existing — partial | Desktop/tablet/mobile screenshots remain required. |
| Builder | Draft/publish controls | `/editor` | Existing — partial | Preserve explicit publish snapshot; audit gate remains open. |
| Store | Store dashboard | `/dashboard` | Existing — partial | Current overview mixes store and account data. |
| Store | Products / product editor | `/products` | UI implemented — verification blocked | Existing product operations retained and placed inside shared workspace navigation. |
| Store | Inventory | `/products` | Existing — partial | Multi-location behavior not recovered. |
| Store | Orders | `/orders`, `/orders/:orderId` | UI implemented — verification blocked | Existing order/payment status distinctions retained and placed inside shared workspace navigation. |
| Store | Customers | `/customers` | UI implemented — verification blocked | Existing customer data and actions retained; no fabricated records; placed inside shared workspace navigation. |
| Store | Shipping | `/shipping` | Existing — visual review needed | Preserve existing settings behavior. |
| Store | Discounts | `/design-proposals` | Proposed — isolated visual preview | Rules, stacking, and eligibility not recovered. |
| Store | Store design | `/store-designer` | Existing — partial | Compare with approved staging styling. |
| Store | Cart / checkout | `/cart`, `/checkout`, `/payment` | Existing — partial | UI only in this phase; no payment integration changes. |
| Business | CRM | `/business`, `/customers`, `/design-proposals` | Existing — partial / proposal preview | Existing client data remains live; supplemental CRM workflow proposal awaits approval. |
| Business | Analytics / reports | `/dashboard`, `/business`, `/design-proposals` | Existing — partial / proposal preview | Existing collected metrics remain live; report-builder concept has no fabricated figures. |
| Business | Forms | `/editor`, `/design-proposals` | Existing — partial / proposal preview | Existing editor forms retained; submission workflow concept requires approval. |
| Business | Bookings | `/business`, `/design-proposals` | Existing — partial / proposal preview | Existing booking actions retained; supplemental customer booking journey requires approval. |
| Business | Marketing | `/design-proposals` | Proposed — isolated visual preview | Consent, campaigns, and automation scope not recovered. |
| Business | SEO | `/editor`, `/design-proposals` | Existing — partial / proposal preview | Existing editor controls retained; expanded SEO workspace requires approval. |
| Business | Domains | `/design-proposals` | Proposed — isolated visual preview | Domain setup and release behavior require separate technical design. |
| Business | CMS / blog | `/design-proposals` | Proposed — isolated visual preview | Collection and publishing workflows not recovered. |
| Advanced | Memberships | `/design-proposals` | Proposed — isolated visual preview | Entitlements and billing dependencies not recovered. |
| Advanced | Courses | `/design-proposals` | Proposed — isolated visual preview | Course, progress, and access states not recovered. |
| Advanced | Student Portal | `/design-proposals?screen=Student%20Portal` | Proposed — isolated visual preview | Learner access, enrollment, progress, completion, and support rules need approval. |
| Advanced | Community | `/design-proposals` | Proposed — isolated visual preview | Moderation and member privacy scope not recovered. |
| Advanced | Unified Inbox | `/design-proposals` | Proposed — isolated visual preview | Keep distinct from customer support; workflow not specified. |
| Advanced | Customer Support | `/design-proposals` | Proposed — isolated visual preview | Roles, ticket states, and history not specified. |
| Advanced | AI Support | `/design-proposals` | Proposed — isolated visual preview | Approved modes and human escalation must be specified first. |
| Advanced | AI Operations | `/design-proposals` | Proposed — isolated visual preview | Owner controls, audits, and cost model not recovered. |
| Advanced | AI Credits | `/design-proposals` | Proposed — isolated visual preview | Pricing and credit ledger are not finalized. |
| Advanced | Project Wallets | `/design-proposals` | Proposed — isolated visual preview | Ownership and transfer rules not recovered. |
| Advanced | Recovery Center | `/design-proposals` | Proposed — isolated visual preview | Restore scope and financial invariants need product approval. |
| Advanced | Reliability Center | `/design-proposals` | Proposed — isolated visual preview | Metrics, severity, and operator roles need approval. |
| States | Empty / loading / error / mobile | Cross-cutting | Existing — partial | Inventory and visual QA required per implemented screen; no behavior fabricated. |

## Visual QA record

| Viewport | Route/screen | Status | Evidence |
|---|---|---|---|
| Desktop 1440×900 | Requested implementation routes | Not run | Staging homepage reference was visually opened at the browser's default viewport; it is reference evidence only and does not verify this branch. Exact viewport screenshots remain pending. |
| Tablet 768×1024 | Requested implementation routes | Not run | No branch preview available at this viewport. |
| Mobile 390×844 | Requested implementation routes | Not run | No branch preview available at this viewport. |
| Mobile 375×812 | Requested implementation routes | Not run | No branch preview available at this viewport. |

**Browser-preview blocker:** the staging reference homepage is reachable in the cloud browser and was inspected visually. It is not the current design branch, so it cannot verify these edits. An existing Render static site `cyb-migration-preview-20261109` was found, but it tracks `main`, has auto-deploy off, and has pull-request previews disabled. The Render dashboard redirects to sign-in and offers multiple methods; no authorized signed-in session is available in this browser. The local Vite server is not reachable from the separate browser surface (`uv_interface_addresses` fails for `0.0.0.0`, and the browser cannot connect to executor `127.0.0.1`); local Chromium also aborts because socket creation is denied. No infrastructure or deployment configuration was changed. Exact desktop/tablet/mobile screenshots of this branch remain unverified.

## Approval queue

Approve the proposed concepts for About, Contact, multi-project management, discounts, marketing, domains, CMS/blog, memberships, courses, community, unified inbox, support, AI support/operations/credits, project wallets, Recovery Center, and Reliability Center. These remain visual proposals until source specifications are recovered or the product owner approves the direction.

## Phase 1 implementation update — 14 November 2026

- Shared visual primitives now include page headings, empty states, and status badges.
- Existing authentication and dashboard screens received warm-neutral refinements while retaining their API and navigation behavior.
- Existing commerce/account forms and tables use shared focus, border, radius, and responsive table treatments.
- `/design-proposals` is a separate preview route for concepts whose feature requirements are not recovered. Concept actions are disabled, no records or financial values are invented, and the interface is clearly marked as requiring approval.
- `/design-proposals` now offers individual layouts for About, Contact, project management, notifications, discounts, marketing, domains, CMS, blog, memberships, courses, Student Portal, community, Unified Inbox, Customer Support, AI Support, AI Operations, AI Credits, Project Wallets, Recovery Center, and Reliability Center. Each remains a proposal pending approval/specification; the route is not evidence that these product features operate.
- Added an individual Student Portal concept with course navigation, an unavailable-progress state, course-content empty state, and resource panel. It contains no learner records or fabricated progress and has no active actions.
- The Templates gallery now has a responsive, warm-neutral gallery treatment and uses the existing routes for template preview and editor selection. It displays only the two template families present in the frontend.
- Products, Orders, and Customers now share the existing workspace navigation layout without replacing their data-backed operations. The shared workspace styling also applies to Settings and other pages already using that layout.
- The existing Business workspace now uses the shared CYB warm-neutral style across real business records, calendars, analytics summaries, CRM client notes, and booking controls. Additional concepts for CRM, analytics/reports, forms, bookings, and SEO remain isolated and disabled pending approval.
- The editor control chrome now follows the approved charcoal direction with warm ivory accents; the customer website preview and editor operations remain unchanged.
- `/design-proposals` includes separate CRM, Analytics & Reports, Forms, Bookings, and SEO proposals. Each remains disabled, isolated, and subject to approval for any unapproved workflow.
- Desktop/tablet/mobile screenshot checks remain **Not Run** because the local app server is not reachable from the available browser surface. A build is not counted as visual verification.
- Final checks for this update: `npm run build`, `npm run lint`, and `git diff --check` passed.

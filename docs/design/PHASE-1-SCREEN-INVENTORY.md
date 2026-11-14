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
| Business | CRM | `/business`, `/customers` | Existing — partial | Customer workflow and segmentation need confirmation. |
| Business | Analytics / reports | `/dashboard`, `/business` | Existing — partial | Financial metrics must continue to use collected-payment definitions. |
| Business | Forms | `/editor` | Existing — partial | Submission management not verified. |
| Business | Bookings | `/business` | Existing — partial | End-to-end booking states not verified. |
| Business | Marketing | `/design-proposals` | Proposed — isolated visual preview | Consent, campaigns, and automation scope not recovered. |
| Business | SEO | `/editor` | Existing — partial | Approved SEO controls and public metadata need confirmation. |
| Business | Domains | `/design-proposals` | Proposed — isolated visual preview | Domain setup and release behavior require separate technical design. |
| Business | CMS / blog | `/design-proposals` | Proposed — isolated visual preview | Collection and publishing workflows not recovered. |
| Advanced | Memberships | `/design-proposals` | Proposed — isolated visual preview | Entitlements and billing dependencies not recovered. |
| Advanced | Courses | `/design-proposals` | Proposed — isolated visual preview | Course, progress, and access states not recovered. |
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
| Desktop 1440×900 | Pending | Not run | Capture after implementation. |
| Tablet 768×1024 | Pending | Not run | Capture after implementation. |
| Mobile 390×844 | Pending | Not run | Capture after implementation. |
| Mobile 375×812 | Pending | Not run | Capture after implementation. |

**Browser-preview blocker:** the local Vite server could not be exposed to the browser surface. Binding Vite to `0.0.0.0` fails in this executor because Node cannot enumerate network interfaces (`uv_interface_addresses`, system error 1). A `127.0.0.1` run did start in the executor, but both executor `curl` and the separate Chromium desktop/browser surface could not connect. The Draft PR has no CI status checks or preview deployment, and no authorized development preview service is configured. No deployment or infrastructure was created to bypass this boundary. Therefore there are no screenshots of the current changes and these screens remain visually unverified.

## Approval queue

Approve the proposed concepts for About, Contact, multi-project management, discounts, marketing, domains, CMS/blog, memberships, courses, community, unified inbox, support, AI support/operations/credits, project wallets, Recovery Center, and Reliability Center. These remain visual proposals until source specifications are recovered or the product owner approves the direction.

## Phase 1 implementation update — 14 November 2026

- Shared visual primitives now include page headings, empty states, and status badges.
- Existing authentication and dashboard screens received warm-neutral refinements while retaining their API and navigation behavior.
- Existing commerce/account forms and tables use shared focus, border, radius, and responsive table treatments.
- `/design-proposals` is a separate preview route for concepts whose feature requirements are not recovered. Concept actions are disabled, no records or financial values are invented, and the interface is clearly marked as requiring approval.
- `/design-proposals` now offers individual layouts for About, Contact, project management, notifications, discounts, marketing, domains, CMS, blog, memberships, courses, community, Unified Inbox, Customer Support, AI Support, AI Operations, AI Credits, Project Wallets, Recovery Center, and Reliability Center. Each remains a proposal pending approval/specification; the route is not evidence that these product features operate.
- The Templates gallery now has a responsive, warm-neutral gallery treatment and uses the existing routes for template preview and editor selection. It displays only the two template families present in the frontend.
- Products, Orders, and Customers now share the existing workspace navigation layout without replacing their data-backed operations. The shared workspace styling also applies to Settings and other pages already using that layout.
- Desktop/tablet/mobile screenshot checks remain **Not Run** because the local app server is not reachable from the available browser surface. A build is not counted as visual verification.
- Final checks for this update: `npm run build` passed. ESLint initially found two implementation issues (an unused import and a callback name interpreted as a React hook); both were corrected. Rerun lint before publishing the update.

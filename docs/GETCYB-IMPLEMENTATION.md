# GETCYB development status

Updated 24 October 2026. Work is local on `codex/getcyb-editor-foundation`; nothing in this increment has been pushed or deployed. This is a substantial implementation increment, not certification that the entire platform specification is complete.

## Existing architecture retained
React 19, Vite, React Router, Firebase Authentication/Firestore/Storage, and Firebase Functions. Original accounts, products, orders, customers and website documents have not been migrated or modified by this work. Existing pricing and PayPal sandbox platform-access functions remain unchanged. Existing public/admin route contracts remain, with nested public page support added.

The existing v2 section model and legacy public renderer remain readable. Existing merchant product management, including Active/On Sale/Hidden, is retained. Existing e-commerce checkout is not yet secure enough to call complete; see gaps below.

## Implemented in source

### Editor and public rendering
- Shared `src/editor/WebsiteRenderer.jsx` renders editable sections, preview and v2 published websites. Legacy websites retain their fallback renderer.
- Pages can be added, renamed, reordered and deleted; custom slugs, navigation, page titles and descriptions are stored. Home stays at the root address.
- Direct heading/body editing; section/layer reordering; touch-friendly move buttons; duplicate/delete; copy/paste; lock/unlock; group/ungroup; reusable sections; media reuse; zoom and device previews.
- Typography, colors, background, alignment, padding, width/height constraints, letter spacing and line height. Font, spacing and visibility overrides for iPad/Phone are applied to real public container widths as well as preview devices.
- Brand logo, body/heading fonts, button shape, recent colors and global colors. Web fonts are requested with display=swap and system fallbacks.
- Four original typography-led Design Collections: Atelier Beauty, Supper Club, Form & Field and Independent Index. Each creates four editable pages. Users may add sections or all pages without replacing existing content. Photography must be uploaded by the merchant; these are not finished photographic agency sites.
- Hero, story, service list, menu, booking, galleries, FAQ, product/collection, text, heading, button, photo, chat-email, contact form, divider, footer and grouped sections.
- Functional responsive navigation, safe links, product cart actions and contact/booking/pickup widgets when APIs are configured. Booking does not show fabricated available times.

### Publishing and data boundaries
- `functions/websites.cjs`: authenticated private draft load/save; server-validated publish; transactional unique slug check; public projections; unpublish; latest 10 published versions.
- New drafts and versions are under `businessPrivate/{uid}`. `publishedWebsites/{slug}` contains curated public website data. Reusable/private draft sections are excluded from public projections.
- Private drafts autosave after a debounce. Device cache is account-scoped; unsaved changes can be recovered. Restoring a version creates a draft; publishing remains explicit.
- Public website and product APIs return selected public fields. Product cost/private merchant fields are not included. Existing deployed database rules still require audit: these API boundaries do not prove old direct database reads/writes are blocked.
- `saveStore` uses merge semantics. Auth protects editor/create-website routes; auth user debug logging removed. Public loading/missing/unpublished/error states are explicit.

### Modular business management
- Six business categories in setup and shared business workspace. Category changes retain existing module data.
- Editable services/prices/durations; staff/service assignments, working hours, breaks/days off; menu/categories/prices/allergens; tables/capacity; projects and imagery.
- Business timezone, seven-day operating hours, closure dates and reservation duration.
- Server availability logic handles business AND staff hours, breaks, closures, duration, table capacity and overlap. Per-business/day Firestore ledgers serialize booking allocations in transactions.
- Public service/staff/date/time booking flow with real server availability options, in-page confirmation, owner-created bookings, cancellation, completion and rescheduling.
- Monthly calendar, day/week/month record filters, staff filter, client booking history and private client notes.
- Restaurant pickup ordering is optional, uses merchant menu prices in integer cents, server validation and request idempotency. Pay-at-pickup only. Owner order states progress through accepted/preparing/ready/completed/cancelled.
- Contact submissions, in-dashboard notifications/read state, client inquiries, category-specific module navigation and real record-derived counts.
- Optional page-view/session/source collection and booking/pickup/inquiry conversion counters. Owner analytics shows collected data, no fabricated statistics.

### E-commerce and reliability improvements
- Hidden products are omitted by public APIs; expired visibility schedules and explicit/percentage sale prices are respected.
- Cart no longer clears itself during initial effect loading, stock limits are respected in add-to-cart, store identity is included on product-detail cart items, and cross-store orders are rejected.
- Dashboard loads merchant identity/products from authenticated cloud state rather than account-independent localStorage. Non-store categories route to the business workspace.
- Revenue calculations use paid/completed/delivered orders; net profit remains unavailable when cost-of-goods/expense data is missing.
- Route-level lazy loading and an application error boundary added. Large shared Firebase/React bundle still needs further optimization.

## Verification performed
- `node --test tests/*.test.*`: **26 passing**. Covers page preservation/validation, collection pages, grouping, safe URLs, hidden products, sale prices, merchant cart isolation, accounting semantics, draft/live isolation, server snapshot validation, staff/table availability and pickup totals/transitions.
- `npm run build`: successful after implementation. A large shared JS chunk warning remains.
- `node -e "require('./functions/index.js')"`: Functions entry and all modules load with installed dependencies. Syntax checks passed.
- Browser QA on the actual shared renderer using a temporary fixture: Laptop/Phone rendering, mobile menu expand/collapse, navigation to Contact and four-page collection navigation. Editorial restaurant typography reviewed visually. Unauthenticated `/editor` redirects to `/login`.
- Temporary fixture is excluded from Git and removed after QA. It is not a substitute for production business functionality.

## Verification blocked or incomplete
1. **Firestore emulator cannot start:** installed Java is 17; firebase-tools requires Java 21+. A guarded demo-project owner/other-user/anonymous rules smoke test is prepared in `tests/emulator-smoke.cjs` but has NOT passed or run.
2. **No authenticated Firebase integration journey:** no test account/session was used to verify signup/login/reset email, uploads, cloud autosave/reload, public publication, booking transactions, reschedule, pickup orders or forms against actual Firebase.
3. **No production rule inspection:** no Firestore/Storage rule sources were present. `security/emulator.rules` is an isolated test policy, not a production replacement. Existing wildcard grants could defeat new private namespaces; they must be inspected and corrected before release.
4. **New frontend requires new Functions:** deploying the frontend alone would break new draft/public/module APIs. Deploy APIs, verified rules and App Check configuration as one staged release, test it, then promote the frontend.
5. **App Check:** public booking, availability, inquiry, pickup and analytics callable APIs enforce App Check. The client provider/site key is not configured. These workflows remain blocked until configured and tested; do not remove enforcement to hide the setup gap.
6. **Transactions/concurrency:** tested allocation policy, but no emulator test has verified Firestore retries/concurrency/ownership end to end. Booking submission idempotency and public abuse/rate controls need additional hardening.

## Features still partial or planned
- True free-position nested element canvas, resize handles/snapping/alignment guides, keyboard shortcuts, arbitrary container/grid controls, video/icons/sliders/pricing/team/testimonial/comparison/marquee/scroll effects: not complete. Grouped sections can be ungrouped for editing; nested layer editing is limited.
- Multi-image professional photography and full visual refinement of all four template families: partial. Current collections emphasize typography and editable structure.
- Gallery alt-text editing per image, page social images/canonical URLs/structured data/sitemaps and search-engine server rendering: incomplete. Current page metadata is client-side.
- Flexible form field builder and newsletter consent/subscriptions: incomplete; current form has name/email/message.
- Appointment add-ons, multi-resource appointments, customer self-cancellation, cancellation-policy settings, reusable weekly calendar views and real email confirmations: incomplete.
- Restaurant item modifiers/extras, multi-table party allocation and delivery integrations: incomplete. Pickup ordering exists but still needs deployment/integration QA.
- Existing store checkout still accepts browser-calculated order totals and writes customer/order records from the browser. Server-authoritative inventory/checkout, variants/options, discount-code validation, expenses entry and refund/dispute management remain a separate release. Do not claim the legacy checkout is secure or payments ready.
- Real email provider delivery, custom domains, subscription management, downloadable media kits and additional service/portfolio templates: planned.
- Merchant connected payments: researched, not activated; see `PAYMENT-ARCHITECTURE.md`. Provider eligibility/approval, account model and sandbox tests are blockers.

## Release sequence (not executed)
1. Finish the missing emulator and authenticated integration tests on a test project with Java 21+. Audit all deployed Firestore and Storage permissions, including existing order/product/customer/user paths.
2. Add production rule changes without destroying legacy data access; verify owner/other-owner/anonymous cases. Review public projections for old websites and category defaults.
3. Configure App Check and any notification/payment providers. No live payments until approved and fully tested.
4. Test representative salon, restaurant, store and portfolio journeys on Laptop/iPad/Phone with touch and keyboard.
5. Review remaining partial features against the chosen release scope; keep unsupported workflows visibly unavailable.
6. Only after the user's later instruction: push the local commits together to the development branch. Production deployment remains separately approval-gated by the original request.

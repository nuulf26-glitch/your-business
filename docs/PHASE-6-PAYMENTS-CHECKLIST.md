# CYB Phase 6 — Fix All Payments

## Approved scope recovered from CYB planning records

Phase 6 has two distinct payment systems:

1. **CYB platform billing:** preserve the existing one-time $246 USD lifetime access checkout after its approved 14-day trial. No monthly or recurring billing, inaccurate price copy, repeat charges, or client-side activation. Payment verification and activation remain server-side.
2. **Merchant storefront checkout:** accept only methods backed by a configured, supported provider; keep merchant funds separate from CYB platform billing; verify payment server-side; create orders correctly; display success and failure accurately; make callbacks/retries/cancellations safe; never present unsupported methods as working.

The 46-stage plan separately records merchant card and wallet methods as disabled until account-specific provider approval and end-to-end configuration are complete. COD remains available. The current project instruction postpones Stripe integration and prohibits changing the $246 checkout, so this branch does not modify either area.

## Implemented in this branch

- [x] Add a required high-entropy idempotency key to merchant storefront checkout requests.
- [x] Scope idempotent order IDs to the owning business, so identical keys in different stores do not collide.
- [x] Store only a request digest and a hash of a separate random customer action token; do not persist either raw token.
- [x] Return the original order on an identical retry, without reserving stock or updating customer order counts a second time.
- [x] Reject a retry that reuses a key with changed checkout details or a different customer action token.
- [x] Keep COD status unpaid until the order is collected, and preserve the existing idempotent COD confirmation path.
- [x] Add regression and isolated API E2E coverage for retries and tenant scoping.
- [x] Avoid schema changes and database migrations.

## Deferred / blocked

- Merchant card/wallet integration, provider onboarding, and settlement routing remain disabled pending the user's instruction to resume Stripe work and required provider eligibility/configuration.
- CYB platform billing is intentionally unchanged by this branch; no lifetime price, trial, provider, or checkout behavior was altered.
- No payment processing success is claimed for methods that CYB does not currently support.


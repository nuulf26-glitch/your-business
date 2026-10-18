# GetCyb business website support

The existing visual styles, fonts, colours, editor layout and dashboard metrics are retained. New controls reuse existing components/classes; only new booking controls have scoped styles.

## Implemented

- The existing setup cards now select Online Store, Salon & Services, Restaurant & Café, Portfolio, Company & Startup, or Showcase / Coming Soon.
- Fresh websites receive relevant editable sections. Existing designs are retained. Website purpose can be changed without resetting sections, and every section remains available to every business.
- Restaurant menus retain editable item names and prices; portfolios use uploaded galleries and project captions; companies use service sections and their own contact email.
- Published navigation and hero actions follow the website purpose. Non-commerce sites do not show a shopping cart or an automatic catalogue.
- Booking properties configure services, USD prices, durations, weekdays, opening hours, slot intervals and business timezones.
- Customers request available appointments on published websites. Owners view requests and confirm, complete or cancel them at `/appointments`.
- Server transactions reserve every UTC calendar day touched by a booking, preventing overlap across services, sections and timezones. Retried requests are idempotent. Cancellation releases reservations. This version uses a single shared calendar per business, rather than separate staff calendars.
- Availability responses contain no customer details. Listing and changing appointments require Firebase authentication and verify ownership.
- Drafts are stored separately from the published design, and local editor drafts are scoped to the signed-in user. Store updates merge instead of discarding editor data.

## Validation

`npm run build`

`node --test functions/test/*.test.js`

Tests exercise slot duration, overlap, closing hours, business timezones, daylight saving gaps, invalid dates, booking horizon, idempotency, competing booking requests, owner authorization and cancellation. Handler tests use a serialized transactional datastore test double; they do not replace verification against deployed Firebase. Visual browser QA has not been performed.

## Release requirements

The Firebase CLI is not authenticated in the editing environment. The new booking functions have therefore not been deployed. A connected Firebase project is needed before publishing the frontend with live bookings.

1. Read the project's deployed Firestore rules first. `appointments` and `appointmentDays` must deny all direct browser reads and writes; the Admin SDK handlers are the only access path. Remove or narrow any broad allow-all rule that would override these restrictions. Preserve and test rules for all existing collections. No deployed rules were available in this checkout, so no replacement rule file is supplied or deployed blindly.
2. Deploy the four new functions from the existing project: `firebase deploy --only functions:appointmentAvailability,functions:createAppointment,functions:listAppointments,functions:updateAppointment --project your-business-47e44`.
3. Deploy the frontend using the site's existing hosting pipeline. The default function base URL points to this Firebase project; `VITE_FUNCTIONS_BASE_URL` may override it for a test environment.
4. In a test account, select Salon & Services, configure a real service and hours, publish, and request a booking from a signed-out browser. Verify owner confirmation, cancellation and concurrent requests.

No booking email or SMS delivery is claimed: the customer sees an on-screen reference and the owner sees the request in Appointments. The booking confirmation screen states that the customer should contact the business for changes and confirmation.

## Payments still require merchant setup

The existing store payment implementation is unchanged. Direct settlement to each store owner is not connected by this change, and the existing PayPal placeholder must not be presented as a live payment integration. The next step needs the chosen provider's marketplace/onboarding configuration and verified merchant accounts. No platform payment credentials are reused to pretend to settle funds to independent merchants.

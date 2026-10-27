# Client slot selection and details flow

Implemented for the Booking demo on 2026-10-26.

## Behaviour

- Published services now appear before the calendar. Private service selection carries into the details URL and summary. Shared classes are listed without bookable times until scheduling is implemented.
- With no published services, the empty catalogue keeps the original slot-only demo available.

- The public API filters to open slots and returns date/time without a status field. These slots are keyboard-accessible buttons. Explicit open status is also accepted; explicit taken or unknown statuses cannot be selected.
- Selecting an open slot highlights it without leaving the calendar. A bottom button shows the selected day, date and time (for example, Book Tuesday 27 October at 10:00). Only clicking this button navigates to /:biz/details?date=YYYY-MM-DD&time=HH:mm.
- The button is disabled until a time is selected. Switching days clears the selection. Availability refreshes preserve a selection while it remains available, clear it if the slot disappears or becomes unavailable, and disable continuing if the refresh fails.
- The details page shows the selected date/time and collects name, surname, phone, email, and optional notes.
- Required fields are validated, and availability is fetched when the page opens and again before payment.
- In the original slot-only demo, Continue to payment opens the existing Paystack page at https://paystack.shop/pay/o495iejvn3. For catalogue-selected services, payment is disabled until the listed amount is connected to checkout; an explanation is shown.
- First name, last name, and email use Paystack's documented prefill URL parameters.
- The calendar no longer provides a payment shortcut that skips selection and details.

## Current demo limitations

This is the frontend flow only. Details are saved to sessionStorage for the selected business/date/time in the current browser tab. Phone and notes are not sent to Paystack or saved to Supabase. Opening checkout does not reserve a slot, record a confirmed booking, or update the admin calendar. Availability rechecks do not provide a database lock. Payment verification and atomic reservation handling remain a separate backend step.

The user supplied the current Paystack link as the live payment page. The page contents and a payment transaction have not been tested in this session.

## Verification

Run `node tests/client-booking-flow.cjs` with Node.js. This dependency-free suite exercises the calendar and details scripts with mocked DOM/network/storage, including selection, validation, checkout prefills, unavailable-slot races, and network/storage failures. JavaScript syntax was also checked.

Browser rendering and a complete hosted checkout have not been verified in this session.

Paystack prefill reference: https://support.paystack.com/en/articles/2129218

## Availability regression fixed

Verified get_public_page in Supabase: it filters availability.status = 'open' and omits status from the returned slot objects. The original frontend flow incorrectly required slot.status === 'open'. Both selection and details rechecks now accept omitted status, matching the public API contract. Regression tests use the actual date/time-only response and still reject explicit taken/unknown statuses and slots absent from the returned list.

## Client branding and social links (2026-10-27)

- All client calendar, details and admin pages use `logtraq-favicon.svg`, a compact, transparent version of the existing symbol. Page titles and the business name are unchanged. The client and admin calendars keep this favicon when the business logo loads; the avatar and installed-app icons retain their existing images.
- Optional TikTok profile links are stored in `public.businesses.tiktok_url`, alongside Instagram and Facebook, and returned by `get_public_page`.
- The TikTok icon stays hidden until a valid HTTPS link on tiktok.com or one of its subdomains is saved for the business. Clearing the field hides the icon again. No sample TikTok profile is saved.
- The database change is recorded in `supabase/migrations/20261027125000_add_tiktok_url.sql`. It preserves the public slot contract: only available slots, with date/time and no status field.
- Chromium checks verified transparent favicon pixels, unchanged tab title, conditional TikTok visibility and rejection of invalid destinations. The client booking flow regression suite also passed under Node.

## Admin catalogue navigation (2026-10-27)

- The existing admin URL now has Calendar and Services navigation: a left sidebar on desktop and a compact horizontal menu on mobile.
- Navigation is revealed after the existing admin lookup succeeds. Section links use #calendar and #services, support browser Back/Forward, and preserve the business/key URL and current calendar state.
- Services is an empty layout only. Add service is disabled with a visible coming-soon explanation; no service form, storage, or sample offerings are implemented.
- Calendar rendering and slot update requests retain their existing logic. Client pages, Paystack checkout, and the public slot API contract are unchanged.
- Admin styles are isolated in admin.css. The next step is agreeing on service fields, then implementing the form and business-scoped Supabase storage.

Validation for this layout: JavaScript syntax checks and a Node-based mocked-DOM check passed for navigation, focus, direct section links, calendar preservation and slot requests, query-format admin links, and denied/incomplete/offline access. Local Edge automation could not start, so desktop/mobile rendering was not visually verified in this session.

## Admin service creation and editing (2026-10-27)

The empty Services layout described above has now been extended with a working service list and add/edit form, backed by business-scoped Supabase storage. It supports private appointments and shared classes, hours/minutes, fixed ZAR prices per booking/person, private-booking participants and saved catalogue visibility. New services default to hidden.

This is catalogue step 1 only: client catalogue display is not yet connected. Class capacity and service-specific availability belong to later steps. Client booking, the date/time-only public slot contract and real Paystack checkout are unchanged.

See docs/PROJECT_HANDOFF.md and AGENTS.md for the agreed sequence and the owner's instruction to stay on the current step even when questions explore later features. The migration is supabase/migrations/20261027140653_add_admin_service_catalogue.sql.

The admin service test suite, transactional database integration tests and existing client booking regression suite passed. Local browser rendering and an actual browser-to-REST save remain unverified.

## Client catalogue (2026-10-27)

Catalogue step 2 is implemented. The client list reads published services through get_public_page; its nine-field service whitelist excludes admin/internal fields and services belonging to another business. The public RPC is now an invoker wrapper around a private implementation with a pinned search path. The existing available-slot date/time contract is preserved.

Cards show business-configured descriptions, durations, booking type/people, prices and per-person group totals. Private-service IDs carry through calendar selection into details, where current service data is fetched again. Hidden/missing/cross-business/class IDs are rejected. Selected service changes clear the chosen time; hiding a service clears the selection.

This step does not implement service-specific availability, scheduled class capacity, reservations or payment matching. The calendar labels its existing times as general availability, and selected-service checkout is guarded until the correct amount can be charged. Businesses with no published services retain the original real-Paystack demo. No sample services were added.

Migration: supabase/migrations/20261027142033_publish_client_service_catalogue.sql.

Verification: the expanded client booking suite, catalogue database integration tests and existing admin-service database tests passed. Fixtures were rolled back. Desktop/mobile browser rendering and browser-to-REST interactions remain unverified in this environment.

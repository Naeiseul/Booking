# Booking project handoff

Updated 2026-10-27.

## Working agreement and persistent project memory

The owner explicitly requested that we stick to the agreed steps regardless of the direction of their questions. Questions can clarify the current work; do not treat them as permission to jump ahead. Change the sequence only when the owner explicitly changes the plan.

Work one small step at a time, functionality first. Complete verification, save changes to GitHub, deploy completed fixes to the live demo, and verify the release before reporting completion. See root AGENTS.md.

## Agreed catalogue sequence

1. Admin service creation and editing, saved in Supabase.
2. Client catalogue displaying the business's published services and carrying the selected service into the booking flow.
3. Service-specific availability: full-duration private appointments without overlap, and scheduled shared classes with capacity.
4. Database reservations, booking records, double-booking/capacity enforcement, and automatic admin updates.
5. Real Paystack checkout tied to the reservation and correct amount, server-side payment verification, and release of abandoned/failed reservations.

Steps 1 and 2 are implemented. Steps 3–5 remain pending; do not advance without the owner's instruction.

## Step 1 implementation

- Admin > Services supports loading, adding and editing business-owned services.
- Fields: name, optional description, private appointment/shared class, hours and minutes, fixed price in ZAR, price per booking/per person, private-booking participants, and catalogue visibility.
- Duration is stored in minutes and price in integer cents. Hours/minutes supports 1h30m = 90 minutes.
- Shared classes charge per person and do not store capacity on the service. Scheduled-class capacity belongs to step 3.
- New services default to hidden. The client catalogue added in step 2 now displays published services.
- No deletion, hourly/overtime charging, packages, scheduling, or payment changes in this step.
- public.services has RLS enabled and no direct anon/authenticated table privileges.
- Public get_admin_services/save_admin_service are SECURITY INVOKER wrappers. Private implementations verify the existing business slug/admin key and active flag before every access. Updates also match business ownership and updated_at to reject stale edits.
- This reuses the demo's admin-link authentication model; it does not introduce Supabase Auth. SECURITY DEFINER is confined to the private schema because the existing client has no user JWT identity to use in auth.uid()-based policies. All new functions pin search_path and narrow execute grants.
- Creating a service reuses a browser-generated UUID on retry, avoiding duplicates after a lost response.
- Calendar and service scripts are separate so a service-loading failure does not prevent calendar use.
- Migration: supabase/migrations/20261027140653_add_admin_service_catalogue.sql, matching the recorded remote migration version.

## Step 2 implementation

- The existing client URL now displays published services as a mobile-friendly list: name, description, duration, private-booking people/shared-class type, price basis, and private-group total when priced per person.
- get_public_page now includes a services array containing nine explicit client-facing fields. Hidden services, other businesses' services, admin keys, business IDs and internal timestamps are excluded. Missing/inactive businesses return null.
- Public get_public_page is now a SECURITY INVOKER wrapper with a pinned search_path; its privileged read implementation lives in private. Existing business/social fields and date/time-only available slots are preserved.
- Selecting a private service reveals the existing general-availability calendar. Its ID travels in the details URL, and the details page fetches current service information from Supabase rather than trusting names/prices in query parameters.
- Per-person private bookings show the total for the configured number of people. 90 minutes displays as 1 hr 30 min.
- Polling refreshes catalogue edits without replacing unchanged catalogue buttons. Removing/hiding a selected service clears it; changing its information clears the selected time.
- Browser Back links preserve the selected service. Invalid, hidden, cross-business or shared-class service IDs cannot open the details form. With published services present, a service-less details URL cannot bypass service selection.
- No published services: show an honest empty catalogue and preserve the original slot-only real-Paystack demo. No sample services were created.
- Scope boundary: service-specific duration-aware availability is step 3. The calendar explicitly labels current times as general availability. Shared classes are listed but cannot select times until class scheduling exists.
- Scope boundary: Paystack service amount alignment is step 5. For a selected service, Continue to payment is disabled with an explanation; it cannot send a client to a checkout with an unrelated amount. The original no-catalogue slot-only demo continues to open the actual supplied Paystack URL. No simulated checkout was introduced.
- Migration: supabase/migrations/20261027142033_publish_client_service_catalogue.sql, matching the remote migration version.

## Verification

- node tests/admin-services.cjs: form create/edit/reload, 90-minute duration, cents conversion, visibility, class fields, validation, preserved input on failure, duplicate-submit prevention, idempotent retry, stale edit error, safe text rendering, and HTML labels/script order.
- tests/admin-services.sql: integration tests ran on the target database under anon and authenticated roles. Verified create/read/edit, ownership isolation, wrong/inactive keys, table-access denial, validation, retry idempotency, stale edits, and the public slot response contract. All fixtures were rolled back; no sample services remain.
- node tests/client-booking-flow.cjs: existing suite and new catalogue cases passed, including service selection, per-person totals, stale/removed services, safe text rendering, back links, service payment guard, date/time-only slots and the unchanged real Paystack destination for the slot-only demo.
- tests/client-catalogue.sql: passed on the target database under anon/authenticated roles; published-only filtering, business isolation, field whitelist, sort order, inactive/missing businesses, fresh admin data and original slot contract. Fixtures were rolled back.
- Security/performance advisors checked. New services RLS-without-policy notice is intentional: direct table grants are revoked and access is through credential-checked RPCs. Existing admin calendar function warnings predate this change. The public-page warnings were resolved by the private implementation added in step 2. Performance advisors returned no findings after step 2.
- Local browser automation was unavailable. Rendering at desktop/mobile sizes and an actual browser-to-REST save were not verified in this environment. Live page/asset and Vercel deployment checks are performed when releasing.

## Project and runtime

- Repository: https://github.com/Naeiseul/Booking; production branch: main.
- Client: https://booking.logtraq.co.za/logtraq
- Admin: https://booking.logtraq.co.za/admin/logtraq/logtraq
- Frontend is plain HTML/CSS/JavaScript. No application package install/build is required.
- Vercel project booking: prj_2qzF3xJp1pPt3VO16mNgdVYHQTUV; team: team_ORAa7CrGuWI7XCatgWzEsosW. Git integration deploys main.
- Supabase project: jtonmfevmcmnkmdjmubn.
- Connected GitHub, Supabase and Vercel tools are available in this desktop session. Local Git is unavailable; current local file work uses the writable temporary directory. Remote GitHub contents are authoritative.
- Never read/print the tracked .env or expose credentials in logs. Do not assume previous cloud environment credentials or processes are present on this device.

## Preserve the existing client demo

get_public_page returns only available slots as date/time objects without a status field. Do not require status === 'open'. Preserve fix 7d2cd5bb5afea8048d227dfddbea7377a0c95cc0.

With no published services, the original calendar selects a slot; a separate button opens the details form; Continue to payment has no arrow and opens https://paystack.shop/pay/o495iejvn3. For catalogue-selected services, the payment action is guarded until step 5. Keep the real checkout; never replace it with a simulation.

Client details remain in the browser tab. Database reservations, payment verification and automatic admin booking updates are not implemented. A service save is not a booking.

## Completed client flow, social links and tab icons

- Client slot clicks select and highlight a time without leaving the calendar. A bottom button shows the selected day/date/time and opens the details form only when clicked. Switching days clears the selection; availability polling preserves a valid selection and disables continuing when availability cannot be checked.
- Optional TikTok links are stored in public.businesses.tiktok_url and included in get_public_page. The client TikTok icon is hidden until a valid HTTPS TikTok URL is saved, and hides again when the field is cleared. No demo TikTok URL was inserted; the owner is creating an account.
- TikTok migration: supabase/migrations/20261027125000_add_tiktok_url.sql. Applied to the connected Supabase project and verified: tiktok_url is nullable text, the public response includes it, and slots still omit status.
- Client calendar, details form and admin dashboard share /logtraq-favicon.svg?v=1. It contains the existing symbol with a transparent backdrop. Loading a business logo does not replace the tab icon. Page titles/business names, page avatars and installed-app icons retain their existing behaviour.
- Saved release commits: 2e3677cfbc5724df21003aebeff8fc07e8de030c (slot confirmation), 81375a77a3aa192a0a3ab27c61b1da168332a5dd (TikTok and transparent client icon), 707efa897ac3b44e9eef3b73b334b7d99a61b7be (shared icon across admin/client).
- Release verification: Node client booking regression suite passed. Chromium checks verified the transparent client icon, unchanged client/details titles, TikTok visibility with/without a valid link, rejected invalid destinations, and selection/details navigation. Admin/client script checks verified that logo loading preserves the shared tab icon and existing titles.
- All three releases were saved on main and deployed to production. The final icon release was READY and aliased to booking.logtraq.co.za; live admin, client, details HTML and both calendar scripts matched the saved code. These checks describe those releases; later admin catalogue work has its separate verification above.
- Detailed behaviour is recorded in docs/client-booking-flow.md. Use the current main handoff and working agreement when resuming; older handoff branches describe earlier project states.

## Next step

After the owner reviews the catalogue, discuss and authorize step 3: duration-aware private appointment availability and scheduled shared classes with capacity. Do not automatically advance to reservations or payments.

## End-of-day resume notes — 2026-10-27

The owner requested saving memory and a prompt for the next day's chat. The catalogue was released in commit 4ce1f9050340ac07e080e4d3731e4b5c0f9a7526. Vercel production deployment dpl_8KDzSLiNQUkkKFWdEJZ48V8bLLXN was READY. The live client HTML, app.js, details HTML, details.js and styles.css returned HTTP 200 and matched that commit.

The final read-only Supabase check found zero published services for logtraq. This is a dated observation: check again when resuming, because the owner may add services. Do not insert invented business offerings. The owner can add a real service in Admin > Services and enable Show in client catalogue.

Begin the next chat by reading AGENTS.md, this handoff and docs/client-booking-flow.md on current main. Verify connected GitHub, Supabase and Vercel access with read-only checks. Confirm current state and review the catalogue before changing code. Then agree on the smallest part of step 3 to implement, starting with how a private service's full duration fits the business's availability. Class scheduling/capacity follows within step 3. Do not jump to reservations or payments because a question mentions them.

Pending verification: actual desktop/mobile browser rendering and browser-to-REST interactions were not verified here. Prioritize checking the owner-created service from admin through the client catalogue when browser access is available.

Keep the real Paystack page. Selected-service payment stays disabled until the correct amount is connected in step 5; the original slot-only demo remains real checkout when there are no published services.


## Business call icon — 2026-10-28

The owner confirmed whatsapp_number is the business phone number and supplied phone.png. The client header now displays that handset image next to social links when a valid business number is returned. It opens tel: with formatting removed. Polling updates the destination and hides/clears the icon when the number is removed or invalid. No separate number field or schema change was needed. The footer's existing platform contact remains separate.

Validation: JavaScript syntax and isolated DOM checks passed for international/local formatted numbers, empty/missing/invalid values and removal after display. Browser rendering and an actual device dialler remain unverified. Step 3 still awaits agreement; no scheduling, reservations or payments changed. The TikTok issue was diagnosed separately: the saved URL lacked https://; it has not been changed.

# Booking project handoff

Updated 2026-10-28.

## Latest resume state — 2026-10-28 (read before older notes)

### Current working agreement

- Client-facing work ONLY. Do not edit admin or backend unless the owner explicitly requests it. Existing client Supabase reads remain; new Supabase integration/features are postponed.
- Focus on the client shell for preselling, one small agreed edit at a time. The owner thinks visually and wants concise explanations (about 100 words per step), saying what changes in the frontend, what the backend needs, and one clear next action.
- Discuss the next small edit before changing anything. Questions are exploration, not permission to expand/reorder work. Complete authorized changes, save to GitHub, deploy to production, and verify affected live assets.
- The owner rejected the separate sales demo. Its files/route were removed in commit 73fc7a2b3fb274679e819fd5b2d3d15af0c9b6e6. Never restore/reuse/republish it unless explicitly requested.
- Visual reference: a McDonald's kiosk catalogue with narrow sidebar and compact picture-led menu cards. Adapt the structure to booking, not its branding. Do not invent actual business offerings.

### Current client UI

- Live client: https://booking.logtraq.co.za/logtraq
- Existing background gradient shows through; no large white page panel. Phone icon has a transparent background. Phone and TikTok links use saved business data; scheme-less TikTok domains are normalized to HTTPS.
- Sidebar now represents booking STEPS, not categories: Choose a session; Choose date & Time; Checkout. The capital T in Time was explicitly requested. All/group/private/class category tabs were replaced, not retained as hidden filters.
- Desktop: narrow 144px sidebar close to content. Mobile (700px and below): sticky horizontal scrolling row, separated buttons with bold borders and useful touch targets. Client pinch zoom is enabled.
- ALL three step boxes stay black with white text, even on hover. The selected step has a muted silver border and Current step label. The label is centred, small italic Georgia/serif in muted silver. aria-current=step follows the active panel. No animated shine.
- Choose a session: existing published service cards with neutral photo areas and service details. Empty catalogue has an honest non-interactive No services added yet card. No real service records or business photos were added. Photo upload remains future work.
- Choose date & Time: existing calendar/selection logic, now always showing the next seven LOCAL dates even with no openings, plus any further dates provided by real availability. Empty days say No available times for this date. No bookable times are fabricated. Selection persists across steps/polling; changing days clears the time.
- The black/white Select a time to book button stays below the panels and visible across all steps. Do not remove or hide it when styling/navigation changes. It stays disabled until a valid real selection and updates its label when a time is selected; its existing details navigation is retained.
- Checkout: explicitly unconnected placeholder. No cart/multi-service checkout implemented in the retained client. The owner discussed adding multiple services without leaving the catalogue, but a new implementation must be agreed separately.
- Removed copy: Select an available time to continue; Our services heading; Services will be listed here soon. You can view available times below. Do not silently restore these.
- Shared classes and duration-aware availability are still unfinished. Original numbered plan: admin services and catalogue implemented; step 3 duration/class scheduling/capacity; step 4 reservations; step 5 real verified Paystack payments. Client-shell work is currently the explicit priority before resuming that plan.

### Data and payment constraints

- Last read-only check today found zero available public slots. Earlier check found no services. Recheck only if relevant; these are dated observations, not permanent assumptions.
- Public slots contain date/time without status. Never require status === 'open'; retain date/time-only selection.
- Keep the real supplied Paystack destination and existing no-catalogue details flow. Service-specific payment remains disabled until correct pricing is connected. Never simulate payments.
- Do not modify business data or insert sample services to fill the shell.

### Release and verification

- Latest UI release before this memory save: f4e885d97b26c9964dc9a2290001d6810943b194, Vercel dpl_D6jPCvCfTYz8HjbQcohPTJTp2eWR READY. Client HTML and catalogue.css?v=6 matched saved files.
- Date-picker release: 6b8f11c841a2e5db2230bfa6a3f37eccf807d4a0, verified live. In-memory DOM checks exercised seven empty dates, no fabricated times, preserved empty-day polling, real date/time-only selection, step navigation and clearing time on day changes.
- Navigation/current-step/card interactions had isolated JS checks. Local shell execution is rejected by environment policy; full Node regression suite and actual desktop/mobile browser rendering remain outstanding. Do not claim end-to-end browser verification.
- Connected GitHub/Supabase/Vercel tools worked. Use current main as authority; avoid .env/credentials. Repo/project identifiers are in Project and runtime below.

### Start tomorrow

Read AGENTS.md, this latest section and docs/client-booking-flow.md on current main. Confirm the client state and preserve all owner preferences above. The owner should review the latest client shell first; discuss the next small edit before changing code. Likely topic is the compact picture-led kiosk card grid, but it is not automatically authorized. Do not jump to admin, Supabase, duration scheduling, reservations, cart or payments. Browser verification remains pending.

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


## Admin contact parity — 2026-10-28

The owner reported phone/TikTok missing from admin. Admin previously rendered only Instagram/Facebook, and get_admin_page omits phone/TikTok fields. Added the same phone.png and TikTok markup to admin with a separate admin-contacts.js script that reads the public get_public_page response and refreshes every three seconds. It never changes admin calendar state or sends the admin key to the public RPC. Contact failures are isolated from scheduling/services. No database changes.

Client and admin TikTok validation now accepts a scheme-less TikTok domain by adding https://, while still rejecting non-TikTok and non-HTTPS destinations. The saved tiktok.com/@logtraq value therefore works without editing business data. Phone uses whatsapp_number, confirmed by the owner as the business contact.

Validation: JavaScript syntax checks passed; contact rendering checked with a mocked URL parser and DOM. Actual browser URL parsing/rendering/dialler testing remains outstanding. Catalogue review/step 3 remains pending.


## Client catalogue menu — 2026-10-28

The owner explicitly paused availability planning to design intuitive client browsing first. Authorized small edit: a narrow persistent desktop category sidebar and a sticky, horizontally scrollable mobile category row, with an active highlight. Categories: All, Group sessions, Private sessions, Classes. Cart behaviour was discussed but is not implemented or authorized as part of this edit. Continue designing the client experience in small agreed edits before returning to duration-aware availability; do not advance to reservations or payments.

Categories use existing published service fields: class maps to Classes; private services for more than one participant map to Group sessions; other private services map to Private sessions. No invented offerings or database changes. Empty categories display an honest message. All preserves the existing empty-catalogue slot-only demo; choosing an empty category does not show unrelated legacy times. Category changes preserve an existing service/time selection. Availability polling preserves the category and does not replace unchanged service buttons. Client-only catalogue.css isolates layout changes from admin/details pages.

Verification: JavaScript syntax and isolated catalogue rendering checks performed. Local shell/Node execution is rejected by the environment policy, so the existing Node regression suite and desktop/mobile browser checks could not run here. Verify production release and affected live assets before reporting deployment complete.


## Catalogue card skeleton — 2026-10-28

Authorized client-only edit: service cards with a neutral photo placeholder above real service details, responsive grid on desktop and stacked cards on mobile. Existing service selection buttons retain their behaviour; no cart action is implied. Empty categories display a non-interactive card labelled No services added yet so the layout is visible without invented offerings. No sample service records were created.

Backend: existing get_public_page published service fields supply text. Photo uploads, Storage configuration, image fields and cart behaviour remain future agreed steps. No schema or payment changes. The owner wants concise updates (about 100 words per step) explaining frontend, backend and the next small step. Prioritize the client skeleton before scheduling.

Validation: JavaScript syntax and isolated card rendering checks; live deployment/assets checked at release. Actual browser rendering and the full Node suite remain unverified because local command execution is unavailable.


## Frontend presale shell — 2026-10-28

The owner explicitly requested postponing Supabase/backend work and building the frontend shell for preselling. A separate /demo route now provides a polished sample catalogue, persistent desktop category menu and mobile row, service photo placeholders, add-to-cart feedback, quantities, totals/removal and an accessible native cart dialog. Mobile has a persistent View cart bar after adding. Cart data is in memory only and clears on reload. Sample service names/prices are clearly labelled as examples; they are not Logtraq offerings or database records.

No Supabase/network booking/payment calls occur in the demo. Booking/checkout is visibly disabled with an explanation. Existing live client/admin and real Paystack flow remain separate and unchanged. Future work should stay on the client shell in small agreed steps; backend connection, scheduling, reservations and actual checkout follow later. Communication preference: about 100 words per step, explain frontend/backend and one next action.

Validation: JavaScript syntax and isolated category/cart interaction checks; production assets checked on release. Actual desktop/mobile browser rendering remains outstanding. No live transactions or invented business offerings were inserted.


## Discarded sales demo — 2026-10-28

The owner explicitly rejected the standalone sales demo and instructed us to discard it and prevent accidental future pushes. demo.html, demo.css, demo.js and the /demo rewrite have been removed. Do not restore, reuse, or republish that design unless explicitly requested by the owner. The earlier client catalogue/category menu and card skeleton remain. No replacement design is currently authorized. Stop and agree on the next small client edit before building anything further.


## Transparent page panels — 2026-10-28

The owner requested removing the white background from both client and admin, retaining the existing background colour. The shared client/admin outer page panels now have transparent backgrounds, no borders and no shadows. Admin sidebar and client category-menu panels are transparent too. Existing gradient, spacing, controls, service cards and backend behaviour are preserved. CSS-only change; no database work or rejected demo restoration. Actual visual browser verification remains outstanding; affected live styles checked at release.


## Transparent phone icon — 2026-10-28

Removed the white background from the supplied handset image using image editing with transparent output. Replaced shared phone.png and changed both client/admin image URLs to /phone.png?v=2 to refresh cached copies. Phone number logic and backend are unchanged. Production icon/page assets checked on release; actual browser rendering remains outstanding.


## Compact client sidebar — 2026-10-28

The owner confirmed client-only work, referenced a kiosk menu catalogue and authorized fixing the sidebar first with mobile support. Client category navigation now uses a narrow 144px desktop column attached to the content with a subtle divider, compact category rows and an accent edge for selection. At 700px and below it becomes a sticky horizontal scroll row with 48px touch targets and an active underline. The mobile wrapper has no extra inner side padding, preserving useful catalogue width; overflow is contained to the menu. The existing background remains. Client pinch zoom is enabled. Category filtering/cards are unchanged; no admin/backend work and no rejected demo reuse.

Current preference: concise updates around 100 words, frontend/backend distinction, one small agreed change at a time. Next: review the sidebar before changing cards toward the compact picture-led kiosk grid. Supabase enhancements remain postponed. No new cart/scheduling/payment work is authorized.

Verification: static CSS/viewport checks and live release asset comparison. Actual desktop/mobile browser rendering remains outstanding because no browser automation tool is available in this session.


## Remove All category — 2026-10-28

Client-only request: removed All from the category menu. Group sessions is the initial active category; Private sessions and Classes remain. Returning via a service link selects that service's matching category. Existing empty-catalogue slot-only demo is retained. No admin/backend changes. Syntax/static checks and live assets verified; browser rendering remains unverified.


## Remove client instructional copy — 2026-10-28

Removed the successful-load instruction Select an available time to continue, plus the catalogue heading and introductory/empty-list message above the cards, as requested. Category menu and card empty state remain. Client error messages still appear when needed; the status element is hidden on successful loads. Replaced the section's removed heading reference with an accessible Services label. No admin/backend changes. JavaScript syntax and reference checks passed; live assets verified on release. Browser rendering remains outstanding.


## Client booking-step menu — 2026-10-28

The owner requested replacing sidebar labels with session selection, date/time selection and checkout. Navigation is now Choose a session, Choose date & time, Checkout. These are actual frontend section switches, no longer service category filters. Session view displays all published services, with existing empty card when none exist. Date/time view retains the existing general calendar and details navigation. Selecting a private service opens date/time; links returning with a service also restore that step. Navigation/polling preserve selected service/time. Checkout is an honest unconnected placeholder; no payment simulation, new backend, reservations or admin work. Existing real Paystack details flow remains unchanged and service-specific payment stays guarded.

Validation: JavaScript syntax and isolated step-navigation checks; production assets compared at release. Actual browser rendering remains outstanding. Continue client-only shell work in small agreed edits and keep explanations concise.


## Boxed client step buttons — 2026-10-28

At the owner's request, capitalized Time in Choose date & Time and separated the three sidebar/mobile navigation buttons with gaps and bold 3px borders. Active buttons retain the teal highlight/border. Client HTML/CSS only; no admin/backend or navigation logic changes. Live assets verified after deployment; visual browser check remains outstanding.


## Neutral client navigation/action — 2026-10-28

Replaced the selected step's green highlight with black fill, white text and black border. Inactive step boxes retain their transparent background and now use black borders; keyboard focus uses a neutral grey outline. The client Select a time to book button also uses black fill/white text, including its initial disabled appearance; disabled behaviour is unchanged. Client-only CSS/cache-version edit; no admin/backend change. Live assets verified on release; visual browser check remains outstanding.


## Permanent black step tracker — 2026-10-28

The owner wants all step boxes permanently black with white text, including on hover, with a separate clear current-step signal. The active box now has a muted silver border and visible Current step label; inactive boxes reserve that label space to avoid layout jumps. aria-current=step tracks the active section for assistive technology. No animated shine. Existing responsive navigation and black booking action remain. Client HTML/CSS/state annotation only; no backend/admin changes. Live files verified on deployment; visual browser verification remains outstanding.


## Keep bottom booking button visible — 2026-10-28

The owner clarified the Select a time to book button must remain visible, not disappear with the date/time panel. Moved the existing button below the three step panels within the client content column; retained its ID, black/white styling and existing selection/availability disabled checks and details navigation. Do not hide/remove this bottom action when changing steps. No backend/admin changes.


## Date picker without openings — 2026-10-28

The owner authorized showing dates even when no times are available. Choose date & Time now always lists the next seven local calendar dates, plus any additional dates supplied by the real slots API. Selecting an empty day shows No available times for this date. No times are invented and the bottom button remains disabled until a real available slot is chosen. Empty-day selection persists through polling; day controls are keyboard-accessible buttons with aria-pressed/full-date labels. Real slot-only date/time responses, selection/details navigation and shared bottom button remain intact. Client JavaScript only; no backend/admin changes.

Validation: syntax plus mocked-DOM flow checks for empty dates, refresh preservation, real slots, step navigation and selection clearing. Live files verified after release; actual browser rendering remains outstanding.


## Current-step label typography — 2026-10-28

Centred the client Current step label and changed it to a small italic Georgia/serif font, distinct from the main button text. Existing muted silver colour and active visibility remain. Client HTML/CSS cache version only; no backend/admin changes. Live assets verified after deployment; browser visual check remains outstanding.

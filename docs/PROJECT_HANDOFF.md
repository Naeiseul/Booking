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

Steps 2–5 remain pending. Do not implement them as part of step 1.

## Step 1 implementation

- Admin > Services supports loading, adding and editing business-owned services.
- Fields: name, optional description, private appointment/shared class, hours and minutes, fixed price in ZAR, price per booking/per person, private-booking participants, and catalogue visibility.
- Duration is stored in minutes and price in integer cents. Hours/minutes supports 1h30m = 90 minutes.
- Shared classes charge per person and do not store capacity on the service. Scheduled-class capacity belongs to step 3.
- New services default to hidden. Visibility is stored now; the client catalogue is step 2 and is not yet connected.
- No deletion, hourly/overtime charging, packages, scheduling, or payment changes in this step.
- public.services has RLS enabled and no direct anon/authenticated table privileges.
- Public get_admin_services/save_admin_service are SECURITY INVOKER wrappers. Private implementations verify the existing business slug/admin key and active flag before every access. Updates also match business ownership and updated_at to reject stale edits.
- This reuses the demo's admin-link authentication model; it does not introduce Supabase Auth. SECURITY DEFINER is confined to the private schema because the existing client has no user JWT identity to use in auth.uid()-based policies. All new functions pin search_path and narrow execute grants.
- Creating a service reuses a browser-generated UUID on retry, avoiding duplicates after a lost response.
- Calendar and service scripts are separate so a service-loading failure does not prevent calendar use.
- Migration: supabase/migrations/20261027140653_add_admin_service_catalogue.sql, matching the recorded remote migration version.

## Verification

- node tests/admin-services.cjs: form create/edit/reload, 90-minute duration, cents conversion, visibility, class fields, validation, preserved input on failure, duplicate-submit prevention, idempotent retry, stale edit error, safe text rendering, and HTML labels/script order.
- tests/admin-services.sql: integration tests ran on the target database under anon and authenticated roles. Verified create/read/edit, ownership isolation, wrong/inactive keys, table-access denial, validation, retry idempotency, stale edits, and the public slot response contract. All fixtures were rolled back; no sample services remain.
- node tests/client-booking-flow.cjs: existing suite passed, including date/time-only slots and the exact real Paystack checkout destination.
- Security/performance advisors checked. New services RLS-without-policy notice is intentional: direct table grants are revoked and access is through credential-checked RPCs. Existing calendar/public-page function search-path and SECURITY DEFINER warnings predate this change and remain outside step 1.
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

The calendar selects a slot; a separate button opens the details form; Continue to payment has no arrow and opens https://paystack.shop/pay/o495iejvn3. Keep the real checkout.

Client details remain in the browser tab. Database reservations, payment verification and automatic admin booking updates are not implemented. A service save is not a booking.

## Next step

After the owner reviews step 1, discuss and authorize step 2: the client catalogue. Do not automatically advance to scheduling, reservations or payments.

# Catalogue redesign direction — 2026-10-30

This records the owner's latest instructions and the review discussion. Read alongside AGENTS.md and the latest docs/PROJECT_HANDOFF.md section. It is a staged direction, not permission to implement every capability at once.

## Scope and visual references

The owner paused the proposed Order summary row to improve the catalogue first. Do not resume that row automatically.

The first supplied booking-page screenshot remains the overall visual direction: centred business logo/name, contact/social icons, soft light background, existing typography, teal/navy accents, three numbered booking steps, rounded service catalogue and booking/calendar panel on the right. The second screenshot changes catalogue treatment only: a floating McDonald's kiosk-inspired category panel on the left and compact service cards in the centre. Do not replace the whole site with a dashboard or restore the discarded separate sales demo.

Reference files were supplied in chat as 84ce225c-7dfc-440a-bc3f-ca041827f200.png (overall page) and c3a4d031-0105-4c60-a59d-efc4998cd373.png (catalogue). Their local paths may not be available in a future session; the written requirements here remain usable.

The owner previously removed picture placeholders. The new brief explicitly calls for real service photographs when supplied. Display supplied photographs in the approved card treatment; do not restore empty picture placeholders or invent photographs, offerings or prices.

## Keep these three concepts separate

- Category organises browsing. It has a business-defined label, appropriate icon, enabled/disabled setting and order. It must remain reusable for salons, tutors, consultants and other industries.
- Service is what the customer purchases: configured name, description, photograph when provided, duration where applicable, ZAR price and category assignment.
- Booking type determines scheduling/fulfilment rules: private appointment, scheduled shared class or package purchase. Never derive booking type, capacity or pricing rules from the category name.

The four personal-trainer example categories are Group Sessions, Individual Sessions, Training Packages, and Assessments & Consultations. They are illustrative configurable categories, not four permanently hardcoded customer buttons. Example services/prices in the owner's brief are illustrative only.

## Customer catalogue

- Desktop has floating category navigation on the left, central service catalogue, existing booking panel on the right. Preserve the header and step tracker.
- Category buttons have icons, readable labels, a distinctive teal active state and subtle neutral inactive styling.
- Display only enabled business categories containing published, active services. Do not show disabled or empty categories. The current schema has publication but no separate service-active field; resolve that data contract before implementation.
- Clicking a category filters offerings immediately in-page. Category browsing should preserve the selected service/date/time where valid; hiding/removing/changing a service must follow existing revalidation rules.
- Reuse existing HTML/CSS/JavaScript; the app has no frontend framework requiring replacement.
- Cards retain approved appearance, with supplied photograph, name, optional short description, duration where applicable, configured ZAR price, selection action and clear selected highlight.
- Use two card columns on desktop where width permits, one where needed on smaller screens.
- Remaining group spaces must come from an actual scheduled class and capacity calculation. Do not invent counts or put scheduled-class capacity on an unrelated category.
- On smaller screens categories become a horizontally scrolling bar above cards. The booking panel stacks below or becomes an appropriate mobile step. Avoid page overflow and narrow cards.
- Do not automatically add the screenshot's Bootcamp/Strength/HIIT/etc. filter chips: no configured tag/subcategory model was agreed.

## Booking and future capabilities

The right booking panel stays. Empty instruction: "Select a service to see available dates and times." Selected state eventually includes service name, duration, price, service-specific availability, dates/times, booking summary and checkout action.

Current general availability is not service-duration-aware. Do not relabel it as service-specific until implemented. Public available slots contain date/time without status; preserve omitted-status acceptance.

Private appointments need full-duration fit and no overlap. Shared classes need scheduled instances and multiple customers up to capacity. Packages purchase defined session credits and must not become one ordinary appointment; redemption and credit tracking are separate capabilities.

Intended journey: choose training/category/service; choose date/time; checkout with required full name, email and phone, optional note. Home/mobile appointments also need appointment location. Intended confirmation occurs only after successful server-side payment verification.

Preserve real Paystack destination https://paystack.shop/pay/o495iejvn3. Service-specific payment remains disabled until correct pricing is connected. Do not simulate payment, alter payment configuration, expose a premature checkout action or claim confirmed reservations.

## Administration and data requirements

Eventually administrators configure category labels/icons/visibility/order; service assignments, name/description/photos/pricing/duration/publication; booking types; scheduled classes/capacity; working hours and unavailable periods; online/fixed/customer-location appointments.

Needed category foundation, proposed rather than implemented:
- Business-scoped category records with ID, business ownership, label, icon identifier, enabled flag and sort order.
- Service-to-category assignment independent of existing service_type.
- Public RPC returns only eligible categories/services and safe public fields.
- Minimal admin controls for managing categories/assignments, using existing business ownership checks.
- Photo storage/reference and active-service semantics require a separate explicit decision.
- Package types, credits, class instances and reservation/payment schema remain later work.

No admin/backend work is automatically authorized by visual examples or this saved proposal. Explain the minimum necessary category persistence/settings changes and agree that small scope before changing them. Existing client-only scope remains until explicitly extended.

## Inspection findings on 2026-10-30

Reviewed current main, handoff, booking-flow documentation, app.js, index.html, catalogue.css, admin-services.js, catalogue migration and live Supabase schema/data.

- Current public tables: businesses, services, availability.
- services already has name/description, private or class service_type, duration_minutes, integer price_amount in cents, ZAR currency, per_session/per_person price basis, private participant_count, is_published and sort_order.
- No category records/assignment, service photograph field, package type/credits, scheduled classes/capacity or separate active-service field.
- get_public_page returns nine public service fields plus general date/time-only slots.
- Existing code handles service selection, summary totals, polling/revalidation, monthly calendar and details navigation. Class selection is disabled until scheduling exists.
- At this inspection Logtraq had zero saved services and zero public slots. Recheck when relevant; do not treat this as permanent or insert samples.

## Agreed next-session starting point

First explain proposed component structure, data changes and gaps before coding. Reuse separate category navigation, filtered service list and existing booking panel, with independent activeCategoryId, selectedService and booking type rules.

Proposed manageable stages from the discussion:
1. Agree category data contract and client layout.
2. Add saved category configuration and service assignments, after agreeing the minimal admin/backend scope.
3. Connect filtering, selected-card highlighting and supplied photographs.
4. Resume duration/class scheduling (step 3), reservations (step 4) and verified payments (step 5) in their existing order.

The category redesign has been reviewed and planned only. No redesign code, schema migration or business-data change has been implemented. Keep explanations concise and make one small agreed change at a time.

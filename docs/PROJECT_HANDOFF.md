# Booking project handoff

Updated 2026-10-31.

## Preserve full logo edges — 2026-10-31 (read first)

The owner reported cropped/pinched logos. Original saved image files are unchanged. Removed rounded overflow clipping from the admin identity, bottom profile avatar and profile logo preview. The public identity no longer uses a circular clipping frame, and both business/header and Logtraq footer images use contain instead of cover. Existing frame dimensions remain responsive. No uploaded image, service photograph, database value or booking behaviour changed. Cache versions were bumped.

Native admin navigation checks passed. Browser verification was attempted but this fresh sandbox lacks Chromium system libraries; do not claim a new browser pass for this styling-only fix. Earlier responsive workflow checks remain recorded below. Production deployment/assets are checked after this commit. Careful real Supabase picture-upload verification remains pending.

## Simple Groups workflow replaces technical category controls — 2026-10-31 (read first)

The owner explicitly rejected the complexity of Category, Display order, Enable category and icon-name choices. Visible admin wording is now Group. Creating a group asks only for Group name and Save group. New groups remain shown by default. Optional visual symbols and Show to clients are inside a closed More options section. Hiding a group still hides its published services without deleting anything. Existing category IDs, icons, enabled values and order fields remain intact.

Raw display-order input is hidden and preserved internally. Group headers offer Move up and Move down instead. Migration 20261031095734_add_safe_group_reordering adds only a credential-checked reorder RPC; it locks owned rows, verifies the exact owned ID set and expected timestamps, applies the full order in one transaction and accepts a retry whose desired order already matches. Wrong keys/stale reorders are rejected. No real groups or offerings were created or changed.

Native Services/navigation checks pass. New browser test tests/simple-groups-browser.cjs passed at 320/390/820/1440px: name/save-only creation inside Add service, assignment, optional symbol/visibility, Move up and no overflow. Reorder database tests under anon passed with fixtures rolled back, including retry, stale edit and wrong-key handling. Existing Services browser runner was updated for the new labels and optional settings.

The owner has only minutes left and wants the UI to require no technical knowledge. Next: owner review this simple flow, then complete careful real Supabase picture-upload verification and actual-service admin/client review. Existing photo retrieval/invalid-key upload rejection were checked; fresh successful branding uploads and actual-record client preview remain unverified. No automatic real publication. Keep all existing booking/payment safeguards and the established sequence.


## Category symbols and punctuation simplified — 2026-10-31 (read first)

The owner saw the category Icon dropdown's “Star” and similar labels while editing PILATES & MOBILITY and mistook them for category names. Replaced the visible icon-name dropdown with six visual SVG symbol buttons labelled Category symbol. Accessible button names remain for assistive technology; existing icon identifiers, values, persistence and database records are retained. The hidden existing selector remains the form's value source. This is not a list of suggested category names.

At the owner's request, Catalogue status uses Draft (hidden from clients), Published (show in catalogue), Paused (temporarily hidden). Dash-separated service/publication/helper messages now use ordinary sentences. No booking, pricing, publication or schema changes.

Native Services/navigation tests and Chromium at 320/390/820/1440px passed, including selecting the visual People symbol, inline category creation, icon persistence, service status, photos, retries, modal behaviour and no overflow. Tests used intercepted fixtures and actual supplied storage URLs; no business writes.

Previous heading cleanup aabd5bf62e765d223638cad96a03a7455e3bdb99 is deployed as dpl_CapHjnvfQXb8rsPpZvpLnHzNzEFK (READY; booking.logtraq.co.za). Live browser checks at 390/1440px confirmed sidebar identity retained, repeated page-level business name/helper copy hidden, section headings visible, no overflow and denied-access errors still visible.

Read-only picture audit: all five supplied Supabase photos returned 200, matched stored byte sizes and image MIME. The existing upload endpoint rejected an invalid admin key (403) without creating an object. A new successful real branding upload is still unverified and remains part of the next careful picture-upload stage.

Last business read: PILATES & MOBILITY is the existing active unpublished private service, 90 minutes, R250 per person for 2 people (R500 total), with its original mobility photo and no category. Logtraq has zero categories and zero public services. Do not silently create a category or publish it. Real owner-data admin/client preview testing was interrupted before completion; do not claim it passed. The earlier full Services/profile browser tests used isolated fixtures and did pass.

Next: owner reviews this small live cleanup, then carefully verify picture uploading in Supabase and how actual services appear in Admin/client. Preserve real Paystack, disabled service payments/classes, date/time-only slots, paused Order summary and the later scheduling/capacity → reservations → verified payments sequence.



## Business Profile released; workspace headings simplified — 2026-10-31 (read first)

Business Profile implementation d8ec0caebdf2a2b72234a53c326488081d6194a8 deployed as dpl_FVnY3qAPpg8KonJEqJZHtpSnJEY9 (READY, booking.logtraq.co.za). Live profile/admin/client HTML, JavaScript and CSS returned 200 and matched the candidate content (ignoring trailing newlines in unchanged local copies). Production Chromium at 320/390/820/1440px passed BOTH profile and integrated Services workflows with isolated intercepted RPC fixtures. Supplied service-photo URLs decoded correctly. Profile tests cover the admin past-time notification and no expired-slot writes; future-slot tests now await the actual save response before asserting. Separate actual Supabase profile-save/public-display verification and QA cleanup are recorded below.

The owner then explicitly requested removing the repeated business-name “(Admin)” page heading and generic “Manage your service catalogue” / “Tap a slot to toggle its availability” text. Business identity stays in the sidebar; each workspace retains its Calendar, Services or Business Profile title. The identity/help area is hidden only AFTER successful access verification, so incomplete/denied/offline startup messages remain visible. Contact icons are retained. This is a small admin CSS/cache-version change, with no data/booking changes.

Next remains the owner's request: careful Supabase picture-upload verification, then review the owner's actual services in Admin and the client catalogue. Real branding upload testing is deliberately still pending, while previews/mocked uploads and owned-photo SQL validation passed. Physical Safari/iOS remains untested. Preserve the safeguards and later scheduling/capacity → reservations → verified payments sequence; Order summary stays paused.



## Editable Business Profile and admin past-time notice — 2026-10-31 (read first)

The owner explicitly instructed saving the supplied Business Profile mockup and implementing the extension after checking the completed Services workflow. Original Modern Business Profile Dashboard.png is saved unchanged at docs/references/business-profile-reference.png (1,682,547 bytes; blob 4100488b0a33b39a33da5aabeb0f8136c98eb97e). Reference commit: 26f70aeffc50ebe5a8ce6c68fa5fd053ec89af9c. Read docs/business-profile.md. Services already passed its existing requirements; no repeat redesign or Categories page was added.

### Implemented
- Footer identity tile opens #profile inside the existing workspace. Calendar and Services remain the only primary links. Separate View client page and Preview client page open the existing slug route in a new tab, without admin credentials.
- Responsive profile cards edit the existing business row: name, tagline/About, logo/hero/gallery, email, independent phone/WhatsApp, configured social/website URLs, visibility toggle, read-only public link/copy, area and delivery descriptions. Empty public fields remain hidden. Client booking/catalogue logic is retained.
- Existing name/logo/social/WhatsApp fields, admin-link ownership model, photo uploader and bucket are reused. Migration 20261031093801_add_editable_business_profile adds only missing fields and profile_version. It copies the existing WhatsApp value into phone_number to preserve the call link; it never changes the slug.
- New public SECURITY INVOKER RPC wrappers call credential-checked private implementations with pinned search_path. RLS/direct table denial are retained. Saves whitelist fields, validate lengths/email/phones/HTTPS URLs/owned image objects, reject stale versions and recover an identical request after a lost response. No private profile metadata is returned publicly.
- Image previews retain aspect ratio; JPG/PNG/WebP up to 5 MB, gallery up to 12. Uploads happen on Save through the UNCHANGED service-photo-upload function. Failed saves retain image paths/retry IDs and edits; Cancel restores the loaded profile. Remove drops only the profile reference, preserving shared storage/service assets.
- Owner separately requested a friendly admin-only past-time popup: expired times are black, click checks South African time again and shows “09:00 has passed. Clients can only book future times.” No expired-slot write occurs. Future slot saving stays intact. This does not change set_slot's backend contract; public expiry filtering already exists.

### Verification
- Native admin Services/navigation, client categories/monthly calendar, availability sync, slot expiry and new admin past-time checks pass. Script syntax and markup checks performed.
- Profile SQL suite passes on Supabase under anon/authenticated roles with fixtures rolled back: ownership/wrong keys/inactive business, direct-table denial, safe fields, validation, owned photos, stale edits, retry and unchanged slot/catalogue contracts.
- Chromium 320/390/820/1440px: profile save/reload/sidebar identity, public display, independent contacts/social toggle, preview/mocked uploads/removal, failed-save retry without repeat uploads, validation, stale edits, Cancel, navigation, expired-slot no-write popup, future saves and no horizontal overflow.
- Actual 390px browser → Supabase profile save → public page refresh passed using a disposable QA business. Its row was deleted and zero remaining rows verified. This test SKIPPED real image uploads; do not claim newly verified real branding uploads. Existing uploader is unchanged and was previously tested. Physical Safari/iOS is untested.
- Real original business fields match the pre-change hash after excluding the newly added columns. Its profile_version remains 0. No real services/categories/photos/prices/availability were edited.
- Security/performance advisors were reviewed; existing warnings concern the older calendar functions, not the new profile RPCs. Production release verification is recorded in the follow-up release note.

### Authoritative next step
The owner explicitly requests: after this release, carefully check picture uploading in Supabase, then test how the ACTUAL configured services appear on both Admin and client pages. Review ownership/file limits/preview/replacement/removal and use isolated QA for test writes. Do not insert mockup examples into Logtraq. This supersedes an automatic move to scheduling.
Shared classes remain unbookable, service payments disabled, real Paystack preserved, date/time-only public slots accepted and Order summary PAUSED. Later sequence remains scheduling/capacity → reservations → verified payments.



## Integrated Services management implemented — 2026-10-31 (read first)

The owner explicitly authorized the full Admin → Services improvement, then corrected the scope to REMOVE the separate Categories sidebar tab entirely. All category management now happens within Services. The latest reference and approved scope are [admin-services-workflow.md](admin-services-workflow.md) and the original [workflow PNG](references/admin-services-workflow-reference.png), saved unchanged in commit 50d0703. This supersedes the previous “still to agree” grouping proposal. The owner also requested replacing the two confusing Active/Published tick boxes with clearer wording.

### Result
- Only Calendar and Services remain in the sidebar. Old #categories links route to Services; calendar nodes, business logo, admin key URL, public business link and responsive sidebar are retained.
- Services groups real saved offerings under collapsible category headers: saved icon/name/order, counts of all assigned saved services, enabled/disabled state, Edit category, and Add service to this category. Empty/disabled categories remain manageable. Existing drafts with no assignment appear in Needs a category, with Edit to assign/create a category without replacing the service record.
- Add/Edit service is a native modal side drawer with focus containment, Escape/Close/Cancel and in-flight save dismissal protection. On phones it fills the viewport. Essential fields are shown first; Description & photos and Pricing options expand separately. Existing per-person/multiple-person pricing opens its options on edit and displays actual totals.
- Category dropdown includes + Create new category; category create/edit is a small native dialog over the retained service draft. Existing save_admin_category persists the category, then its ID is assigned in the service form. Icons, enabled flag and display order are editable here or from the category header inside Services. No replacement category page/workflow.
- One Catalogue status selector replaces BOTH Active/Published tick boxes: Draft (hidden), Published (show in catalogue), Paused (temporarily hidden). Published writes true/true; Draft writes false/true; Paused writes false for is_active while retaining the service's previously saved is_published value. Thus both kinds of existing paused records round-trip intact. There is no second Active checkbox.
- Category eligibility, name/duration/price/participant validation and dynamic publication blockers are visible in the form. Disabled categories must be enabled/changed to newly publish; existing hidden/paused records retain their stored distinctions. Category and service retry UUIDs, expected_updated_at concurrency checks, input retention on failure and duplicate-submit protection remain.
- If category save succeeds but service save fails, the category stays selected, the draft stays open and the error explicitly says the category is saved. An uncertain category save retries the SAME UUID. Photo paths, supplied library/upload/removal, descriptions, exact integer-cent prices and per-person totals remain.
- Shared classes show Not bookable yet and remain disabled on the unchanged customer page. Published means catalogue visibility, not payment/reservation confirmation. Private services still use existing general availability; service-duration-aware scheduling and verified service payments are not introduced.

### Reuse and boundaries
Existing get_admin_services/get_admin_categories/save_admin_service/save_admin_category RPCs, Supabase category/service tables and photo infrastructure are reused unchanged. NO schema migration, backend rebuild, real business offering/category/photo/price/publication changes, package support, logout, search, extra navigation, customer redesign or Order summary work. New primary controls use black/white/grey; actual business logo remains.

### Verification
- Native Node checks pass: integrated admin services/categories (including partial failures, lost responses, stale edits, original IDs/photos/secondary fields/pricing/status preservation and class guards), navigation/calendar, cross-tab availability sync, client category browsing, monthly calendar and slot expiry. Native HTML/CSS/JavaScript syntax, unique IDs/labels and diff whitespace checked.
- Existing transactional admin-service and category SQL integration suites pass on Supabase with fixtures rolled back; schema unchanged.
- Chromium checks pass at 320/390/820/1440px using isolated intercepted RPC state and actual supplied photo URLs: inline category creation, publication, drawer/nested-dialog behaviour, preserved photos/prices, category order/enable/move/collapse, old category links, class-booking guard and no page/dialog overflow.
- Actual Chromium phone browser → existing Supabase REST/RPC → public catalogue passed against a newly created isolated QA business with zero categories: create category inside Add Service, save/publish, pause/reload/resume, category enable/order, move with same service ID, publish a class while its customer selection remains disabled. The isolated QA business and its categories/services were removed after testing; no Logtraq offerings are used for test writes. Physical iOS/Safari remains untested.
- The legacy tests/client-booking-flow.cjs has its earlier stale UI fixture failure and is not claimed as a full pass. Customer scripts are unchanged.
- Implementation commit 43c9ef526a123ac84304b01806f4fc4e7a4cd637 is deployed to production: dpl_D2BKR7X9bWhRxtmqqAVTwPcdqxJ1 is READY and aliases booking.logtraq.co.za. Live admin.html, admin-services.js, admin-navigation.js, admin.css and unchanged app.js all returned 200 and matched the tested files.
- Post-deployment Chromium checks at 390px and 1440px passed using the ACTUAL production HTML/CSS/JavaScript and intercepted in-memory RPC fixtures: inline category creation, publication/status changes, category editing/moving, photo preservation, modal cancellation, legacy links, disabled class selection and no overflow. This is production rendering/interaction verification; the separate real browser-to-Supabase test used candidate files with actual RPCs and was also successful. Its isolated QA business was deleted and zero remaining rows for its ID were verified.
- The owner is switching computers. All implementation/tests/original reference/working agreement and release notes are saved on GitHub. Next action is owner review of Admin → Services, not another redesign or scheduling implementation without agreement.

Next: owner reviews the integrated Services workflow. Scheduling/capacity → reservations → verified payments remains the later sequence. Order summary stays PAUSED.


## Grouping UX reconsideration — 2026-10-31 (read first)

The owner found Category/Unassigned and the publish validation confusing. They initially approved optional categories, then explicitly asked to revisit the feature rather than add explanatory text. Their latest clarification is authoritative: **grouping is essential**. They object to the separate Categories tab and a Show in client catalogue control that fails because a group has not been configured elsewhere. Do not remove grouping based on the earlier discussion.

Proposed next small step, still to agree: use the word **Group** consistently, select/create a group directly inside the service form, and avoid sending owners to a separate tab before they can publish. Discuss where group editing belongs before hiding/removing the existing Categories screen. Keep browsing groups independent of service purchases and booking-type/scheduling rules. Do not ship long helper copy as the solution.

An optional-category implementation was prepared and tested but its UI changes were NOT committed or deployed after the owner's steering. The database migration allowing ungrouped publication (20261031081539) was applied during that work, then explicitly reversed by 20261031081837 to keep the database compatible with the unchanged production client/admin. Both migration files are preserved for accurate history; the resulting functions match the previous deployed contract. No real service/category/photo/price/publication records were changed. PILATES & MOBILITY remains the owner's existing unpublished, active service with no group and its supplied photo.

Candidate checks passed: six existing Node admin/category/calendar/sync/expiry suites, a focused details/payment guard check, transactional Supabase category/service/public/photo/optional-publication checks (fixtures rolled back), and Chromium at 320/390/820/1440px with intercepted in-memory RPC responses and the actual supplied photo. These do not establish a released optional-category feature or real browser-to-database publication. The legacy tests/client-booking-flow.cjs still fails against the current UI fixture at querySelectorAll; do not report that full suite as passed. Existing Supabase advisor findings were unchanged.

Next: agree the inline Group selection/creation interaction, then implement only that small scope and save/deploy/verify it. Preserve real Paystack, service-specific payment guards, date/time-only slots, paused Order summary, and scheduling/capacity → reservations → verified payments.


## Photos, automatic slot expiry and Checkout cleanup — 2026-10-30 (read first)

The owner explicitly requested five image prompts, service photo uploads/storage, saving every supplied service image to GitHub AND Supabase, automatic removal of elapsed customer times, mobile/iPad compatibility, Checkout wording cleanup and a committed work summary.

All five original supplied PNGs are saved in assets/service-photos/ and the owned Supabase service-photos bucket. See [work summary](WORK_SUMMARY_2026-10-30.md) and [photo manifest](../assets/service-photos/manifest.json). No service, category, price or capacity records were invented. The owner must configure real offerings before the catalogue can show them.

Implemented admin library picker/upload/preview/removal, safe service photo references and customer card/booking-summary images. Three applied migrations and the deployed credential-checked Edge Function are saved with source. Native Node and database checks passed, including actual multipart upload/exact-byte retrieval/invalid-key rejection.

Elapsed times are omitted using South African time, including stale client/details checks. Historical records remain intact. Checkout goes to the real details page; internal placeholder essays and duplicate summary copy were removed. Paystack's supplied destination stays real. Service-specific payments remain disabled until correct amounts/reservations/server verification are built. Order summary remains PAUSED.

Actual Chromium responsive browser checks now passed at 320–1440px (phone/tablet/iPad-sized/desktop), covering images/date selection/Checkout/overflow, plus phone admin photo library/preview. These used in-memory service fixtures and actual supplied photo URLs; physical iOS/Safari remains untested. Earlier notes saying no browser could be run are superseded by the isolated Vercel Sandbox verification.

Read WORK_SUMMARY_2026-10-30.md before continuing. Next: owner reviews release and adds actual categories/services; agree subsequent small steps. Preserve the existing admin sidebar/categories work, date/time-only slot contract and immediate same-browser admin/client refresh. Scheduling/capacity → reservations → verified payments keeps its order.


## Availability refresh reliability fix — 2026-10-30 (read first)

The owner reported that client availability no longer appeared to follow admin slot edits immediately. Investigated current deployed scripts, Supabase public data/function and recent RPC logs before changing code.

- Live HTML/app.js/admin.js matched current main. Supabase received successful set_slot writes (204/200) and get_public_page reads (200); no failed persistence/read boundary was found. At inspection public slots were 1 November 07:00–10:00, while the client initially views today, 30 October; an async clarification about matching dates was asked but not answered before this fix. The client's existing three-second poll passed regression checks. Do not claim the owner's exact browser failure was reproduced.
- Found no immediate post-save cross-tab refresh path, no focus/visibility refresh, and no guard against overlapping/out-of-order or hung reads. Added business-scoped BroadcastChannel and storage-event hints after SUCCESSFUL admin saves. Client treats hints only as a trigger to call get_public_page; messages contain a type and random ID, no admin key, customer information, date/time/slot payload or trusted booking state. Duplicate BroadcastChannel/storage hints are suppressed.
- Client also refreshes on focus, becoming visible and back-forward restored pages. Existing three-second polling remains for other browsers/devices and when local browser APIs are blocked. This is same-origin browser-tab notification, not Supabase Realtime or cross-device server push. Both currently open pages need one refresh to load app.js?v=7/admin.js?v=3.
- Serialized public reads with one queued refresh after a save/focus event during an in-flight request. Added a 15-second abort timeout so stalled reads cannot block updates permanently. Failed refreshes disable continuing and show an honest refresh error; recovery clears the warning.
- Selected date/viewed month, category/service browsing and valid selected time are preserved; removed/unavailable times still clear selection. The page does not jump to a different date just because an admin changed it—compare the same date in admin and client.
- No backend/schema/RPC/payment changes or business test writes. Keep date/time-only slots, real Paystack and disabled service payments. Unrelated admin/category styling and the paused Order summary remain.
- Added tests/availability-sync.cjs: simulated admin save → shared data → immediate client read, success-only notifications, deduplication, business scoping/no credential payload, polling/focus/visibility/pageshow fallbacks, selected-date preservation, one in-flight request/queued latest result, timeout/error/recovery, blocked-channel/storage fallback and failed saves. Passed in session JavaScript with lightweight filesystem adapters.
- Existing client monthly-calendar, client-categories and admin-navigation checks also passed with updated browser-event/abort fixtures; admin-services script-order fixture updated for the cache version. Actual desktop/mobile browser-to-REST rendering remains unverified due to the known browser startup denial. No live customer/admin slot fixture was inserted.
- Verify the commit-matched deployment and live client/admin HTML and scripts before reporting release. Owner should refresh both pages once and compare a matching date. Resume the agreed small admin design stages after this bug review.


## Admin calendar contrast corrected — 2026-10-30 (read first)

The owner reported the transparent-looking admin calendar made selected/available states hard to distinguish and explicitly requested solid neutral fills: selected/available white with black text, unavailable black with white struck-through text.

- Admin Calendar now has a light neutral filled panel. Selected day is white/black with a clear black border; other date tabs are black/white without strikethrough (they are other days, not unavailable dates).
- Available time chips are solid white with black text and black borders. Unavailable time chips are solid black with white struck-through text. Both retain clear fills at full opacity and minimum 44px height. The legend matches those states and helper text identifies the selected day.
- Admin-only CSS/legend/cache-version change. Existing slot availability/toggling, client calendar, brand settings, categories/services, real Paystack and service-payment guards are unchanged.
- The owner also asked what Unassigned means in the service category selector. Explained: it allows an unfinished draft without a category; publishing requires an actual category, and Unassigned is never a customer category. No selector behaviour change was requested or made.
- Validation: scoped selector/contrast and HTML control-ID checks; verify deployment and changed live assets when releasing. Actual browser rendering remains outstanding. Current next admin stage remains owner review before agreeing further changes.


## Admin Categories screen and cleaner workspace implemented — 2026-10-30 (read first)

The owner explicitly changed priority to the ADMIN dashboard and approved a dedicated Categories screen plus sidebar/layout cleanup using docs/references/admin-interface-reference.png. This supersedes earlier notes that the next priority must be photos or client-only work.

- Admin now has Calendar, Services and Categories links. Direct #categories links, hash navigation and Back/Forward select the correct panel and update aria-current/focus without changing the business/admin-key URL or rebuilding the calendar.
- Added a dark responsive sidebar with supported-section icons, the actual business name/logo and a View business link. The public destination is built only from the business slug; it never contains the admin key. At 800px and below navigation becomes a compact horizontal row. Unsupported Dashboard/Bookings/Customers/Payments/Settings and account/logout modules were not added.
- Moved the existing business avatar into the sidebar and compacted the workspace header, preserving business title/status and phone/social links. Neutral black/white/grey interface controls stay independent of business branding. Admin pinch zoom is enabled.
- Categories is now a dedicated workspace with a semantic table: display order, saved icon, category name, assigned-service count, Enabled/Disabled status and Edit. Counts come from all saved admin services assigned to that category, including hidden/inactive offerings; no counts or records are fabricated.
- Existing category Add/Edit fields (name/icon/order/enabled) and Supabase RPCs are reused. Categories has its own loading/error/save feedback and Reload categories button. Wide tables scroll within a labelled keyboard-accessible region on narrow screens. Empty/load-error states do not pretend records/counts exist.
- Services retains the working service card list/form and category selector; it links to Categories. Counts update after service saves. Category/service forms keep stale-edit checks, retry UUIDs, validation and duplicate-submit protection. Unsaved forms survive section changes; a cross-section notice explains which open edit must be finished/cancelled before starting another.
- No backend/schema/RPC contract changes or real business-data writes. The existing calendar slot generation and set_slot logic are unchanged except passing the slug to navigation for the public link. Client catalogue, date/time-only slot acceptance, real Paystack, disabled service payments and paused Order summary are preserved.
- Verification: extended tests/admin-services.cjs passed for category table order/status/counts, separate feedback/reload/recovery and edit notices, plus existing save/validation/retry/stale-edit/service fields. New tests/admin-navigation.cjs passed for direct Categories/Services/Calendar routes, hash navigation/focus, preserved draft/calendar nodes and edited slot, existing set_slot payload, query-format links, logo/public link, denied/offline/incomplete access and table/zoom accessibility. Tests ran in session JavaScript with lightweight filesystem/Node-module adapters; not a native browser.
- HTML nesting/unique IDs/label references, retention of all previous control IDs, JavaScript syntax and CSS structure checked. Static widths at 320, 375, 768, 800, 801, 960, 1280 and 1440px keep workspace/table overflow contained. Actual desktop/mobile browser rendering and browser-to-REST verification remain outstanding due to browser startup denial. Verify the commit-matched deployment and changed live assets when releasing.
- Next: owner reviews the new Categories screen and can add real categories, then assign active published services through Services to make them appear in the client. Agree the next small ADMIN visual step before further changes (for example a Services table); the full service table/search/filter/drawer image and photo upload/storage remain staged future work. Scheduling/capacity → reservations → verified payments retains the original order.


## Session memory and important admin reference — 2026-10-30 (read first)

The owner asked to save the detailed admin image and commit everything from this session to project memory. The actual original PNG is now tracked at [docs/references/admin-interface-reference.png](references/admin-interface-reference.png), described and previewed in [docs/admin-interface.md](admin-interface.md). Original filename: admin.png; original bytes preserved. This is the important future ADMIN visual target.

### Visual direction and boundaries

- Customer/combined final reference remains [docs/references/final-visual-plan.png](references/final-visual-plan.png). Customer direction: floating configured category navigation left, service cards centre and existing booking/calendar right. Preserve the existing header/social contacts/tracker and neutral interface controls; business branding is separate.
- New admin reference: dark sidebar, Services table, search/category/publication filters, Add/Edit drawer and category-management table, with future Dashboard/Calendar/Bookings/Customers/Payments/Settings sketches. It supersedes older vague admin descriptions as the visual target, but those screens/table/search/drawer/bulk features are not implemented or automatically authorized by saving an image.
- Category = browsing organisation; service = purchased offering; booking type = scheduling/fulfilment. Keep them independent. Package credits are not ordinary private appointments.
- No invented offerings, prices, photos, participant counts, class spaces, customers, paid bookings or payment/account data. Screenshot examples are illustrative, not business records or a set of supplied service-photo assets.
- Order summary remains PAUSED. Keep real Paystack https://paystack.shop/pay/o495iejvn3, disabled service-specific payment and date/time-only slot acceptance. Return to duration/class scheduling/capacity → reservations → verified service payments in that order after the currently agreed client stages.

### Completed this session

1. Verified GitHub push access, healthy Supabase Booking project and the correct Vercel project/team.
2. Category foundation/admin controls: commit 9b5dd316f1d3928743947fbf5e9d480907c6bc95. Migration 20261030130402_add_business_catalogue_categories.sql is applied in Supabase and saved in GitHub. Business-scoped service_categories records have label/icon/enabled/order; services has one category assignment and independent is_active/publication settings. Public RPC returns only enabled nonempty categories with published active services. Ownership is enforced by RPC checks and a composite category/business FK, with RLS and revoked direct browser table grants.
3. Neutral interface/calendar fixes: commit 405fd29b3c153a9356f1f575405a23f8f2f096e0. Black/white active controls, matching admin action sizes, soft grey admin active navigation, circular date highlights and earlier split-screen stacking. Existing business brand variables were preserved.
4. Saved original final combined customer/admin visual image and linked it in the brief/handoff: commit cfc5194cbdbcd1c5da12a5ada42cecd09a155397.
5. Client category browsing: commit 46ecfc0624854a71d01e2cb2217e548aaf2bd7b2. Independent activeCategoryId, configured icons/labels/order, in-page filtering, selected-card highlight, responsive left/centre/right layout and horizontal categories below the tracker on smaller screens. Valid booking selection survives category browsing and unchanged polling; server removals/changes revalidate selection. No photos or placeholders added.
6. Explained all current Services controls to the owner: categories/name/icon/order/enable, service name/description/assignment/type/duration/ZAR price/price basis/private people, Active versus publication, Save/Cancel/Edit/Reload and validation. [docs/admin-interface.md](admin-interface.md) records the current field semantics and implementation gaps.
7. This save adds the owner's original detailed admin image, a dedicated admin brief, links in AGENTS.md/catalogue brief, and this consolidated memory. It implements no further UI/backend features.

### Runtime, verification and current data

- Latest functional release: 46ecfc0, production deployment dpl_4PbCvDoi9wRtb7TWH71BW6ptqy3R READY. Live client HTML, app.js?v=6 and catalogue.css?v=14 returned 200 and matched saved files.
- Category/admin service/public catalogue SQL suites passed on Supabase with fixtures rolled back. Extended admin service, client category and monthly-calendar JavaScript checks passed in the session V8 runtime with lightweight filesystem/Node-module adapters. No native Node executable was available.
- CSS/HTML/syntax and static responsive width calculations were checked. Actual desktop/mobile browser rendering and browser-to-REST interactions remain outstanding: Edge startup fails with Access is denied. Do not call these browser or end-to-end passes.
- Last read-only check this session: Logtraq had zero saved/public categories, zero services and zero public slots. Recheck when relevant; do not treat this observation as permanent. Consequently the category menu is honestly hidden until actual categories/services are saved.
- Admin today still has Calendar/Services navigation, inline category controls, service cards and inline forms—not the pictured table/drawer/full sidebar. Photo uploads/storage, service-duration-aware availability, scheduled class capacity, reservations, service payment matching/verification, package credits and the extra admin modules remain unfinished.
- No real business sample data or service photographs were inserted, and no payment transaction was performed.

### Resume next session

Read AGENTS.md, this newest handoff section, docs/catalogue-redesign.md and docs/admin-interface.md; inspect both saved PNG references when working on visuals. Verify access and use current main as authority. Work one small AGREED step at a time and save/deploy completed changes.

The latest request only saves the admin reference and memory. Do not begin an admin redesign from this image alone. Current next action is to populate/review the client using the owner's real enabled categories and active published services through Admin > Services, then agree the small supplied-photo storage/upload/reference/display stage. The owner may choose an admin visual step instead, but that requires an explicit change of priority. Scheduling/capacity, reservations and verified payments keep the original sequence. Questions are discussion, not authorization to expand/reorder work.


## Client category navigation and filtering implemented — 2026-10-30 (read first)

The owner explicitly approved executing the next client stage: floating configured category navigation, filtered service cards and selected-card highlighting. Photo support remains a separate stage.

- Client reads the existing get_public_page categories/services contract. Only returned categories containing eligible services are shown, in the configured RPC order. No All/example categories, tags, prices, services, photos, Popular badges or capacity counts are inserted. Public published/active/enabled/business filtering stays in the RPC.
- Independent activeCategoryId controls browsing; selectedService and selected date/time remain independent. Category buttons filter cards in-page and show the configured category label above them. Icons use allowlisted local SVG artwork keyed by the saved icon identifier; category/service labels use textContent.
- Desktop above 1100px: floating 176px category panel left, filtered cards centre, existing 370px booking/calendar panel right. The tracker stays above the service cards. Page maximum width is 1440px to accommodate three columns; the catalogue has at most two card columns, using a container query for one column below 460px of actual catalogue width.
- At 1100px and below: tracker, horizontally scrolling category row, cards, then booking panel. At 640px and below cards use one column. Long labels wrap within buttons; large desktop category lists scroll within the viewport. Neutral black/white/grey controls and independent business branding remain.
- Selected cards get a black border and Selected action state. Changing only the browse category preserves a valid service/date/time, including a selected service outside the current filter. Selecting the same service preserves the time; choosing a different service clears its time and visual slot highlight immediately.
- Polling retains unchanged category/card nodes and category focus; category label edits keep valid booking selection. Removing the active browse category falls back to a valid selection's category or the first eligible category. Hiding/deactivating/removing the selected service (including category disabling via the public RPC) clears selection; service data changes revalidate time as before. Back links with service IDs restore that service and its category. Malformed category/service responses fail closed rather than opening the slot-only fallback.
- Class cards remain unbookable until class scheduling exists. Existing general availability, date/time-only slots, real Paystack destination, disabled service-specific payments, bottom booking action and checkout placeholder remain. Order summary stays paused.
- Empty businesses get no category panel or fabricated offerings. The existing empty catalogue and original slot-only demo are retained. Missing/inactive businesses hide category navigation and booking. Read-only check in this session: Logtraq still has zero saved/public categories, zero services and zero public slots; the live category menu will therefore stay hidden until real offerings are configured in Admin > Services.
- Verification: tests/client-categories.cjs added and passed in the session JavaScript runtime with lightweight filesystem adapters. Covers configured order/filtering, selected highlighting, separate category/service/type, Back links, same/different service selection, polling/focus, service/category changes and removal, offline/recovery, safe labels/icons, fail-closed inconsistent data and the empty slot-only flow. Existing tests/client-monthly-calendar.cjs also passed there. JavaScript syntax, HTML nesting/unique IDs and CSS structure checked; static layout calculations at 320–1600px found no grid-width overflow. These are simulated/static checks, not browser measurements.
- Actual desktop/mobile browser rendering and browser-to-REST verification remain outstanding due to the previously observed browser startup access denial. Full legacy tests/client-booking-flow.cjs was not run in this environment; it also predates the current monthly/tracker DOM. Verify the production commit and affected live HTML/JS/CSS when releasing.
- No admin/backend/schema/business-data changes in this stage. Next: owner reviews this stage and configures actual categories/services, then agree the small supplied-photo storage/reference/display stage before implementation. Duration/class scheduling, reservations and verified payments keep their original sequence.


## Final visual reference saved — 2026-10-30 (read first)

The owner supplied a consolidated final visual plan and asked that the actual image be saved to GitHub. It is now tracked at [docs/references/final-visual-plan.png](references/final-visual-plan.png), with an inline preview and interpretation in [docs/catalogue-redesign.md](catalogue-redesign.md). Original filename: final visual.png; original PNG bytes preserved.

This is the latest customer/admin visual reference: neutral black/white/grey controls, floating configured categories left, service cards/photos centre, existing booking/calendar right, plus a future admin Services layout reference. Saving it is documentation/reference work only; no new customer/admin features were implemented. Earlier notes saying all screenshot bytes are unavailable/untracked no longer apply to this final reference.

The screenshot's Order summary stays PAUSED. Example offerings/prices/photos, spaces-left counts, Popular badges, tags, additional admin sections/search/bulk controls are illustrative and do not authorize new capabilities or sample records. Categories remain business-configured and independent of services and booking types. Preserve real Paystack, disabled service-specific payments, date/time-only slots and the scheduling/capacity → reservations → verified payments sequence.

Latest functional release remains 405fd29 (neutral controls/calendar proportions), production dpl_3v7fdQMgM5Dk5tfqSLXF5bJnpEKL READY with live HTML/CSS matched. Browser rendering remains outstanding. Next implementation step still requires agreement: client category navigation/filtering using the saved category foundation.


## Neutral interface controls and calendar proportions — 2026-10-30 (read first)

The owner explicitly requested this small styling step before continuing client catalogue navigation: remove green interface selections, use consistent filled black admin action buttons, fix oval-looking calendar controls, and keep business branding separate.

- Added scoped --ui-* control colours for client catalogue/admin only; existing --brand/--brand-light and business logos/header/social colours are unchanged. No new business-colour configuration or backend changes.
- Client tracker active circle/label, selected calendar date and selected available time are black/white. Available unselected times use pale grey/dark text; date availability dots are black. Private-service selection actions also use neutral states, with disabled controls retained.
- Calendar dates render a square-proportioned circular background inside each button, capped at 44px and shrinking evenly in very narrow columns while retaining at least 44px button height. Month arrows are 44px square, black/white. The bottom booking action uses 12px corners and wraps long labels.
- Client booking panel now has a 370px desktop minimum and stacks below the catalogue at 1100px and below (previously 900px). This avoids a narrow seven-column calendar in split-screen.
- Admin Add/Save/Cancel/Edit/Reload actions use the same black/white styling and 144px width/minimum 44px height, wrapping toolbar rows when necessary. Current sidebar section uses a soft grey background, dark text and a black edge; active admin date tabs are black/white, open times and availability legend are neutral. Focus, checkboxes and service visibility badges no longer depend on green branding.
- Only CSS, stylesheet cache versions, the admin legend colour and these notes changed. All script IDs, admin/service logic, date/time-only selection, real Paystack destination and service-payment guards are preserved. Order summary remains paused.
- Verification: CSS braces/selectors, unchanged branding variables and control IDs checked. Calculated client layouts at 320, 375, 700, 768, 960, 1024, 1100, 1101 and 1440px retain seven date columns without calendar width overflow; these are static calculations, not browser measurements. Existing admin-services and monthly-calendar checks passed in the session JavaScript runtime. Actual desktop/mobile browser rendering remains outstanding because browser startup is denied in this environment. Verify production and changed live assets when saving this release.
- Next remains an agreed small client category-navigation/filtering stage using the saved category contract. This styling request does not authorize photos, invented offerings, scheduling, reservations or payment work.


## Category foundation implemented — 2026-10-30 (read first)

The owner approved the minimal category contract and the limited admin/backend extension in this session. This supersedes earlier statements that category storage is unimplemented or that all admin/backend work is postponed.

- Admin > Services now has category create/edit controls: business-defined name, icon identifier, enabled setting and numeric display order. No delete operation or seeded categories.
- Each service has one category assignment and an independent Active checkbox, separate from Show in client catalogue and the existing private/class booking type. Drafts can be unassigned; publishing through the admin RPC requires an owned category. Disabled categories can retain assignments and published services, but those services are excluded publicly.
- public.service_categories is business-scoped, RLS-enabled and has no direct anon/authenticated table grants. The services category foreign key includes business ownership. Public category RPCs are SECURITY INVOKER wrappers; private implementations reuse the existing active-business slug/admin-key model, pinned search_path, narrow grants, stale-edit protection and retry UUIDs.
- get_public_page now returns categories with only id/label/icon/sort_order, ordered by configured order then creation/ID. Only enabled categories with a published active service appear. Public services require published + active + enabled owned category and add category_id to the previous nine safe fields. No admin credentials, internal timestamps or business IDs are exposed.
- Existing slot objects remain date/time-only. Existing general availability and no-catalogue real-Paystack flow are preserved; service-specific payment stays disabled. No scheduling/capacity, reservation, package-credit or payment feature was added. Order summary remains paused.
- Migration: supabase/migrations/20261030130402_add_business_catalogue_categories.sql, applied remotely and saved with the exact Supabase-recorded version. Local Supabase CLI is unavailable; MCP was used for this release.
- Verified: extended tests/admin-services.cjs passed in the session JavaScript runtime with lightweight Node-module adapters; tests/client-monthly-calendar.cjs also passed there. Node itself is unavailable. All three database suites passed on the target database: tests/admin-categories.sql, tests/admin-services.sql and tests/client-catalogue.sql. Fixtures rolled back. Full tests/client-booking-flow.cjs was not run successfully in this runtime because it lacks native URL/URLSearchParams; client scripts are unchanged.
- Security advisors add only the intentional RLS-without-policy informational notice for service_categories (access is through credential-checked RPCs; table grants are revoked). Existing admin calendar warnings predate this stage. Performance advisors returned no findings.
- Final read-only business-data check after tests: Logtraq has zero saved categories, zero services and zero public slots. No example business data was inserted.
- Actual desktop/mobile browser rendering and browser-to-REST interactions remain outstanding. A fresh Edge headless launch failed with Access is denied in browser process/channel/profile creation. Do not claim browser/end-to-end verification. Verify the commit-matched production deployment and affected live assets when releasing this stage.

### Visual references clarified again in this session

The owner reattached two screenshots: Image 2 (local attachment image 2.png) is the overall website visual direction; Image 1 (4fae8e9a-a228-458b-8421-2d842930c91a.png) guides the catalogue only: floating categories left and compact service cards centre, with the existing booking/calendar panel right. Preserve the existing header, contact icons, colours, typography and booking tracker. The screenshot bytes are not tracked in GitHub; these descriptions are durable. Screenshot example offerings, prices, photos, Popular badges, filter chips and spaces-left counts do not authorize invented business data or new capabilities.

### Next small step — agree before coding

The category foundation is complete. The client category navigation/filtering/card highlighting is not implemented by this release. Next, agree a small client layout/filtering step using the saved contract, with independent activeCategoryId and selectedService. Desktop: floating category navigation left, service cards centre, current booking panel right. Mobile: horizontal categories above cards. Category browsing must preserve valid service/date/time selection; server removal/hiding/deactivation/category disabling must revalidate it. Supplied-photo storage/reference still needs an explicit small decision before implementing photo support. Keep no-photo cards free of placeholders. Then resume duration/class scheduling, reservations and verified payments in their original sequence.


## Latest catalogue direction — end of session 2026-10-30 (read first)

The owner is ending the session and requested saving memory. Catalogue redesign is the next topic. The proposed Order summary row is PAUSED. This section supersedes conflicting older visual/next-step notes below.

Read [docs/catalogue-redesign.md](catalogue-redesign.md) for the durable brief, reference descriptions, inspected schema, gaps and proposed stages.

- The first booking-page screenshot stays the overall design direction. The second screenshot changes the catalogue only: floating category panel left, filtered service cards centre, existing booking/calendar panel right. Preserve header, contact icons, typography, colours and three-step tracker. No full-site/dashboard redesign.
- CRITICAL: category organises browsing; service is the offering purchased; booking type controls scheduling. Keep them independent. Do not infer booking rules from category labels.
- Categories must eventually be business-configured, enabled/ordered, and shown only when containing published active services. The four personal-training categories are examples, not permanent hardcoded categories. Do not insert example services/prices.
- Supplied service photographs are now requested; the earlier removal of empty picture placeholders still stands.
- This redesign is not implemented yet. Current schema has no categories, service category assignments or photograph field. Private/class service types exist; packages, class scheduling/capacity, reservations and verified service payments remain unfinished.
- Start next session by reviewing current main and explaining the category component/data contract and gaps. Agree the smallest stage before changing code. Category storage/admin settings need an explicit small scope extension from the existing client-only work; do not silently implement all future administration or scheduling features.
- Proposed stages: agree category contract/layout; saved category configuration/assignments; client filtering/highlighting/supplied photos; then return to the existing scheduling/reservation/payment sequence.
- Last read-only check: zero saved Logtraq services and zero public slots. Recheck when relevant.
- Latest functional release: 573f84c54b3040166d2022c0216da2dca7dab204, monthly calendar, Vercel dpl_HkbR4WFrP4uQAdF5BKsT4Pzys8Wt READY on production. Live HTML/app.js?v=5/catalogue.css?v=12 matched saved code.
- Existing client now includes numbered progress circles, text-only service cards, right booking summary, date/time controls inside it, and a monthly calendar with real availability markers. Monthly calendar regressions passed in the session JavaScript runtime and are saved as tests/client-monthly-calendar.cjs.
- Actual desktop/mobile browser rendering remains outstanding: local browser launch hit access-denied errors. Do not claim browser/end-to-end verification.
- Preserve date/time-only slot acceptance, real Paystack destination and disabled service-specific payments until pricing is connected. No backend/business-data changes were made during the redesign review.

## Earlier resume state — 2026-10-30 (superseded where noted above)

### Current working agreement

- Client-facing work ONLY. Do not edit admin or backend unless the owner explicitly requests it. Existing client Supabase reads remain; new Supabase integration/features are postponed.
- Focus on the client shell for preselling, one small agreed edit at a time. The owner thinks visually and wants concise explanations (about 100 words per step), saying what changes in the frontend, what the backend needs, and one clear next action.
- Discuss the next small edit before changing anything. Questions are exploration, not permission to expand/reorder work. Complete authorized changes, save to GitHub, deploy to production, and verify affected live assets.
- The owner rejected the separate sales demo. Its files/route were removed in commit 73fc7a2b3fb274679e819fd5b2d3d15af0c9b6e6. Never restore/reuse/republish it unless explicitly requested.
- Latest visual reference: the owner's booking-page screenshot shared on 2026-10-30, with a horizontal step tracker, service cards on the left and a booking summary/date-time panel on the right. Build toward it one agreed client edit at a time. Catalogue pictures remain removed at the owner's request. Do not invent business offerings.

### Current client UI

- Live client: https://booking.logtraq.co.za/logtraq
- Existing background gradient shows through; no large white page panel. Phone icon has a transparent background. Phone and TikTok links use saved business data; scheme-less TikTok domains are normalized to HTTPS.
- A horizontal tracker above the catalogue now represents booking STEPS, not categories: Choose a session; Choose date & Time; Checkout. The capital T in Time was explicitly requested. All/group/private/class category tabs were replaced, not retained as hidden filters.
- Desktop: three equal-width numbered booking steps above the catalogue. Mobile (700px and below): sticky horizontal tracker; labels wrap and all three steps fit typical phone widths, with horizontal overflow available on very narrow screens. Buttons retain useful touch targets. Client pinch zoom is enabled.
- The owner explicitly replaced the former black step boxes with the supplied reference's tracker on 2026-10-30: three numbered circles connected by neutral lines, with labels underneath. The current circle uses a teal gradient and white number; inactive circles are muted grey. The centred italic Current step label and aria-current=step follow the active panel. No animated shine.
- Your booking: a right-hand summary panel on desktop (over 900px), below the main content on smaller screens. It shows the selected private service’s name, duration/people and total price per booking, or Choose a session when nothing is selected. It refreshes with the existing catalogue selection/polling, clears removed services and hides for inactive/missing businesses. The existing date picker and available times now sit below the service summary, with the existing booking button below them.
- Choose a session: text-only published service cards with service details. The owner requested removing catalogue picture placeholders on 2026-10-30. Empty catalogue has an honest non-interactive No services added yet card. No real service records or business photos were added. Photo upload remains future work.
- Choose date & Time: the existing calendar is now in Your booking, shown alongside the catalogue during session/date-time browsing. The date/time step highlights the tracker and focuses its heading without hiding the catalogue. Checkout still opens its existing placeholder. Existing calendar/selection logic now uses a Monday-first monthly date grid, month arrows and real availability markers. Empty days say No available times for this date. No bookable times are fabricated. Selection persists across steps/polling; changing days clears the time.
- The black/white Select a time to book button stays below the date/time controls inside Your booking and visible across all steps. Do not remove or hide it when styling/navigation changes. It stays disabled until a valid real selection and updates its label when a time is selected; its existing details navigation is retained.
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

Read AGENTS.md, this latest section and docs/client-booking-flow.md on current main. Confirm the client state and preserve all owner preferences above. The owner should review the latest client shell first; discuss the next small edit before changing code. The latest authorized edit replaced the date tabs with a monthly calendar inside Your booking. Agree on the next small client edit before changing anything. Do not jump to admin, Supabase, duration scheduling, reservations, cart or payments. Browser verification remains pending.

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


## Remove catalogue picture placeholders — 2026-10-30

At the owner's request, removed the picture area, image icon and No photo yet label from client service cards and the empty catalogue card. Service text, selection controls and the bottom booking button are retained. Client-only app.js/catalogue.css edit with index.html cache-version updates. No admin, backend or business-data changes. Continue reviewing the client shell one small agreed edit at a time; duration/class scheduling remains pending.

Validation: reviewed the removal and checked JavaScript syntax and preserved card/selection code. Production deployment and live asset checks are required for this release. Actual desktop/mobile browser rendering remains outstanding: the local browser could not create a profile because filesystem access was denied.


## Horizontal client booking tracker — 2026-10-30

The owner approved moving the existing three booking-step buttons above the catalogue as the next small change toward their supplied visual reference. Desktop now uses a single content column with three equal-width buttons above the panels. The sticky horizontal scrolling mobile row remains. Existing labels (including Choose date & Time), black/white styling, silver current-step border, centred italic Current step label, aria-current updates and navigation remain. Catalogue picture placeholders stay removed; the bottom booking action remains below the panels. No admin, backend or business-data changes.

Validation: checked the CSS/HTML changes against the existing navigation selectors and preserved mobile touch targets. Actual desktop/mobile browser rendering remains outstanding because local browser profile creation is denied. Save and verify this production release and its changed assets. Next: owner reviews the horizontal tracker before another small client edit; no booking-summary panel or scheduling work is authorized by this change.


## Numbered client booking tracker — 2026-10-30

The owner explicitly approved replacing the black step boxes with three numbered circles and connecting lines, labels underneath and the current step highlighted, matching the supplied screenshot. Updated client HTML/CSS only: teal current circle, muted inactive circles, neutral connecting lines, retained labels and italic Current step label. Existing button elements, data-step/aria-controls/aria-pressed/aria-current attributes and JavaScript navigation remain. Numbers are decorative for assistive technology. Focus outlines remain visible; mobile labels wrap within three equal columns, with scrolling available for very narrow screens. The bottom booking button and text-only catalogue remain. No admin, backend, service-data or payment changes.

Validation: markup/selector and responsive layout checks, plus existing showStep navigation exercised for all three steps. Verify deployment and changed live assets before reporting release. Desktop/mobile visual verification must be reported separately; it was previously blocked by local browser-profile filesystem permissions. Next: owner reviews this tracker before another client edit. Booking-summary panel and scheduling are not part of this edit.


## Your booking summary panel — 2026-10-30

The owner approved the next small client edit: a Your booking panel beside the catalogue showing the selected service's name, duration and price, with Choose a session when unselected. Client HTML/CSS/JS now render the summary from existing selectedService state. Private per-person prices use the configured participant count and show the total per booking, matching existing details. Text uses textContent; unchanged text is not rewritten during polling. Service edits update the summary; removal/hiding clears it. Missing/inactive business responses hide it. Desktop uses a wider two-column layout; at 900px and below the summary stacks after the main content. No images, new service data, admin/backend changes, date/time controls in the summary, reservations or payment changes.

Validation: JavaScript syntax and in-memory DOM/selection checks for empty state, selection, per-person totals, edited and removed services, safe text rendering and navigation preservation. Verify production and changed live assets before reporting release. Actual desktop/mobile visual browser verification remains outstanding due to local browser permission failures. Next: owner reviews this summary before authorizing date/time controls or another small client edit.


## Date/time controls in Your booking — 2026-10-30

The owner approved moving the existing date picker and available times below the service summary in Your booking. Moved the original client-calendar section and bottom booking button, preserving their IDs, date/time-only slot contract, seven local dates, empty days, polling and details navigation. Session and date/time browsing now both keep the catalogue and right-hand calendar visible; the chosen step still updates aria-current and focuses the corresponding section. Checkout remains the existing placeholder and hides the calendar, while the booking button stays visible. The panel continues to stack below the catalogue on smaller screens. No new calendar, fabricated times, duration scheduling, admin/backend, reservation or payment changes.

Validation: JavaScript syntax, markup uniqueness/placement and mocked-DOM checks for both browsing steps, actual date/time-only selection, empty dates, day changes, polling preservation/removal/failure and details navigation. Verify production and changed live assets before reporting release. Actual desktop/mobile browser rendering remains outstanding due to browser permission failures in this environment. Next: owner reviews this layout before another small client edit.


## Monthly client calendar — 2026-10-30

The owner approved a monthly calendar with previous/next arrows, replacing the date tabs within Your booking. Monday-first local dates, month/year header, weekday labels, highlighted selected date and today outline. Dates with returned open/date-time-only slots have a dot; dates without times remain selectable and show the honest empty message. Past dates are disabled and previous-month navigation stops at the current month. Future months remain browsable even when empty. Month browsing preserves the selected date/time and the time heading explicitly identifies that selected date; choosing another date clears the time. Polling preserves the viewed month, empty selected days and unchanged focused day nodes while updating availability markers. Keyboard-accessible buttons have full-date/opening labels; no new grid keyboard interaction is implied. No business data, admin/backend, scheduling-duration, reservation or payment changes.

Validation: JavaScript syntax plus dependency-free tests/client-monthly-calendar.cjs, executed against the modified app/HTML in the session's JavaScript runtime. Covers Monday offset, month/year boundaries, leap years, past/empty dates, date/time-only slots, explicit taken/unknown rejection, focus, month/date/time preservation, slot disappearance, offline/recovery and details navigation. Node executable and actual desktop/mobile browser checks remain unavailable in this environment; do not claim browser verification. Verify production and changed live assets before reporting release. Next: owner reviews the monthly calendar before another small client edit.


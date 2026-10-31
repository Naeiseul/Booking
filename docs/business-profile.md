# Business Profile — approved extension

![Owner-supplied Business Profile reference](references/business-profile-reference.png)

Original: Modern Business Profile Dashboard.png, 1,682,547 bytes, saved unchanged. This is the owner's approved reference for editable Business Profile, following the completed integrated Services workflow. Screenshot names, contacts, photos and sample content are illustrative, never seed business data.

Open Business Profile through a clickable bottom sidebar identity area. Keep Calendar and Services as the only primary navigation items. Separate View client page and Preview client page links open the actual public booking page in a new tab.

Reuse the existing business record, admin-link authorization, neutral design, logo/contact/social fields and credential-checked photo upload infrastructure. Add minimal backwards-compatible profile fields for tagline/about, separate phone/email/website, hero/gallery, social visibility, location/delivery methods and concurrency. Slug remains read-only. Provide previews, 5 MB JPG/PNG/WebP validation, safe URLs, retained input/retry/error/cancel handling and public display of configured fields. No colour extraction, new auth/logout, payment onboarding, service/calendar redesign or invented records.

Implement and verify authorized profile editing end-to-end, save/deploy and update the handoff. Shared classes stay unbookable, service payments disabled, Order summary paused; scheduling/capacity → reservations → verified payments remains the sequence.

## Implemented 2026-10-31

The sidebar footer opens the profile workspace; Calendar and Services remain the only main links. Profile fields persist on the existing businesses row through credential-checked RPCs, with optimistic profile_version checks and identical-request retry recovery. The slug is read-only. New public information is optional; blank sections disappear and the approved booking/catalogue layout remains. Phone and WhatsApp now have separate fields; the migration preserves existing call-link behaviour.

Branding uses the existing credential-checked service-photo-upload function and service-photos bucket without changing them. Previews use object URLs; images upload only on Save, retain retry IDs/paths after failures and preserve logo proportions. Gallery accepts up to 12 images. Removing a branding image removes the profile reference; it does not delete shared storage objects or service photographs. Cancel discards previews and restores the loaded profile. The original mockup stays unchanged in GitHub.

Verification: SQL fixtures roll back; native Calendar/Services/client regressions pass; Chromium at 320/390/820/1440px covers profile/image previews, mocked uploads, saves/reloads, failure recovery, validation, stale edits, public rendering, navigation and no overflow. Actual 390px browser-to-Supabase profile save/public refresh passed on a disposable QA business, which was deleted. That real test deliberately skipped image uploads; careful real Supabase picture-upload verification is the owner's next requested stage. Physical Safari/iOS remains untested.

The owner additionally requested an admin-only past-time Calendar notification. Expired times render black; clicking rechecks the South African clock and shows “09:00 has passed. Clients can only book future times.” without sending a slot write. Future slot saves remain unchanged. This is an admin UI guard; the public API already excludes expired times.

Next: carefully verify Supabase photo handling, then inspect how the owner's actual configured services appear in Admin and on the client page. Do not seed screenshot/example offerings into Logtraq.


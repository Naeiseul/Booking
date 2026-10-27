# Client slot selection and details flow

Implemented for the Booking demo on 2026-10-26.

## Behaviour

- The public API filters to open slots and returns date/time without a status field. These slots are keyboard-accessible buttons. Explicit open status is also accepted; explicit taken or unknown statuses cannot be selected.
- Selecting an open slot highlights it without leaving the calendar. A bottom button shows the selected day, date and time (for example, Book Tuesday 27 October at 10:00). Only clicking this button navigates to /:biz/details?date=YYYY-MM-DD&time=HH:mm.
- The button is disabled until a time is selected. Switching days clears the selection. Availability refreshes preserve a selection while it remains available, clear it if the slot disappears or becomes unavailable, and disable continuing if the refresh fails.
- The details page shows the selected date/time and collects name, surname, phone, email, and optional notes.
- Required fields are validated, and availability is fetched when the page opens and again before payment.
- Continue to payment opens the existing Paystack page at https://paystack.shop/pay/o495iejvn3.
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

- The Logtraq client calendar and details page use `logtraq-favicon.svg`, a compact, transparent version of the existing symbol. Page titles and the business name are unchanged. The calendar keeps this favicon when the business logo loads; the avatar and installed-app icons retain their existing images.
- Optional TikTok profile links are stored in `public.businesses.tiktok_url`, alongside Instagram and Facebook, and returned by `get_public_page`.
- The TikTok icon stays hidden until a valid HTTPS link on tiktok.com or one of its subdomains is saved for the business. Clearing the field hides the icon again. No sample TikTok profile is saved.
- The database change is recorded in `supabase/migrations/20261027125000_add_tiktok_url.sql`. It preserves the public slot contract: only available slots, with date/time and no status field.
- Chromium checks verified transparent favicon pixels, unchanged tab title, conditional TikTok visibility and rejection of invalid destinations. The client booking flow regression suite also passed under Node.

# Client slot selection and details flow

Implemented for the Booking demo on 2026-10-26.

## Behaviour

- The public API filters to open slots and returns date/time without a status field. These slots are keyboard-accessible buttons. Explicit open status is also accepted; explicit taken or unknown statuses cannot be selected.
- Selecting an open slot navigates to /:biz/details?date=YYYY-MM-DD&time=HH:mm.
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

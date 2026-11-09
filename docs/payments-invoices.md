# Payments and invoices implementation

The owner explicitly resumed building and supplied info@logtraq.co.za for the finance owner and invoice/receipt sender. This supersedes the pause below. Real values only: no visible test/environment selector, no sample production invoices/payments, and no paid email marketplace connection. Payments is now an authorised third primary admin section alongside Calendar and Services.

### Implemented
- The saved Payments UI, invoice/customer page, immutable invoice numbering/totals, private customer links, PDF generation, merchant verification/webhooks, history import and authenticated finance membership are being released from the paused candidate.
- Added real direct Resend API delivery, requiring an explicitly configured API key and verified sender. No paid integration/account/subscription was provisioned. Invoice emails, verified-payment-only receipts, manual resend of confirmed-sent messages and owner sign-in emails share a protected delivery queue.
- Database leases prevent concurrent sends. Frozen payloads and stable provider idempotency keys preserve the same message across uncertain retries. Ambiguous retries stop for review after 20 hours (inside Resend's 24-hour idempotency window), five attempts or expired sign-in links. A rolling 95-job reservation limit per sending key keeps this app below the free daily allowance.
- A signed pg_cron/pg_net dispatcher runs every five minutes only for enabled senders with due jobs. Its random signing secret and all queue/quota tables are closed to browser roles. With email_enabled=false it makes no outgoing email requests.
- info@logtraq.co.za is approved in Logtraq's finance account and configured as sender, with email_key_env RESEND_API_KEY_LOGTRAQ. It is NOT email-verified yet; no real auth user or membership has been fabricated. Email sign-in generates a Supabase one-time link only after actual email service setup, only for the approved address, with existing admin ownership and a one-minute rate limit. The requesting browser never receives the sign-in token. After verification, the server activates only that approved owner's membership.
- Added a token-scrubbing finance-login callback page and session handoff to the existing admin dashboard. Password sign-in remains available for an existing authorised account.
- Email "sent" means accepted by Resend, not a claim of inbox delivery. Delivery/bounce webhooks are not implemented.

### Verified
- Native finance API tests and email renderer/worker tests pass, including raw Paystack signatures/replay checks, ownership/private links, real-value amount checks, no charging without credentials, escaped templates, identical retry payload/key, reversal guard and disabled sender no-op.
- Approved-owner sign-in privacy and signed dispatcher unit checks pass.
- Email SQL suite passes with fixtures rolled back: leases, stale completion rejection, frozen payload, one quota reservation across retries, old/expired-job review, free quota limit and closed permissions.
- Chromium 320/390/820/1440 checks pass for Payments sign-in/navigation, entered invoice cents, lost-response retry ID, invoice-email queue action, PDF download, safe text, sign-out cleanup and no overflow. The customer page has no test-mode UI.
- Existing Services and admin navigation checks pass. Earlier actual isolated browser -> Supabase Auth -> invoice -> PDF -> private customer link pass remains valid for the foundation; all its disposable rows/users were deleted.
- Security advisors contain the pre-existing calendar-function warnings and intentional RLS/no-policy informational notices for server-only finance tables; no new definer functions were added.
- Finance API is ACTIVE v3. Applied additional migrations: 20261109123642 finance_email_delivery and 20261109124047 finance_mail_scheduler. Schema/config changes are live; email_enabled and live_enabled remain false.
- No real Paystack call/charge or outgoing email was executed. Finance invoices/payments/email jobs/members remain empty; no test screen or sample customer transaction is published. Production asset/release checks are recorded after this commit.

### Remaining actual activation
1. Use a free direct Resend account; verify the logtraq.co.za sender domain. Store its sending key as RESEND_API_KEY_LOGTRAQ in Supabase Edge Function secrets (never in chat, frontend or Git). Enable the private finance account sender only after verification. No Vercel marketplace billing connection is needed.
2. Configure the real Paystack account secrets (PAYSTACK_SECRET_KEY_LOGTRAQ and PAYSTACK_WEBHOOK_SECRET_LOGTRAQ), real integration ID and account binding. Add the webhook URL .../functions/v1/finance-api/webhook/logtraq in Paystack. Complete a controlled, explicitly operated real payment/email check before normal live charging is activated. Existing R1 demo checkout is untouched.
3. Full/partial refund processing, disputes, settlement reconciliation and delivery/bounce monitoring remain later work. Current verified "reversed" states are supported; historical imports suppress unsolicited old receipt emails.
4. The PDF's Helvetica/WinAnsi fallback still replaces unsupported characters with ?. Customer HTML keeps full text; broader Unicode PDF support remains a known limitation.

Preserve existing records/photos/pricing, real Paystack destination, date/time-only slots, unbookable unscheduled classes and paused Order summary. Invoice payment does not reserve or confirm an appointment/class. The paused section below is historical.

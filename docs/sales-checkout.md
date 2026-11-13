# LogTraq sales checkout (platform sales, not merchant invoices)
Offer: R1,000 setup, R250 deposit and R750 on handover; one month free management.
Customer route: /sales.html -> Paystack -> /sales-confirmation.html.
Backend: Supabase Edge Function sales-checkout, database logtraq_sales_orders / logtraq_sales_events.
Checkout intentionally disabled unless SALES_CHECKOUT_ENABLED=true and PAYSTACK_SECRET_KEY_LOGTRAQ is set.
Webhook: https://jtonmfevmcmnkmdjmubn.supabase.co/functions/v1/sales-checkout/webhook
The webhook requires a valid Paystack signature and independently re-verifies the provider transaction.
Orders are isolated from merchant finance_accounts and finance_payments.
TODO: Resend welcome-email delivery (verified sender), review service terms and user acceptance evidence, smoke test live transaction, agree activation.

# Booking project working agreement

- Work one small step at a time; prioritize working behaviour and data integrity.
- Latest catalogue redesign direction: read docs/catalogue-redesign.md and the newest handoff section before editing. Keep category (catalogue organisation), service (offering purchased), and booking type (scheduling rules) separate. The Order summary addition is paused.
- Saved visual references: docs/references/final-visual-plan.png (customer/combined) and docs/references/admin-interface-reference.png (important admin target). Read docs/admin-interface.md before admin visual work. Images are staged design targets, not authorization to implement all pictured features or sample data.
- Follow the catalogue sequence in docs/PROJECT_HANDOFF.md. Questions and discussion may clarify the current step; they do not change, reorder, or expand the implementation plan unless the user explicitly asks to change it.
- Finish and verify the current authorized step before starting another. Record progress and the next step in the handoff.
- Save completed changes remotely to GitHub and deploy completed fixes to the live demo. Verify the production deployment and affected live assets before reporting completion.
- Client: https://booking.logtraq.co.za/logtraq
- Admin: https://booking.logtraq.co.za/admin/logtraq/logtraq
- Keep the real Paystack checkout at https://paystack.shop/pay/o495iejvn3. Do not substitute a simulated checkout.
- get_public_page returns available slots with date/time and no status. Do not require status === 'open'; preserve regression coverage.
- Preserve unrelated work and never print or commit credentials.

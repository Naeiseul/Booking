# Booking project handoff

Last updated: 2026-10-26.

## Current scope

The owner is preparing cloud development and deployment access. Do not implement payment plans, checkout, subscriptions, or payment restrictions until requested. No plan names, prices, billing intervals, or entitlements have been chosen. Future payments are intended for business owners on the administrative side, rather than visitors booking appointments.

## Project

- GitHub: Naeiseul/Booking; production branch: main.
- Frontend: plain HTML, CSS, and JavaScript; no package manifest, build command, or automated test suite.
- Public calendar: index.html and app.js.
- Administrative calendar: admin.html and admin.js; existing access uses business slug and admin key.
- Vercel routing: /:biz and /admin/:biz/:key in vercel.json.
- Serverless manifest endpoint: api/manifest.js.
- Supabase project reference: jtonmfevmcmnkmdjmubn.
- Vercel project: booking; ID prj_2qzF3xJp1pPt3VO16mNgdVYHQTUV.
- Vercel account/team ID: team_ORAa7CrGuWI7XCatgWzEsosW.
- Vercel is connected to this GitHub repository with main as production branch.

## Verified in the onboarding session

- Git read and push dry run succeeded; the dry run did not create a branch.
- Supabase management API project lookup returned HTTP 200 and ACTIVE_HEALTHY.
- Vercel project lookup returned HTTP 200.
- Paystack test-mode read-only API request returned HTTP 200 and status true. No payment was created.
- Local frontend routes, assets, and manifest passed HTTP checks. Root and incomplete-admin-link browser smoke checks passed.
- No payment feature was implemented and no application deployment was performed.

These results apply to the onboarding session, not automatically to every future task. Recheck credentials and network access without printing secret values.

## Cloud environment

The owner published reusable installation/startup instructions and securely configured SUPABASE_ACCESS_TOKEN, VERCEL_TOKEN, and PAYSTACK_SECRET_KEY. PAYSTACK_SECRET_KEY was verified as a test secret key. Never commit or print credentials. Do not copy credential files or the tracked .env into documentation or logs.

Allowed custom HTTPS destinations were configured for api.supabase.com, api.vercel.com, api.paystack.co, and jtonmfevmcmnkmdjmubn.supabase.co.

The saved install script creates /workspace/booking-tools/server.cjs outside the checkout. The saved startup instructions start that helper on port 3000. It handles frontend rewrites and the manifest endpoint, and excludes .env and other non-frontend files. It is not a general Vercel emulator. Live processes need restarting in new tasks. If the helper is absent, follow the environment's saved install instructions. Do not expose this checkout through a generic directory server.

Use existing checkouts: each cloud task is isolated. Do not create a Git worktree unless explicitly requested. Preserve existing changes and do not assume a fixed checkout path in a fresh task.

## Resume from a new device or chat

1. Sign in to the same account and select the published Booking cloud environment for a new cloud coding task.
2. Ask the agent to read this file before doing work.
3. Confirm this file is present on the selected branch; the handoff may initially be on a pull request branch rather than main.
4. Check available credential names/presence and make read-only service checks. Never request secret values in chat.
5. Read git status and current branch before editing. Save meaningful work and update this handoff through GitHub branches/pull requests.

Opening an environment editor may open a separate setup conversation. This document preserves project context, not the chat transcript. Cross-device restoration of the published environment still requires a fresh-task check. Do not promise that a setup chat URL will appear in regular ChatGPT history.

## Next work

- Confirm this handoff is available to fresh tasks through the selected branch or a merged pull request.
- Open a fresh cloud task with Booking selected and verify repository/setup/credential availability.
- Await the owner's feature requirements before building payment functionality. Store payment secret keys only on the server and verify payments server-side when that work is authorized.

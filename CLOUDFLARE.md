# PetMan on Cloudflare

The screens come from `nightweixd/pet` at commit `99a2686` (source supplied on 25 October 2026). Changes are maintained in `nightweixd/petman`.

## Architecture

- Next.js exports the UI to `out/`. Cloudflare Workers serves those assets and the API on the same origin.
- D1 stores customers, pets, appointments, memberships, booking requests, services, users, password hashes, sessions and audit records.
- Better Auth handles passwords, signed cookies, eight-hour sessions and authentication rate limits. There is no Supabase connection or payment integration.
- Admins have full business access. Customer logins are linked explicitly by an admin and can only read their own records. Missing or disabled profiles are denied by the backend.
- `/book`: public request form. `/bookings`: admin queue and packages. `/staff`: user management and password change. `/setup`: first admin setup, protected by a private token and available once.

## Local setup

Requires Node.js 22+ and npm.

```powershell
npm ci
Copy-Item .dev.vars.example .dev.vars
```

Replace both example values in `.dev.vars` with different random secrets of at least 32 characters, using a password manager. Never commit that file.

```powershell
npm run types
npm run db:local
npm run dev
```

Open `http://localhost:8787/setup`. Enter the setup token and your admin details, then sign in at `/`. Add actual service packages in `/bookings` before sharing `/book`.

`APP_ORIGIN` must match the exact browser origin, including the port. Use `localhost`, not `127.0.0.1`, for local browser requests. Never expose the Wrangler emulator publicly.

## Production deployment

The database ID in the committed config is a local placeholder. Builds and tests do not create a production database or deployment.

```powershell
npx wrangler login
npx wrangler d1 create petman
```

Put the returned `database_id` in `wrangler.jsonc`. Set `APP_ORIGIN` to the final HTTPS app URL and verify `BUSINESS_TIMEZONE`. Keep staging and production in separate Worker configurations and databases.

Set secrets through interactive prompts:

```powershell
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put SETUP_TOKEN
npm run db:remote
npm run deploy
```

If a new Worker must exist before secrets can be set, deploy the bundle first, then set both secrets before setup or sharing the app. Authentication requires `BETTER_AUTH_SECRET`. Create the real admin at the production `/setup` page, then remove the setup token with `npx wrangler secret delete SETUP_TOKEN`. Keep `BETTER_AUTH_SECRET` stable across deployments.

## Booking behavior and assumptions

- One salon resource, one-hour slots starting 09:00 through 16:00, every day, within 90 days. Change `src/booking.ts` for a different schedule; multiple groomers, closed days and variable durations need additional scheduling logic.
- Submissions are **pending requests**. Staff contact customers and confirm or cancel them. Pending requests occupy their selected slot until staff act. No automatic expiry or notifications are included. Slots are reserved only when the details form is submitted.
- A database unique index prevents simultaneous requests taking the same slot.
- On confirmation, staff select an existing customer after verifying identity or create a new one. A new pet is captured. A guest submission cannot overwrite existing identity or membership fields. Staff should review duplicate pet records for returning customers; existing-pet matching is not included.
- Customer birthday, pet birthday and optional marketing consent with its capture timestamp are stored. Existing memberships keep their consent when linking a guest request. Staff can change consent through Members. Marketing delivery and consent withdrawal screens are not automated.
- Completing a booking records one appointment at the quoted amount. Membership spending/tier views derive from appointment amounts. The app does not verify payments or apply discounts automatically; staff adjust the visit amount to the actual charge. Configure example tier rules before use.
- Two roles are included: admin and read-only customer. Receptionist and groomer roles are not separate permissions yet.

## Existing data and backups

No live Supabase data is copied automatically. Export a PetMan JSON backup from the old app and import it through Backup & Restore. The updated export also includes membership tables, tiers and packages. Imports **merge by record ID** in one D1 transaction. They preserve records absent from the file, reject unknown columns and roll back on errors. Recreate login accounts: passwords and sessions are excluded.

Business JSON backups exclude booking requests and audit history. Use a complete D1 export for disaster recovery:

```powershell
npx wrangler d1 export DB --remote --output petman-full-backup.sql
```

A full export contains sensitive customer and authentication data. The in-app import supports 2,000 records total and a 1 MB request. Large imports need D1 tooling. Existing screens load at most 10,000 records per query, and the booking queue shows 1,000; add pagination before exceeding these bounds.

## PR previews

Workers Builds uses `npm run build` followed by `npx wrangler preview` for PR #2.
The `previews` block in `wrangler.jsonc` binds the separate `petman-preview` D1
database. Preview data is shared between previews using this configuration, so
use fictional records only. Production bindings and secrets are not inherited.
An independent `BETTER_AUTH_SECRET` is stored in Cloudflare's Preview base config.
First-admin setup is disabled until an operator sets a preview-only `SETUP_TOKEN`:

```powershell
npx wrangler preview base-config secret put SETUP_TOKEN
npx wrangler d1 migrations apply PREVIEW_DB --remote --config wrangler.preview-migrations.jsonc
```

The preview schema is initialized through migration 0003. Apply future migrations
with the command above; keep its database ID and `previews.d1_databases` in sync.
`previews.vars.APP_ORIGIN` currently matches the PR #2 branch URL. For another
branch, override it to that preview's exact HTTPS origin when deploying:

```powershell
npx wrangler preview --var APP_ORIGIN:https://<preview-hostname>
```

Never use the production database or production secrets in a public preview.

## Verification commands

```powershell
npm run typecheck
npm run build
# With the local server running and migrations applied:
npm test
```

Integration tests require an unused local database on first run. They create a local test admin and save test credentials under ignored `.wrangler/test-credentials.json`; they never target production. Tests leave some clearly named fixtures in the local database. Use a separate local persistence folder when working with real development data.

Tests cover login, customer isolation, denied registration, SQL-field validation, session revocation, concurrent bookings, membership capture, completion idempotency and import rollback.

Public booking is rate limited by Cloudflare's connecting-IP header. Email/SMS invitations and self-service forgotten-password recovery are not configured. Admins create accounts with an initial password and reset customer passwords through Customer Accounts. Any signed-in user can change their own password at `/staff`. Losing all admin access requires operator-assisted D1 recovery. Expired request-rate rows can be periodically purged using their `expires` timestamp; expired sessions are rejected even before cleanup.

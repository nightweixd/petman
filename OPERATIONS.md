# Salon operations and invoicing

This change builds on the merged customer login and portal booking flow from PR #4.

## Daily use

- **Day board**: choose a date; move confirmed bookings through scheduled, arrived, grooming, ready and collected. Complete the visit in Bookings to record the visit amount. The collection stage is separate from payment collection.
- **Customer care**: search by owner, customer reference, phone, pet or tag. Results are paginated on the server. Open a customer to review pets, care alerts, visits, linked bookings, invoices, internal notes and follow-up tasks. Save reusable customer filters, and assign tasks with due dates.
- **Invoices**: choose a customer and enter line items, quantities, MYR unit prices, discount and an optional tax amount. Issue dates, customer details and salon details are captured on issue. Issued invoice amounts are immutable. Void invoices with no payment history; issue a replacement for corrections.
- **Payments**: record money already received by cash, bank transfer, card or another method. Record refunds separately. This does not charge cards or transfer money. The backend rejects overpayments and refunds above net collections and prevents a retried payment request from being recorded twice.
- **Print / Save PDF** opens the browser print workflow with the invoice document only. Payment history is included. Reporting distinguishes invoice sales, net collections, refunds and balances. Older appointment amounts remain labelled as recorded visit value, not cash received; old visits are not automatically invoiced.
- **Salon settings**: set business and invoice details before issuing invoices. Configure opening hours, closed weekdays, holidays, groomers and their breaks, service duration and cleanup buffers in 15-minute increments. Changing availability does not move existing bookings. Contact affected customers separately.
- **Message templates**: prepare confirmations, reminders and collection messages on the day board. Review before opening WhatsApp or copying. Messages are not sent automatically. Automatic email/SMS/WhatsApp delivery needs a provider connection and approved sender; no external messages are sent by this change.

## Accounts and permissions

- Owners manage settings, users, backups and all records.
- Receptionists manage customers, bookings, follow-ups and invoices, without owner-only account/settings/backup access.
- Groomers use the day board and care alerts, without invoice or customer-export APIs.
- Customers retain PR #4's own-record portal and saved-pet booking flow. Customer and pet ownership is checked on the server.
- Everyone can change their password through Your account. Owners choose a staff role when creating an account. Password recovery continues to use the existing salon-assisted workflow.

## Recovery and backups

New customer archives retain original rows and IDs, including membership data and customer-login links. Archived customers cannot use their account until restored. Restore is atomic. Legacy snapshots restore only what was originally saved; missing historical membership/login data cannot be reconstructed. Failed legacy restores retain their recovery snapshot. Permanent deletion of recovery snapshots is disabled.

Business backup version 3 adds booking state/occupancy, customer notes, follow-up tasks, saved views, settings, invoices and payment history. Imports merge atomically; existing invoice/payment records are not overwritten. Saved views whose owner is absent are skipped; tasks with an absent assignee become unassigned. Authentication tables and secrets are excluded. Use a full D1 export for account-level disaster recovery. The existing 1 MB request / 2,000 imported statements limits remain; use D1 tooling for larger data sets.

## Release procedure

1. Export the production D1 database and retain that backup privately.
2. Apply `migrations/0004_salon_operations.sql` to the intended database before deploying the new Worker. Use the existing database binding; do not create a replacement production database. The migration retains all customer and financial data, adds new tables, and replaces the old one-slot booking index with per-groomer occupancy.
3. Apply the same migration to the isolated preview database before testing the PR preview. `wrangler.preview-migrations.jsonc` explicitly targets that preview database.
4. Deploy the new Worker with the existing production URL and secrets. Existing production configuration is provided by Cloudflare's build settings; the default repository binding remains local-only.
5. Verify owner/customer login, a returning-pet booking, archive/restore, invoice issue, payment/refund and invoice printing. Configure service hours and actual salon invoice details.

No production migration or deployment is implied by opening this PR. This branch uses the existing isolated preview binding. Review changes before rollout. Rolling back application code after migration is possible; do not drop the new tables or remove invoice/payment data.

## Local verification

Use an isolated persistence directory to avoid prior fixtures exhausting rate limits:

```powershell
npx wrangler d1 migrations apply DB --local --persist-to .wrangler/verify
npx wrangler dev --port 8898 --persist-to .wrangler/verify --var APP_ORIGIN:http://localhost:8898
# In a second terminal, with throwaway local-only .dev.vars values:
$env:TEST_ORIGIN='http://localhost:8898'
$env:TEST_FIXTURE_PATH='.wrangler/verify-credentials.json'
npm test
npm run typecheck
npm run build
```

The tests use local test accounts and never target production. Test login retries respect the configured sign-in rate limit. Keep `.dev.vars` and `.wrangler` out of source control.

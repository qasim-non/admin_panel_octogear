# Step 7: Payments directory

Implemented 2026-10-21. Read `ARCHITECTURE.md`, `ORDERS_STEP.md` and the API's
`AGENTS.md`, `CODE.md`, README and payment section of `INTEGRATIONS.md` before
extending this feature. Reference: the original read-only `Payment.png` in
`C:/Tamkkun/yardy/Admin panal`; OctoGear branding and current contracts take precedence.

## Screen and review scope

Open **Payments** from the sidebar. Each row represents one retained payment
record, with payment/order IDs, customer, fulfillment store, order type, requested
part, recorded amount, payment method/status and UTC timestamps. The table keeps
25 records per page. Payment status is Pending, Paid, Failed or Refunded, matching
Laravel; the wireframe's request-approval statuses are not payment statuses.

Search matches customer name/phone or fulfillment-store name. Combine it with
order ID, customer city, payment status/method, order type and inclusive UTC
creation dates. Apply/Clear are explicit; typing does not repeatedly fetch the
payment directory. Cities use the existing lazy catalog with local bilingual
search. Date filters describe record creation, not an invented `paid_at` field.

Filters and page live in the URL. Opening an order carries that context; **Back
to payments** restores it even after refresh. The existing order payment card now
links to all records for that order, since its single payment relation is not a
complete attempt history. Soft-deleted orders retain their table context but have
no link to an unavailable order details page.

The navy/white OctoGear shell, PrimeNG controls, typed English/Arabic translations,
RTL, keyboard-focusable table scrolling, loading, empty, failed, denied and
expired-session states follow the existing web conventions. Superseded reads are
cancelled; a disappeared final page returns to the last available page.

## Amounts and retained history

- Display the payment row's integer `amount` in SAR, divided by `price_scale: 100`.
  Never recompute payment amounts from current offers, quantity or inventory prices.
- Retain separate rows for multiple records associated with one order. This read
  view does not authorize retries or change the current charging eligibility rules.
- Include retained soft-deleted payments with an **Archived record** label. Prepare
  soft-deleted order, accepted offer, inventory, component and store context locally
  to this query; do not change model-wide relationship visibility or mobile APIs.
- Customer/store/part labels are current related data, not immutable payment-time
  snapshots. Missing context stays absent. Permanently removed data is not recovered.
- Pending/Failed values are not collected revenue. Refunded is a recorded payment
  status, not a payout/settlement ledger. No revenue totals or commission estimates.
- Read-only: no charge, retry payment, refund, edit, delete, export, notification
  or gateway call. Live gateway integration remains separate work.

## Laravel: review in this order

1. `routes/api.php`: new GET `/api/admin/payments` inside existing
   `auth:sanctum,admin` and `admin.active` middleware.
2. `PaymentPolicy::viewAdminDirectory`: explicit admin-only read ability. Existing
   customer payment-policy methods are unchanged. Preserve the current admin rule:
   blocked admins are denied; this slice does not redefine inactive status.
3. `PaymentIndexRequest`: supported enums, bounded search, positive IDs/page,
   non-deleted city selection and YYYY-MM-DD date validation. Invalid date ranges
   use the standard localized 422 envelope and `lang/en|ar/admin_payments.php`.
4. `AdminPaymentController`: authorize, pass validated input to the injected query
   service, and return standard paginated resources with private/no-store headers.
5. `AdminPaymentQueryService`: prepared history relations and combined filters.
   Search OR conditions stay grouped inside the order relation. Exact order ID,
   status, method, type, city and date conditions still apply. Date-to uses the next
   UTC day as an exclusive upper bound. Creation timestamp/ID descending ordering
   is stable for equal timestamps; pages contain 25 records.
6. `AdminPaymentResource`: extends the existing payment field transformer and adds
   only display metadata/context. Uses `Order::fulfillmentStore()` and
   `requestedComponentName()` instead of duplicating the domain resolution rules.
   No database query occurs during serialization; no gateway metadata is exposed.
7. `AdminPaymentDirectoryTest`: bearer/role isolation, unchanged records, recorded
   amounts, multiple/archived attempts, historical context, localization, combined
   filters, date boundaries, validation, stable pagination and query-free resources.

No migration, retained-data update, gateway configuration or worker change is
needed. Deploy the new read endpoint before/with the web build. Older APIs show a
recoverable error rather than simulated payment data.

## Angular: review in this order

1. `features/payments/payment-api.service.ts`: typed response/filter contracts,
   enum-to-copy mappings and checks through the existing central ApiClient.
2. `payment-directory.component.ts/.html`: reactive filter form, cancellable reads,
   URL navigation, table, actual API result counts, error handling and pagination.
3. `payments.scss`: feature-specific filter/table styling on existing user surfaces.
   PrimeNG's `tableContainer` pass-through attributes label and focus the actual
   scrolling region; arrow keys scroll its columns in both layout directions.
4. `shared/money.ts`: shared SAR formatting used by Payments and the existing
   Orders detail view, retaining that view's missing-value behavior.
5. Order detail back/history links, lazy route, menu and `core/i18n/en.ts` / `ar.ts`.
   Language preference persistence is unchanged; read `LANGUAGE_PREFERENCE_STEP.md`.

The API address remains exclusively `public/app-config.json`. Payment data is
not persisted in browser storage or polled in the background. Browser verification
uses intercepted synthetic fixtures and a separate preview on port 4202. Exact
verification results and existing baseline failures are in PROJECT_DOCUMENTATION.md.

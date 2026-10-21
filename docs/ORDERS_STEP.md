# Step 6: Orders directory and review

Implemented 2026-10-21 from the read-only `Orders.png` and `Order details.png`
references in `C:/Tamkkun/yardy/Admin panal`. Read `ARCHITECTURE.md`, the API's
`AGENTS.md`, `CODE.md`, and README order/payment contracts before extending it.

## Review the screens

Choose **Orders** in the sidebar. The directory shows ID, UTC date, customer,
fulfillment store, general/specific type, requested part, and status. Filter by
order ID, customer name/phone, customer city, type, status, and creation dates.
All filters combine in Laravel before the existing 15-row pagination. The city
picker reuses the lazy bilingual catalog and searches locally. Date bounds are
explicitly UTC: both selected calendar dates are inclusive. An end date before
the start is rejected locally and on the server.

Applied filters/page stay in the URL through details, Back, and refresh. Older
in-flight searches are cancelled. A vanished last page returns to the last valid
page. Loading, no matches, permission errors, missing details and session expiry
have distinct feedback. Tables scroll inside their panels on narrow screens.

Details group request, vehicle, customer, store, private photos, offers, and the
existing payment record. General requests show the submitted vehicle snapshot;
specific requests label their linked inventory vehicle as current information.
No quantity is invented for a general request. General offers are whole-request
totals; specific requested/agreed prices are per unit. Amounts use the API's SAR
minor-unit contract (100 halalas per SAR). Current inventory prices are not used
as historical request prices. Payment amounts come from the returned record;
no fictitious commission or surcharge from the old wireframe is calculated.

Order/offer images load only on interaction through the shared authenticated Blob
viewer. Only the current parent record's protected image paths are accepted.
Customer/store links use existing details pages. Missing references show absence,
not invented contact or vehicle data. Every new UI key has English and Arabic text
in `core/i18n/en.ts` and `ar.ts`; Arabic uses RTL and the existing OctoGear fonts.

## Laravel review order

1. `OrderIndexRequest`: validates optional positive order_id/city_id/page and
   date_from/date_to alongside existing customer/mobile/type/status filters.
   Cities exclude soft-deleted references; invalid dates use localized errors.
2. `AdminOrderService`: applies filters before pagination; date_to uses an exclusive
   next-day UTC boundary, preserving fractional-second records. Descending ID
   breaks timestamp ties. Name/mobile terms equal to `0` remain valid searches.
   `orderRelations()` shares prepared relationships across list/detail; payment
   remains detail-only. Existing offers/images/list contracts are retained.
3. `AdminOrderResource`: adds currency/price_scale, requested unit price for specific
   orders, localized customer/store cities, and specific part/vehicle labels.
   These relations are prepared by the service; serialization performs no queries.
4. `AdminOrderDirectoryTest`: combined filtering, UTC edges, date validation,
   deterministic pagination, bilingual details, deleted cities and query checks.
   Existing `AdminOrderManagementTest` guards reads, permissions and lifecycle rules.

Existing GET `admin/orders` and GET `admin/orders/{id}` are reused. No Orders
migration, new read route, pricing change, payment attempt, notification, or order
state transition is introduced. Ship additive API fields before/with the web page.

## Angular review order

1. `features/orders/order-api.service.ts`: typed contracts, filter calls and response
   checks through the single ApiClient; shared part/error/media helpers.
2. `order-directory.component.ts/.html`: form, cancellable reads, query state,
   combined filters and PrimeNG table/pagination.
3. `order-detail.component.ts/.html`: fresh details, money presentation, grouped
   records, offers and on-demand private images.
4. `order-status.component.ts`, `orders.scss`: localized status tags and styling
   using the existing user-page surfaces and OctoGear palette.
5. Routes, sidebar and typed dictionaries. Runtime host configuration remains
   exclusively `public/app-config.json`.

## Scope and verification

This is the read-only order-review step shown by the wireframes. Cancel/refund,
payment reconciliation, a full attempt/audit timeline, exports and bulk operations
are separate reviewable features. Existing backend cancellation/refund endpoints
remain unchanged and are not invoked by this page. The existing single payment
relation is shown as a payment record, not a complete payment history.

`tests/orders.spec.ts` covers pagination/filter URLs, local city lookup, money
semantics, lazy images, stale reads, error/permission/session states, and English
desktop/Arabic mobile screenshots. Use the normal web build/typecheck/browser
commands and isolated API tests. Exact results and known baseline failures are in
`PROJECT_DOCUMENTATION.md`. No production deployment or retained-order mutation.

## Step 7 follow-up: payment records

The payment card now links to `/payments?order_id=...`, which lists all retained
payment records for that order. Orders opened from Payments provide a **Back to
payments** link that preserves the directory filters/page after refresh. The
existing single payment card remains a single record. Money formatting is shared
through `shared/money.ts`; pricing and order API behavior remain unchanged.
See `PAYMENTS_STEP.md` for the separate read-only payment directory contract.

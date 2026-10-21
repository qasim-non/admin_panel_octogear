# Store requests — review queue and decisions

Implemented 2026-10-21. Read with `ARCHITECTURE.md`, `CITY_FILTER.md`, and the API's
`AGENTS.md`, `CODE.md`, and `SELLER_ONBOARDING.md` before changing review behavior.

## Screen scope

The four store/provider request wireframes in `C:/Tamkkun/yardy/Admin panal`
describe related review tasks. The current Laravel workflow handles initial seller
applications, additional stores, and proposed changes through store requests.
One **Store requests** sidebar entry therefore opens a queue with a request-type
filter: New store or Store change. An applicant's current account type cannot
reliably identify their role at submission time, so separate provider/store queues
would imply a distinction the API does not preserve.

The default queue shows pending requests. Search matches store name/phone or
applicant name/phone across the server dataset. Status, request type, and city
filters combine before pagination. Clear filters shows all statuses. Applied
filters and page are URL state, retained through details, Back, and refresh.
The existing request endpoint keeps 15 rows per page; user lists still use 25.
City options reuse the shared lazy bilingual catalog: first interaction downloads
it once, and typing searches locally. No new catalog fetch on page entry.

Details show the applicant, submitted store fields, city, supported car brands,
submission/review dates in UTC, protected registration image and proposed photos.
Store changes also show the reason and a before/proposed table; changed rows have
both a text label and a highlight. Historical brand/city labels come from the
detail response rather than extra reference-list calls. Original image snapshots
contain fingerprints, not retrievable historical URLs, so old photos are not
invented or presented as comparable images.

Pending decisions require a confirmation dialog. Rejection requires a nonblank
reason of 1–255 characters. The write is single-flight, and success is followed
by a fresh detail GET. A failed or uncertain response requires an explicit fresh
read before another decision; POSTs are never automatically retried. Already
reviewed requests are read-only. Laravel remains the authority when another admin
has already processed the request or the underlying store changed.

## Laravel review order

1. `app/Http/Requests/Admin/StoreRequestIndexRequest.php`: added optional search,
   request_type, city_id and page validation alongside existing status validation.
   City IDs must exist and not be soft deleted. Search is limited to 100 characters.
2. `app/Services/AdminStoreRequestService.php`: optional filters narrow the existing
   query before pagination. Search OR conditions are grouped so they cannot bypass
   status/city/type filters. ID descending breaks equal submission-time ties.
   `show()` prepares the normal relations plus current/previous brand labels and
   previous city, including historical soft-deleted references.
3. `app/Http/Controllers/Api/Admin/AdminStoreRequestController.php`: passes validated
   filters and delegates detail preparation to the service. Existing accept/reject
   responses use that same preparation after the business operation.
4. `app/Http/Resources/AdminStoreRequestResource.php`: adds detail-only
   review_companies and previous_city without database queries during serialization.
   Missing loaded city/user relations serialize as null. Existing fields remain.
5. `lang/en/auth.php`, `lang/ar/auth.php`: validation copy.
6. `tests/Feature/AdminStoreRequestReviewTest.php`: combined search/filter behavior,
   stable pagination, validation, bilingual historical labels, no serialization
   queries, and deleted-city resilience.

Existing routes and review rules are reused. Approval still takes the existing
transaction locks, validates the store version/phone, creates an active new store
and promotes an eligible customer, or applies proposed changes to the existing
store. Store-change approval preserves its owner, phone, and activation status.
Rejection records the reason. Existing review timestamps, reviewer ID, inbox
notification, transaction boundaries and authorization are unchanged. No migration
or new route is required. Ship the API additions before or together with the web.

## Angular review order

1. `features/store-requests/store-request-api.service.ts`: typed contracts and
   list/detail/decision calls through the existing API client. Checks the review
   detail contract and confirmation response. `shared/store-links.ts` restricts
   document paths to this request's protected media routes and location links to
   HTTP(S); store management reuses these helpers.
2. `store-requests.component.ts/.html`: filters, query state, cancellable reads,
   loading/error/empty states, and paginated PrimeNG table.
3. `store-request-detail.component.ts/.html`: details, comparison, review dialog,
   required rejection reason, and refresh after confirmed/uncertain writes.
4. `request-status.component.ts`, `store-requests.scss`: localized PrimeNG status
   tags and responsive details/comparison styling, reusing the existing user-page
   surfaces and OctoGear palette. Tables scroll within their own regions on mobile.
5. `shared/private-image.component.ts`, `core/api-client.ts`: authenticated Blob
   downloads only after View document/photo. PNG/JPEG/WebP are accepted. Object URLs
   remain in component memory for reopening and are revoked on path change/destroy.
   Tokens never appear in document URLs. Failure offers explicit retry; no automatic
   download of every document on list/detail entry.
6. Routes, sidebar, overview queue link, and typed English/Arabic translations.
7. `tests/store-requests.spec.ts`: synthetic browser fixtures covering review flows,
   local city search, URL restoration, protected images, uncertainty, failures,
   and desktop/Arabic mobile presentation.

API host configuration remains only `public/app-config.json`, including media.
Authentication restoration and CORS behavior are unchanged. There is one detail
GET when opening a review because approval needs the latest server state; the list
is not treated as an authoritative cached review record.

## Limits and validation

Date-range filters, bulk review, exports, and a full audit timeline are separate
steps. Store management is now documented in `STORES_STEP.md`. The current
applicant contract has no email.
No misleading placeholder controls or fabricated fields are added. Full store
management follows the existing approval workflow rather than editing proposals.

Run the web checks in `ARCHITECTURE.md`. Focused Laravel checks:
`AdminStoreRequestReviewTest|AdminStoreRequestApprovalTest|StoreChangeRequestTest|SellerApplicationTest|MediaAccessTest|StoreMediaTest`.
Use the isolated SQLite memory database and array cache/session in phpunit.xml.
The current actual check results and any full-suite failures are recorded in
`PROJECT_DOCUMENTATION.md`. Browser tests intercept APIs and do not approve or
reject retained records. No production deployment or live account mutation occurred.

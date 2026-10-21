# Step 5: stores

Implemented 2026-10-21. Read with `ARCHITECTURE.md`, `PROVIDERS_STEP.md`,
`STORE_REQUESTS_STEP.md`, and `CITY_FILTER.md`. For API work also follow the API's
`AGENTS.md`, `CODE.md`, and `SELLER_ONBOARDING.md`.

## Review the screens

1. Choose **Stores** in the sidebar. The directory shows store name/ID/phone,
   owner, city, creation date in UTC, vehicle count, activation, and details.
2. Combine name, phone, activation, and city filters, then Apply filters. Filters
   apply in Laravel before pagination, not just to the visible rows. Stores retain
   their existing **15-row** page size; customer/provider lists still use 25.
3. City options use the existing shared bilingual catalog. First interaction
   downloads it once; typing searches locally. Entering the page does not fetch
   cities. Reloading the application clears this in-memory catalog.
4. Applied filters and page remain in the URL through details, Back, and refresh.
   A missing last page returns to the last available page. New searches cancel
   older reads. Clear filters also removes an owner scope.
5. Open a store to see approved information, supported brands, owner, vehicle
   count, rating, registration document, and gallery. A pending change request
   links to its review page; it does not replace the approved store information.
6. Registration/gallery images load only after View document/photo, through the
   authenticated API client. Tokens never appear in URLs. Failed downloads offer
   explicit retry. Only the current store's protected media paths are accepted;
   location links accept HTTP(S) without embedded credentials.
7. Activate/Deactivate opens a confirmation describing its effect. Cancel sends
   nothing. Confirm sends one PATCH, then a fresh detail GET. An uncertain response
   requires Refresh store before another write. There are no automatic write
   retries. Store activation does not modify the owner's account status or orders.
8. From a provider's **Show stores** panel, open an individual store or choose
   **Open store directory**. The directory preserves `owner_id` and identifies the
   owner scope. The shared API adapter rejects rows from a different owner.
9. Check English desktop and Arabic mobile layouts. Tables scroll inside their
   surface; labels/statuses and dialogs use the existing typed translations and
   OctoGear navy/yellow theme. No new design framework or dependency is introduced.

## Laravel changes, in review order

All paths below are inside `C:/Tamkkun/OctoGearProject/OctoGear-api`.

1. `app/Http/Requests/Admin/StoreIndexRequest.php`: adds optional `city_id` and
   positive `page` validation. A city must exist and not be soft deleted. Existing
   name, mobile, status, and owner validation remain.
2. `app/Services/AdminStoreService.php`: applies city filtering before pagination;
   accepts the literal search term `0`; uses descending ID to break equal creation
   times. List and detail queries prepare the ratings average so serializing each
   row does not run another ratings query. Detail also loads companies, ordered
   pictures, and the pending change request using existing model relations.
3. `app/Http/Resources/AdminStoreResource.php`: includes employee name, location,
   and commercial registration number. Loaded detail relations expose localized
   companies, protected picture URLs, and pending request ID. List responses omit
   these relation collections. Missing owner/city relations serialize as null.
   Existing fields and float-or-null rating semantics remain.
4. `tests/Feature/AdminStoreDirectoryTest.php`: covers combined filters, validation,
   stable pages, zero-valued search, localized details, safe media metadata,
   serialization without queries, deleted cities, activation isolation, and access
   denial. Existing store/provider/media/change-request tests cover shared rules.

The controller, routes, status validation, and activation operation are reused.
GET `admin/stores`, GET `admin/stores/{id}`, and PATCH `admin/stores/{id}/status`
already exist. Authentication and active-admin middleware remain authoritative.
No migration, new route, account promotion, approval-rule change, or retained-data
mutation is required. Deploy the API detail additions before or with this web page.

## Angular changes, in review order

1. `features/stores/store-api.service.ts`: shared list/detail/status contracts
   through `ApiClient`. This replaces the former provider-only store adapter;
   owner checking remains in the shared list method.
2. `store-directory.component.ts/.html`: reactive filters, URL state, cancellable
   reads, loading/error/empty states, owner scope, and server pagination.
3. `store-detail.component.ts/.html`: approved details, pending-review link,
   private media, confirmation, and fresh reads after successful/uncertain writes.
4. `store-status.component.ts` and `stores.scss`: shared localized status tags
   and responsive styling, reusing the existing user-page surfaces.
5. `features/providers/provider-stores.component.ts/.html`: keeps lazy loading,
   uses the shared StoreApi/status component, and adds working store links.
6. `shared/store-links.ts`: protected media-path and safe location helpers shared
   with store-request review. `PrivateImageComponent` remains the image viewer.
7. `src/app.routes.ts`, sidebar, and `core/locale.service.ts`: guarded lazy
   `/stores` and `/stores/:id` routes and typed English/Arabic copy.
8. `tests/stores.spec.ts`: synthetic browser coverage of these flows, stale reads,
   uncertain writes, permission/session failures, and responsive screenshots.

All HTTP calls, including images, still use the single `public/app-config.json`
API base. Store details are freshly read on entry; list summaries are not treated
as authoritative records for activation or private-document review.

## Scope and verification

The read-only references `Stores.png`, `Stores-2.png`, and `Store details.png` in
`C:/Tamkkun/yardy/Admin panal` informed the page. Explicit confirmed activation
replaces the ambiguous Close switch. Date-range filters, inventory editing, bulk
actions, export, deletion, and a full audit timeline remain separate work. Approved
store fields are not edited here; proposed changes use the existing review flow.

Use the web commands in `ARCHITECTURE.md`. Focused API coverage:
`AdminStoreDirectoryTest|AdminStoreManagementTest|AdminProviderStoresTest|StoreMediaTest|MediaAccessTest|StoreChangeRequestTest`.
Run Laravel tests with its isolated SQLite memory database and array cache/session.
Actual results, including existing full-suite failures, are recorded in
`PROJECT_DOCUMENTATION.md`. Browser tests intercept APIs; they do not prove live
authentication or change retained accounts. No deployment was performed.

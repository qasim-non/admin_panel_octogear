# Customer city filter

## User experience

Choose a city, then Apply filters. Empty selection means all cities. City combines
with name, phone and status on the server before the existing 25-row pagination.
Applying a filter resets to page one; the city ID stays in the URL through paging,
details, Back and refresh.

The picker downloads the complete city catalog only on first interaction, using
one GET admin/cities/options. It contains both Arabic and English names. Typing,
clearing, reopening and changing language filter/display this same list locally:
no search requests, debounce, load-more pages or silent first-50 limitation.
The existing public paginated city endpoint remains available to other clients.

Loading has one message in the dropdown. A failed load shows one error and an
explicit Retry cities button. Unmatched local search shows No matching cities.
Typing during download changes the pending local query without restarting GET.

With separate web/API origins, browser developer tools may also show an OPTIONS
CORS preflight alongside GET. That permission check is not a second catalog download.

## Cache and request lifecycle

CityCatalog retains the successful list in application memory, scoped to the
configured API base. Concurrent consumers share an in-flight request. Navigation
between admin pages reuses the list. Reload clears it, so the next picker interaction
fetches current data. There is no polling, persistent city storage or search-time
expiry/refetch. Failed loads are not cached. Both names come from one response,
so locale changes require no second city request.

Customer data is still fetched from Laravel. Applying a selected city sends
city_id in the customer-list request; local city-name searching never substitutes
for server customer filtering. Customer detail/status reads are unchanged.

A URL city ID reuses the cached label or a matching customer's city. Without either,
it temporarily shows City #ID until the catalog supplies the name. Unknown/deleted
IDs receive the standard filter validation error.

## Laravel review order

1. routes/api.php: GET admin/cities/options shares auth:sanctum,admin and admin.active.
2. Reference/CityController: options uses the same private catalogQuery as index.
   The query selects only id/name_en/name_ar, excludes soft-deleted cities and orders
   by name_en then id. options returns the complete list through ApiResponse;
   index retains its existing search, bounded pagination and localized resource.
3. Admin/UserIndexRequest: optional positive existing non-deleted city_id validation.
4. AdminUserController already passes validated filters to AdminUserService.
5. AdminUserService applies the city condition before fixed 25-row pagination.
   Combined users/customer/provider routes retain their existing type enforcement.

No schema, retained-data, auth-policy or token-expiry changes are needed.
Deploy the API addition with the web update. Example customer request:
GET /api/admin/users/customers?city_id=3&status=blocked&page=1 (use a real ID).

## Angular review order

- core/city-catalog.service.ts: typed bilingual catalog, successful cache and shared GET.
- shared/city-select.component.ts: local search, localized labels and one loading/error state.
- customers.component.ts/.html: form selection and URL retention.
- customer-api.service.ts: selected ID in the server request.
- customers.scss: four fields on wide screens, two on medium screens, one on mobile.
- locale.service.ts: Arabic/English feedback.

The earlier five-minute paginated remote-search implementation is superseded by
this owner-requested complete catalog. This endpoint is specific to the admin
city selector; it does not change pagination rules for other reference catalogs.

## Verification

AdminCityOptionsTest, AdminCityFilterTest, ReferenceEndpointTest and AdminSessionTest
cover the API contract and authorization in isolated SQLite. Browser tests use
intercepted synthetic fixtures, including 53 cities, one delayed request/one loading
message, typing during loading, local bilingual search, retry, empty results,
language changes, details/back/refresh retention and 25-row customer pagination.
See PROJECT_DOCUMENTATION.md for actual run results.

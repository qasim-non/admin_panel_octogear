# Car companies and car models

## Scope and naming

The owner requested companies first, then models, with sub-admin management last.
Both original wireframes were inspected at full size. They define searchable
directories, with no creation, edit or deletion flows. The owner's follow-up
explicitly adds CRUD for companies and model names in the existing OctoGear
Angular / PrimeNG / Sakai shell. Sub-admin role changes remain deferred.

The model wireframe shows Camry and Sunny. These are `CarName` records in Laravel
(`cars_names`), related to `CarCompany` (`cars_companies`). The separate `CarModel`
entity (`models`) stores catalog variants, sometimes with sourced model years;
it is not the entity shown by this wireframe. No year or compatibility is guessed.
Country is the manufacturer's **country of origin**, not an assembly location.

## Review step 1: Laravel read contract

Read these files in order, relative to `../OctoGear-api`:

1. `routes/api.php`: three GET routes in the existing `auth:sanctum,admin` and
   `admin.active` group: `/admin/car-companies`, `/admin/car-companies/options`,
   and `/admin/car-names`.
2. `app/Policies/VehicleCatalogPolicy.php`: directory access for allowed Admin
   identities, registered for CarCompany and CarName in AppServiceProvider.
   This follows current admin access rules; sub-admin role changes remain deferred.
3. `app/Http/Requests/Admin/CarCompanyIndexRequest.php`: optional search (100
   characters maximum), positive page, localized validation. CarNameIndexRequest
   extends it with an optional existing, non-deleted company_id.
4. `app/Http/Controllers/Api/Admin/AdminVehicleCatalogController.php`: authorize,
   pass validated filters to the injected query service, return resources in the
   existing envelope with private/no-store headers.
5. `app/Services/AdminVehicleCatalogQueryService.php`: grouped English/Arabic
   name search, company filtering, stable English-name/ID ordering and fixed
   25-row pagination. Shared company-query and name-search helpers avoid repeated
   same-class logic. Country relationships and model counts are prepared here.
6. `app/Http/Resources/AdminCarCompanyResource.php` and `AdminCarNameResource.php`:
   reuse ReferenceResource for existing localized labels. Serialization does not
   run database queries. Company rows contain id, name, country and models_count;
   model rows contain id, name and company with its country. Rows now also carry
   name_en, name_ar, the parent ID (country_id or car_company_id), and an opaque
   version for editing directly from the loaded table without a detail request.

Only current non-deleted companies/names are listed. Models belonging to a removed
company are excluded. Deleted/missing country relations display as not provided.
models_count counts current CarName rows, not model-year variants. Search applies
to the record's name in either language, including the literal term `0`; model
company filters combine with search before pagination.

The complete company selector returns only id, name_en and name_ar without
pagination. Country options use `/admin/catalog-countries/options` with the same
small bilingual response. Existing public reference endpoints are unchanged.
CRUD requires the additive migration described below; no seeder or account reset.

## Review step 2: Companies page

Web route `/car-companies` adds a sidebar entry and shows company ID, localized
name, country of origin, number of models, and View models. Search is submitted
explicitly; typing does not send requests. The table shows 25 records per page
and a result count. View models passes company_id to `/car-models` and retains
the company directory's search/page for its Back link, including after refresh.

## Review step 3: Models page

Web route `/car-models` shows model ID/name, company and country of origin. Search
and company filters combine. It reuses the same directory component, API adapter,
table styles, loading/error/empty behavior and pagination as Companies.

`CompanySelectComponent` uses PrimeNG Select's local bilingual filtering. Opening
it for the first time loads the complete small company list. Merely entering the
page does not load options. The selected row's company label is reused until then;
if no row is available, its ID is displayed until the selector loads. Options are
shared in memory, including concurrent in-flight reads, and failed downloads offer
explicit Retry. Refreshing the browser clears the cache. Locale changes do not
download company options again.

`core/reference-options.service.ts` extracts the pre-existing city-cache behavior
for both small reference selectors. CityCatalog retains its existing interface;
CitySelect and its API contract are unchanged. Neither large model directories
nor customer data are downloaded wholesale or stored in this cache.

## Review step 4: Interaction and translations

All new text is in typed `core/i18n/en.ts` and `ar.ts`. Country/company/name labels
come from Laravel in the requested locale. Filter/page state stays in the URL;
superseded requests are cancelled with switchMap. A missing last page returns to
the new last page. Empty catalog, no matches, denied access, unavailable data and
invalid filters have distinct feedback. An expired session follows shared login
handling. Malformed responses are not shown as successful data.

Responsive tables scroll inside their own focusable regions. Arrow-key scrolling,
RTL navigation, associated field labels, visible loading feedback and bilingual
empty/error states follow the existing design. No manufacturer logos are invented.

## Review step 5: CRUD, in API order

1. `routes/api.php` adds POST `/admin/car-companies` and `/admin/car-names`,
   plus PATCH and DELETE on their `/{id}` paths, under existing admin middleware.
   `VehicleCatalogPolicy` authorizes create/update/delete using the same current
   admin access rule as the directory. This does not introduce sub-admin roles.
2. `VehicleCatalogSaveRequest` requires both names (1–100 characters), an optional
   country for companies, or an available company for new models. PATCH and
   `VehicleCatalogDeleteRequest` require the row's version. Validation returns
   localized 422 field errors. Company forms send country_id explicitly, including
   null for no country; model forms send car_company_id.
3. `AdminVehicleCatalogController` authorizes, passes validated data to
   `AdminVehicleCatalogService`, and returns the standard envelope/resources.
   Creates return 201; updates and successful deletes return 200.
4. The service uses short database transactions and a singleton row lock in
   `vehicle_catalog_locks`, acquired before catalog row locks. This serializes
   admin catalog writes, including creation into an empty catalog, without
   imposing new unique indexes on legacy seed data. Duplicate names are checked
   case-insensitively per language (companies globally; models within a company).
   Seed/import scripts must not run concurrently with admin writes; future catalog
   write paths must reuse this service/lock. SQLite tests cover rules; production
   MySQL contention has not been load-tested.
5. `VehicleCatalogVersion` hashes the editable fields; the service compares it
   against the locked row before update/delete. A changed record returns 409.
   A deleted record returns 404. Model company assignments cannot be changed by
   editing a name, preserving existing vehicle relationships.
6. `AdminVehicleCatalogQueryService::inUse` checks current models, retained store
   associations/requests, customer vehicles, store stock and order references.
   Checks include archived usage and model links under an archived child. An
   in-use record returns localized 409. Otherwise Eloquent soft-deletes only the
   catalog record. It does not purge children, variants, media, stock or snapshots.
   Existing order label snapshots are never rewritten by name changes.

### Database setup

Run from the API project before enabling CRUD on an environment:

```powershell
php artisan migrate --path=database/migrations/2026_10_21_190000_create_vehicle_catalog_locks_table.php
```

This creates one small lock table with one row. It does not alter catalog rows,
seed data, users, vehicles or orders. Deployments should run normal reviewed
pending migrations; the scoped command is useful locally when unrelated migrations
are being developed concurrently. No worker or external service is added.

## Review step 6: Web forms and recovery

`CatalogEditorComponent` is shared by both pages for create/edit/delete. Each row
has accessible Edit/Delete buttons; the page has Add company or Add model.
Both language fields have explicit labels and direction. Country is optional;
new models require a company (prefilled from an active company filter). Existing
models show their fixed company. The country selector reuses CompanySelect's
local bilingual filter and ReferenceOptions cache, loading only when opened.

`VehicleCatalogApi` uses the shared API client (now including DELETE), so there
is still only one API base setting. Company writes invalidate cached options,
including failed/uncertain writes; old pending reads cannot repopulate the cache.
Selectors already mounted observe invalidation. No automatic mutation retries.

Save is single-flight, fields/closing are disabled while it is pending, and 422
errors stay in the dialog. Delete shows the name and requires confirmation.
On success the directory refetches using the current filters/page, including its
existing vanished-last-page recovery. An uncertain response or 404/409 disables
resubmission: close the dialog and inspect the refreshed list first. A 401 still
uses shared session handling. Success and validation messages use typed en/ar.

## Verification

`tests/vehicle-catalog.spec.ts` covers 25-row paging, linked return navigation,
local bilingual option search, single downloads, retry/cache reuse, filters,
stale responses, removed pages, error/session handling and responsive screenshots.
Browser APIs are intercepted with synthetic fixtures, not retained accounts.

`tests/Feature/AdminVehicleCatalogTest.php` covers real bearer access, denied
identities, bilingual search, combined filters, counts, removed references,
deterministic pagination, complete options, validation and query-free resources.
Run it alongside ReferenceEndpointTest and AdminCityOptionsTest on isolated SQLite.
`AdminVehicleCatalogCrudTest` covers writes, authorization, bilingual validation,
duplicates, stale updates/deletes, fixed parents, soft deletion, country options,
archived dependencies and unchanged order snapshots. `vehicle-catalog-crud.spec.ts`
covers form validation, one write per submission, confirmation/cancellation,
no edit-detail read, local option search, cache invalidation, errors and RTL forms.
See PROJECT_DOCUMENTATION.md for the actual final check results.

## Remaining scope

Model-year variant management remains outside this slice. Sub-admin management and its revised access
rules remain last, as requested. The single API host setting remains unchanged:
`public/app-config.json`.

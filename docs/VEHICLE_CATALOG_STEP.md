# Car companies and car models

## Scope and naming

The owner requested companies first, then models, with sub-admin management last.
Both original wireframes were inspected at full size. They define searchable
directories, with no creation, edit or deletion flows. This slice implements those
read-only pages in the existing OctoGear Angular / PrimeNG / Sakai shell.

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
   model rows contain id, name and company with its country.

Only current non-deleted companies/names are listed. Models belonging to a removed
company are excluded. Deleted/missing country relations display as not provided.
models_count counts current CarName rows, not model-year variants. Search applies
to the record's name in either language, including the literal term `0`; model
company filters combine with search before pagination.

The complete company selector returns only id, name_en and name_ar without
pagination. Existing public reference endpoints are unchanged. No migration,
seeder, account mutation, catalog write or production deployment is required.

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

## Verification

`tests/vehicle-catalog.spec.ts` covers 25-row paging, linked return navigation,
local bilingual option search, single downloads, retry/cache reuse, filters,
stale responses, removed pages, error/session handling and responsive screenshots.
Browser APIs are intercepted with synthetic fixtures, not retained accounts.

`tests/Feature/AdminVehicleCatalogTest.php` covers real bearer access, denied
identities, bilingual search, combined filters, counts, removed references,
deterministic pagination, complete options, validation and query-free resources.
Run it alongside ReferenceEndpointTest and AdminCityOptionsTest on isolated SQLite.
See PROJECT_DOCUMENTATION.md for the actual final check results.

## Remaining scope

Catalog create/edit/delete and model-year variant management are not part of these
wireframes or this read-only slice. Sub-admin management and its revised access
rules remain last, as requested. The single API host setting remains unchanged:
`public/app-config.json`.

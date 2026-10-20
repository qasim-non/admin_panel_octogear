# OctoGear Admin project documentation

## Decision record — 2026-10-19

The owner approved the first navy-and-white split login concept and requested a complete web admin panel developed incrementally, using the existing Laravel API. The web project location is `C:/Tamkkun/OctoGearProject/OctoGear-admin`.

The owner selected Angular as the frontend framework, PrimeNG as the component library, and Sakai (Angular version) as the dashboard layout. Angular 21 / PrimeNG 21 follows the official Sakai baseline. Exact installed versions are in package-lock.json. The owner also authorizes useful additions beyond wireframes when their purpose is explained and documented.

Required outcomes:

- OctoGear identity throughout the web application.
- Consistent, polished pages, forms, tables, detail views, and feedback states.
- Existing Laravel API integration, initially on localhost.
- One documented frontend API base URL setting for development and future production.
- Small implementation steps with explanations and reviewable Laravel changes.
- Project-local documentation and instructions read on every project request.

## Sources and precedence

Current owner decisions take precedence. Confirm behavior against current OctoGear API contracts and code. Use the approved visual direction and existing brand guidance for styling. Legacy wireframes define reference content and broad flow; they do not override current business rules, permissions, or API behavior.

| Source | Location |
| --- | --- |
| Legacy admin wireframes, 25 PNGs | `C:/Tamkkun/yardy/Admin panal` |
| Current Laravel API | `C:/Tamkkun/OctoGearProject/OctoGear-api` |
| Existing OctoGear mobile brand guidance | `C:/Tamkkun/OctoGearProject/octogear/PROJECT_DOCUMENTATION.md`, Brand and design system / Visual design contract |
| Brand guide | `C:/Tamkkun/OctoGearProject/wireframe and loging example/Octogear_Brand_Guidelines_260923_131018.pdf` |
| Approved original logo asset | `C:/Tamkkun/OctoGearProject/octogear/assets/icons/app_icon.png` |
| Existing brand fonts | `C:/Tamkkun/OctoGearProject/octogear/assets/fonts/` |
| Approved login concept | `docs/design/login-approved-concept.png` |

The `yardy` directory is a legacy repository containing the reference images. It is not the current OctoGear API or the new web project. Preserve its files unchanged.

## Approved login direction

- Desktop: navy branding panel on the left, white login form on the right, pale neutral outer canvas, restrained rounded corners and subtle borders.
- Branding: original OctoGear octopus, gear and spark-plug logo, OCTOGEAR wordmark, and Administration label.
- Form: welcome heading, supporting line, email address, password with visibility toggle, forgot-password link, one navy Sign in button, and an administrator-access note.
- Clear Arabic/English language control. Arabic uses RTL layout, with email values remaining readable in LTR.
- Compact screens: small brand header above a single-column form; remove the large decorative side panel.
- Implement readable validation, focus, loading, disabled, and authentication-error states.
- Password recovery is intended UI scope; its route and delivery behavior must be checked against the API before implementation. Do not leave a falsely functional link.
- The generated reference is illustrative. Use the original logo file and actual typography directly when implementing; do not extract branding from the generated image.

## Shared visual system

| Element | Direction |
| --- | --- |
| Primary navy | `#242C41`: hierarchy, navigation, main actions |
| Brand yellow | `#F7C83C`: small emphasis, focus/active accents |
| Structural gray | `#878380`: supporting decoration; verify contrast before text use |
| Working surfaces | White on a pale neutral canvas; proposed canvas `#F5F6F8` |
| Type | Noto Sans for English; Noto Sans Arabic for Arabic; retain font licenses |
| Borders and corners | Subtle neutral borders, restrained rounding, minimal shadows |
| Spacing | Consistent spacing scale; roomy forms and readable, efficient data views |
| Semantics | Reserved success, warning, error and information colors with explicit text labels |

Use navy primary buttons with readable white labels, and yellow sparingly. Avoid yellow body text on white, decorative gradients, heavy shadows, oversized headings, and excessive badge colors. Colors, spacing, typography, and controls must become shared design tokens/components after stack selection.

Keyboard operation, visible focus, meaningful labels, sufficient contrast, usable zoom, and roughly 48px interactive targets are design requirements. Arabic and English must both work across navigation, forms, dialogs, and data tables.

## Tables and admin shell

These are implementation requirements for extending the approved identity; detailed page layouts remain to be reviewed as each feature is built.

- Shared sidebar and header with clear active navigation, concise page titles, breadcrumbs where helpful, language control, and account actions.
- White table surfaces, subtle separators, consistent header treatment, aligned columns, readable row spacing, and restrained hover/focus states.
- Search and relevant filters grouped above the table; visible active filters and a clear reset action.
- Explicit status labels, consistent dates, documented money units, clear row actions, and pagination with result counts where the API supports them.
- Sorting/filtering/pagination must reflect the full dataset and actual API capabilities. Do not imply a page-only filter searched all records.
- Stable loading layouts, informative empty states, no-results states, error feedback with retry, and overflow handling for narrow screens.
- Detail pages use consistent grouped sections; important review actions are easy to locate and respect the current permission/state rules.
- Confirm consequential actions with clear effects and require reasons where the API requires them. Avoid decorative or nonfunctional controls.
- Browser visibility of an action never replaces backend authorization.

## Wireframe inventory

All 25 image files were enumerated and a thumbnail overview inspected. Individual screens must be read at full size before their implementation; fields and behavior are not considered validated from thumbnails alone.

| Area | Exact reference files |
| --- | --- |
| Login and shell | `Login-2.png`, `Login.png` |
| Dashboard | `Dash board.png` |
| Customers | `Customers.png`, `Customer details.png` |
| Providers | `Service providers.png`, `Service provider details.png` |
| Provider applications | `Service provider requests.png`, `Service provider reqeust details.png` |
| Stores | `Stores.png`, `Stores-2.png`, `Store details.png` |
| Store review | `Stores requests.png`, `Store reqeust details.png` |
| Orders | `Orders.png`, `Order details.png` |
| Payments | `Payment.png` |
| Sub-admins | `Sub admin.png`, `Sub admin details.png`, `Add sub admin.png`, `Add sub admin-2.png`, `Add sub admin-3.png`, `Edit Sub admin.png` |
| Vehicle catalogs | `Cars companies.png`, `Cars moduls.png` |

Correct legacy wording and spelling in product UI. Do not copy sample records, embedded instructions, credentials-delivery promises, or role assumptions into the application without confirming current contracts.

## API configuration and integration

Use the current OctoGear Laravel API. Start with its verified local address; proposed local value is `http://127.0.0.1:8000/api`, subject to confirming the running server. Browser localhost refers to the browser's machine.

The public runtime entry is `apiBaseUrl` in `public/app-config.json`. In a deployed build edit `dist/octogear-admin/browser/app-config.json`. AppSettings loads it before bootstrap without caching; reload open tabs after changing it. No application rebuild is required when editing the deployed JSON. ApiClient constructs URLs; the interceptor attaches locale/auth headers only under the configured API boundary. See `docs/ARCHITECTURE.md` for validation and deployment details.

Changing the frontend target should require changing this one documented setting, with a rebuild/restart if the selected stack requires it. Deployment may also require Laravel CORS, trusted origins, session/cookie, HTTPS, and hosting configuration; do not promise that changing a URL alone deploys production.

Use the API's verified admin authentication mechanism, authorization, locale headers, response envelopes, error format, media URL conventions, and pagination. Browser-visible configuration must contain no backend secrets. Determine session storage and CSRF handling from the verified auth contract, rather than assuming a storage strategy now.

## Laravel changes and learning workflow

The owner authorizes adding necessary routes and related API behavior for this panel. First inspect existing routes, policies, requests, services, resources, and tests. Reuse established functionality and follow the backend's required instructions/documents. The first implementation slice includes the minimal session correction and profile endpoint described in `docs/LARAVEL_SESSION_STEP.md`. Preserve the established API contracts when adding later features.

For each slice:

1. Explain the user-visible outcome and the relevant existing API flow.
2. Identify any missing endpoint or contract and describe the smallest required change.
3. Implement a bounded, coherent change. Explain route -> middleware/policy -> validation -> controller/service -> resource/response using the actual changed code.
4. Run appropriate isolated checks, review the diff, and report failures honestly.
5. Update this document with files, endpoints, behavior, verification, and remaining work. Present the completed slice for review before beginning another substantial feature area.

Do not repeatedly request permission for already authorized routine changes. Keep explanations focused enough for the owner to follow and review. Do not make broad backend changes merely to simplify the frontend.

## Proposed implementation sequence

1. Receive the frontend technology; document architecture, dependencies, setup and commands.
2. Establish shared tokens, original assets, bilingual layout, and central API configuration.
3. Implement the approved login and verified admin session flow, including failure states and logout.
4. Build the admin shell and one real table feature to validate reusable table/form/detail components.
5. Add dashboard and remaining feature areas in bounded slices: customers, providers/reviews, stores/reviews, orders, payments, sub-admins, catalogs. Adjust ordering to actual API dependencies and owner priorities.
6. Verify responsive layouts, RTL, permissions, real data behavior, and production configuration; document deployment without deploying unless requested.

## Progress

### 2026-10-19: preparation

Owner approved the login design, project location, Angular/PrimeNG/Sakai stack, and useful documented additions. Original documentation and reference assets preserved.

### 2026-10-19: slice 1 — foundation and administrator session

Read `docs/ARCHITECTURE.md` and `docs/LARAVEL_SESSION_STEP.md` with this document on future tasks.

Implemented:

- Angular standalone lazy routes; PrimeNG theme and controls; official Sakai shell source/styles, with attribution retained.
- Original OctoGear logo, Noto Sans/Arabic with licenses, responsive login, visible language action and RTL.
- Runtime `app-config.json` setting, shared HTTP boundary, error mapping, in-memory admin identity/token and guarded shell.
- Existing login/logout integration and new minimal protected admin profile. Shared/admin routes try the existing `admin` guard after `sanctum`, preserving mobile guard isolation.
- Existing dashboard summary API displayed as count cards, review-request count, and a PrimeNG status table. This is an order-status summary, not a full orders-management table.
- Missing-wireframe additions: connection/configuration feedback, session expiry, local validation, password visibility, loading/empty/error states, keyboard focus and skip link, responsive navigation, not-found/access-denied screens.
- Password recovery is an explanation dialog because no reset/delivery contract exists. Do not show fictitious sent-email success.

Preserved limits:

- No signup/default admin, retained-account edits, database reset, migrations, live external messaging, or production deployment.
- Memory-only sign-in: browser refresh requires login. Existing backend token-expiry and inactive-admin rules are unchanged.
- Full customers/providers/stores/requests/orders/payments/sub-admin/catalog management remains subsequent slices.
- Never label browser mock tests as live authentication with a retained admin account.

Verification: production build and TypeScript check passed; 11 Playwright browser tests passed against the production build with intercepted API responses. Desktop English, desktop Arabic, mobile Arabic login, desktop overview and mobile Arabic overview screenshots were visually inspected. No horizontal overflow was found in the tested 390px view. Installed Angular 21.2.25, Angular CLI 21.2.27, PrimeNG 21.1.10 and the pinned Sakai baseline. The local API health check and bearer CORS preflight passed; live browser sign-in with a retained admin account was not attempted. The in-app preview-opening tool did not return, so screenshots provide the verified visual review. Temporary test servers were stopped by Playwright. Laravel session regression: 5 tests, 21 assertions pass. Full Laravel suite: 551 tests, 4679 assertions, 3 failures (548 pass). All three failures reproduced on unchanged HEAD `dc378658e22b7a8eaea8967232a9603cd95221a2` in an isolated exported copy: two AuthRateLimitTest OTP expectations (429 vs 200) and GeneralOrderDetailsTest general-order quantity field presence. These failures were not changed in this slice.

Next review: approve the first implemented slice visually and review the small documented Laravel change, then build the first full management table against its verified API contract.


### Installation verification and concurrent work

The verified source, exact dependencies and production build are installed in the approved web project directory. A final local production-preview smoke check returned HTTP 200 for /login and the original logo; app-config.json returned http://127.0.0.1:8000/api. The temporary preview process was stopped.

Unrelated provider/chat edits appeared in the API repository after the full regression run (provider order controller, conversation policy, provider-offer repository and provider-chat tests). They were preserved. The 551-test full-suite result is evidence from the auth-slice run, not a claim that the latest concurrently edited API tree has been fully retested. Admin session tests were checked separately again afterward.

### 2026-10-20: slice 2 — customer directory and details

Read `docs/CUSTOMERS_STEP.md` with this document when reviewing/extending the customer feature. The scope is one complete management area, not the remaining admin modules.

Implemented:

- Customers navigation and guarded lazy list/detail routes.
- PrimeNG directory table with actual server total, fixed 15-row pages, name/mobile AND filtering, account-status filter, explicit Apply/Clear actions, and retained URL filters/page on detail/back navigation.
- Customer identity, mobile, localized city, joined date, status, and detail links. Dates explicitly use UTC. No page-only fake search or unsupported sorting/page-size controls.
- Customer details with contact/account sections and the API order count, plus confirmed block/unblock and a fresh read after a successful write.
- Uncertain status responses require refresh before another write; writes are never automatically repeated. Missing/promoted customers expose no customer status action.
- English/Arabic, responsive layouts, in-surface horizontal table scrolling with a visible mobile hint, enlarged pagination targets, skeletons, distinct empty/no-match/error/denied/session-expiry states.
- Existing sidebar inline menu host corrected to block layout after browser tests showed it intercepting navigation clicks. Status selector has an explicit accessible name.
- Central ApiClient extended with query parameters, PATCH, and pagination typing; the one-place API URL configuration and in-memory session rules remain unchanged.
- New `docs/CUSTOMERS_STEP.md` explains the screen, contract, Laravel flow, review order, test commands, design decisions, and remaining gaps. README and architecture guide updated.

Existing API used: GET `admin/users/customers`, GET `admin/users/{id}`, PATCH `admin/users/{id}/status`. **No Laravel files, endpoints, migrations, or retained records changed.** The API repository's pre-existing README edit was preserved. Existing admin middleware/role behavior remains authoritative.

Wireframe gaps deliberately deferred: city/date filtering needs API support; email/profile photos and split first/last names are absent from the current contract. Initials are generated for presentation. Suggested later addition: an audited status-change history with administrator, timestamp, and reason; this is not implemented or implied by the current action.

Verification:

- `npm run typecheck`: passed.
- `npm run build` with two build workers: passed.
- Final `npm test`: **20 passed** (11 login/config/session/overview regressions + 9 customer integration/visual tests), using production build and intercepted synthetic HTTP responses.
- Laravel existing `AdminUserManagementTest|AdminSessionTest`: **18 tests / 64 assertions passed**, isolated SQLite `:memory:`, array cache/session. Full backend suite was not rerun because this slice makes no backend changes; the older full-suite record above remains historical.
- Desktop English/Arabic directory, desktop details/confirmation, mobile Arabic directory/details visually inspected. No page-level horizontal overflow at 390px. Screenshot records are synthetic test fixtures, not live accounts.
- Existing local development server on 4200 returned HTTP 200 for `/login`; a preview-opening request was queued by the app. Browser tests use a separate 4201 server. A stalled test-owned Chrome shutdown required terminating that identified test browser after assertions completed; the test run then exited successfully. The user's development server was preserved.
- `git diff --check`: passed. No dependency/lockfile changes, production deployment, live account login, or retained customer mutation.

Review this slice before starting a separate management area. Providers/store-request review is a logical next feature; missing customer city/date filters can instead be a small separately reviewed Laravel extension.


### 2026-10-20: admin user page size

Owner requested only 25 users per request. Changed the existing shared
AdminUserService paginator from 15 to 25 for admin users/customers/providers.
Angular already reads meta.per_page; no application UI code changed. Filters,
detail/status requests, ordering, authorization and routes are unchanged. City
filtering, browser caching, page-size selection and infinite scrolling remain
deferred. Updated the customer guide and existing API/browser test fixtures to
cover 25 rows on page one and the remainder on page two. No migration needed.

Verification: affected Laravel tests passed (18 tests / 70 assertions); PHP syntax
and targeted Pint passed. Full backend suite: 556 tests / 4,726 assertions,
553 passed and three failures matching the previously documented two OTP
rate-limit expectations and general-order quantity-field expectation. Those
areas were not changed. Customer browser test assertions passed in all nine
cases against the existing unchanged production build and intercepted fixtures,
including 25-row pagination, second-page remainder, filters, detail/back behavior,
last-page reconciliation and Arabic/mobile layouts. No frontend application source
changed, so no rebuild was needed. Retained accounts/data were not modified.

### 2026-10-20: customer city filtering

Added a searchable City filter to Customers using the existing PrimeNG/OctoGear
styles. Read docs/CITY_FILTER.md for the request flow, cache policy and review order.
City options load on interaction, search Arabic/English with a 300 ms debounce,
page in batches of 50, and reuse recent results in a bounded five-minute memory
cache. No eager catalog fetch, persistent customer cache or polling. Customer
results remain 25 per page, and city_id persists through details/back/pagination.
The existing admin UserIndexRequest validates city_id; AdminUserService applies
it before pagination for users/customers/providers. Existing reference routes are
reused. No migration, retained-data edits or production deployment.

Verification: Angular typecheck and production build passed. All 23 Playwright
authentication/customer tests passed against intercepted synthetic API fixtures,
including lazy city loading, cache reuse, bilingual search, pagination, retry,
combined filters, stale-request cancellation and detail/back retention. Desktop
and Arabic mobile screenshots were visually reviewed. Focused Laravel checks
passed (32 tests / 155 assertions), as did targeted Pint and PHP syntax checks.
Full Laravel suite: 564 tests / 4,814 assertions; 561 passed and the same three
previously documented failures remained: two AuthRateLimitTest OTP limits and
the GeneralOrderDetailsTest quantity-field expectation. Those areas were not
changed. Both project diffs passed whitespace checks.

### 2026-10-20: refresh recovery and local city search

Owner reported refresh returning to login, duplicate loading text, and unwanted
city search requests. The original session was memory-only; the city picker
rendered loading text in both its empty-message area and footer and used remote
paginated search. This slice supersedes those earlier behaviors.

- After successful profile verification, SessionService saves only the token and
  API base in tab-scoped sessionStorage. Startup loads settings and verifies that
  token once through the existing admin/profile before routing. Refresh retains
  the current URL and filters. Logout/revoked/blocked sessions clear saved access.
- Changed API bases and malformed saved records cannot forward a saved token.
  Temporary verification failures preserve the record and show a retry view,
  withholding protected content. Storage-disabled browsers keep memory-only login.
  Laravel token expiry/auth behavior is unchanged. See LARAVEL_SESSION_STEP.md for
  the storage scope and JavaScript-accessible bearer tradeoff.
- Added GET admin/cities/options under the existing administrator middleware.
  CityController reuses its catalog query and returns only id/name_en/name_ar for
  all non-deleted cities. Public reference pagination remains unchanged.
- CityCatalog shares one in-flight GET and caches the complete bilingual list in
  application memory. The picker searches locally, including while downloading;
  reopening and locale changes do not fetch cities. Reload clears the catalog;
  the next picker interaction fetches it again. One loading/error message and an
  explicit retry replace duplicate feedback and load-more controls.
- Customer filtering remains server-side, 25 per page. No migration, account/data
  mutation, dependency change, deployment or live retained-account login.

Verification: Angular typecheck and production build passed. All 29 Playwright
browser tests passed (synthetic intercepted API data), including saved-session
restore/rejection/retry/API-boundary/storage-failure checks, filtered-page refresh,
one delayed city GET/one loading message, local bilingual search across 53 cities,
retry, details/back and Arabic/mobile layouts. Loading and Arabic mobile images
were visually inspected. Focused Laravel checks passed: 22 tests / 238 assertions.
Changed PHP syntax, targeted Pint and both diff whitespace checks passed.

Full Laravel suite: 567 tests / 4,573 assertions, 562 passing, three failures and
two errors. Failures are the previously documented two AuthRateLimitTest OTP
expectations and GeneralOrderDetailsTest quantity-field expectation. The errors
are demo image write/copy failures in GeneralOrderDetailsTest and
ProviderDemoSeederTest, also reported in earlier API verification records.
Those auth/order/image/seed implementations were not modified. The full suite is
not green. PHP checks and browser tests ran outside the sandbox after its file
access checks/preview startup prevented normal execution; tests used SQLite memory
databases and intercepted browser APIs. The initial stalled test processes were
stopped without touching the user's development server.

### 2026-10-20: slice 3 — service providers

Read `docs/PROVIDERS_STEP.md` for the screen review and Laravel walkthrough.
Reviewed both provider wireframes at full size and reused the approved OctoGear
design. Added the Service providers sidebar route, a 25-row paginated directory
with name/phone/status/city filters, store counts, provider details, and confirmed
block/unblock. City search reuses the complete local catalog across both account
directories; it does not call the API while typing. Filters/page survive detail,
Back and refresh. Existing customer and authentication behavior is preserved.

Moved customer directory/detail/status/API/styling into `features/users`, selected
by explicit typed customer/provider route configuration. This shares existing
filtering, request cancellation, type checks, uncertainty handling and confirmed
account actions instead of maintaining two implementations. The provider detail
adds `features/providers/provider-stores.component`: Show stores loads only that
owner's active/inactive stores, with explicit refresh/retry and the existing
15-store server pagination. Account blocking does not change store activation.

Laravel changes are limited to optional owner_id validation in StoreIndexRequest,
the owner condition before pagination in AdminStoreService, bilingual validation
messages and AdminProviderStoresTest. Existing admin routes/controllers/resources,
authorization, 25-user pages, and 15-store pages remain intact. No migration,
dependency change, retained-account mutation or production deployment.

Provider email/avatar and provider-level commercial documents are not invented;
registration belongs to stores. Joining-date filters remain deferred without an
API contract. Provider/store requests and full store details are later slices.

Verification: Angular typecheck and production build passed. All 37 Playwright
tests passed (17 auth, 12 customer, 8 provider), using intercepted synthetic data.
The provider visual test passed again after adjusting screenshot scroll position;
desktop and Arabic mobile images were inspected. The focused Laravel admin set
passed 35 tests / 213 assertions. Changed PHP syntax and targeted Pint passed.
Both project diffs were reviewed and passed whitespace checks.

Full Laravel suite: 573 tests / 5,002 assertions, 569 passing, three failures and
one error. Failures remain the two documented AuthRateLimitTest OTP-limit
expectations and GeneralOrderDetailsTest quantity-field expectation. The error is
the documented demo image-write issue in GeneralOrderDetailsTest. Those areas
were not changed; the full suite is not green. API tests used SQLite memory
databases, and browser checks used a dedicated preview on 4202. No live retained
admin/provider account was used for verification.

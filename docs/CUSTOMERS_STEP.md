# Step 2: customers

This review covers one complete feature: the customer directory, customer details, and confirmed block/unblock. It uses the existing Laravel endpoints; **no Laravel source, routes, migrations, or retained records were changed** in this step.

## Review the UI

1. Run the API and `npm start` in the web project, then sign in with an existing administrator.
2. Choose **Customers** in the sidebar. It shows the real server total, 15 records per page, full name/ID, mobile, city, joined date, status, and a details action.
3. Search by name and/or phone, select account status, and select **Apply filters**. Name and phone combine with AND. **Clear filters** resets them. The list always searches the full server dataset.
4. Open a customer. Contact and account information are grouped separately from account-access actions. Order count comes from the existing response.
5. Blocking and unblocking first open a dialog showing the customer's name, ID, phone, and the effect. Cancel sends no request. A confirmed write is followed by a fresh detail read. No optimistic status is shown.
6. If a write cannot be confirmed, refresh the customer's details before another attempt. The application never automatically repeats the write.
7. Return to the directory. Filters/page are retained in the URL; the list is freshly requested. If the previous last page disappeared after a filtered status change, it moves to the last valid page.
8. Switch to Arabic and check a narrow viewport. The page and dialog use RTL; phone numbers retain LTR reading. The wide table scrolls within its own surface.

Only perform a live status change when you intend to affect that account. Automated browser checks use synthetic intercepted data and never mutate retained customers.

## Visual decisions

- Original OctoGear identity, navy navigation/actions, pale canvas, white surfaces, and restrained yellow emphasis.
- Search/filter labels stay visible. Status uses text plus icons, not color alone.
- Readable customer identity cells with generated initials, compact IDs, subtle row separators, and explicit View details links.
- Customer detail groups reduce scanning: profile header, contact information, account information, access action, and a real order count.
- Skeleton loading, first-use empty state, filtered no-results state, recoverable error state, denied access, and unavailable customer are distinct.
- The sidebar menu host uses block layout. Browser testing exposed the original inline host intercepting pointer clicks once a second menu item was added.

## Existing API contract

Base URL remains the one public setting in `public/app-config.json`.

| Action | Method and API-relative path | Inputs |
| --- | --- | --- |
| Customer directory | GET `admin/users/customers` | `name` (max 100), `mobile` (max 20), `status` (`blocked`/`unblocked`), `page` |
| Customer detail | GET `admin/users/{id}` | ID |
| Account status | PATCH `admin/users/{id}/status` | JSON `{ "status": "blocked" }` or `"unblocked"` |

List response:

```json
{
  "success": true,
  "message": "...",
  "data": [],
  "meta": { "current_page": 1, "last_page": 1, "per_page": 25, "total": 0 }
}
```

Both list rows and detail return `id`, `full_name`, `mobile`, `type`, `status`, `orders_count`, `stores_count`, nullable `city: {id, name}`, and `created_at`. City names follow Accept-Language. List ordering is the API's existing newest-created ordering; the frontend does not invent sorting or page-size support.

The detail endpoint can return a provider. If a customer was promoted or the address names a provider, this screen shows Customer unavailable and offers no status action. A 404 does the same. HTTP 403 reports denied customer access; authenticated 401 uses the shared session-expiry flow.

Dates are explicitly displayed in **UTC**, including the label. The API returns UTC timestamps but does not provide a business-timezone setting in this resource; this avoids interpreting dates using each browser's machine timezone.

## Laravel flow, step by step

Read these files in `C:/Tamkkun/OctoGearProject/OctoGear-api`:

1. **`routes/api.php`**: the three existing routes share `auth:sanctum,admin` and `admin.active`. Middleware authenticates the administrator and enforces existing access rules.
2. **`app/Http/Requests/Admin/UserIndexRequest.php`**: validates the optional list filters. The frontend matches its field names and length limits.
3. **`app/Http/Controllers/Api/Admin/AdminUserController.php`**: `customers()` forces customer type; `show()` reads a bound user; `status()` converts validated status to the backed enum and delegates.
4. **`app/Services/AdminUserService.php`**: `index()` applies filters, eager-loads city and relationship counts, and paginates 25 rows. `show()` prepares the same relationships/counts. `setStatus()` updates only the existing status field.
5. **`app/Http/Requests/Admin/UserStatusRequest.php`** and **`app/Enums/UserStatus.php`**: restrict writes to `blocked` or `unblocked`.
6. **`app/Http/Resources/AdminUserResource.php`**: transforms the prepared user into the documented response. **`app/Http/Traits/ApiResponse.php`** supplies the envelope and pagination metadata.
7. **`tests/Feature/AdminUserManagementTest.php`**: existing filter/type/detail/status tests. **`tests/Feature/AdminSessionTest.php`**: existing bearer session and guard-isolation tests.

There is currently no per-role user-management policy or capability flag. The frontend follows existing backend authorization and does not invent role restrictions. Status updates do not create an audit entry, accept a reason, revoke tokens, send notifications, or perform version checks. Those are separate backend decisions, not behavior added by this UI.

## Web files, in review order

1. `src/app/core/api-client.ts`: existing shared client now accepts GET query parameters, PATCH, and typed optional pagination metadata. API base configuration and bearer handling stay centralized.
2. `src/app/features/customers/customer-api.service.ts`: customer types and the three API operations, response checks, feature error mapping, initials, and UTC date presentation.
3. `customers.component.ts` / `.html`: reactive filters, URL state, cancelable reads, true server pagination, table, and feedback states.
4. `customer-detail.component.ts` / `.html`: customer detail, type check, confirmation, single in-flight status write, and reconciliation.
5. `customer-status.component.ts` and `customers.scss`: shared status presentation and scoped directory/detail styling.
6. `src/app/core/locale.service.ts`: English/Arabic labels. `src/app.routes.ts` and `layout/component/app.menu.ts`: guarded lazy routes and navigation.
7. `tests/customers.spec.ts`: browser integration cases using synthetic fixtures.

## Differences from the legacy wireframes

Full-size `Customers.png` and `Customer details.png` were inspected. The original files remain unchanged.

- City and joined-date filters are deferred: the backend does not currently implement them. City and joined date are still shown as data.
- Email and customer pictures are absent from the resource/model contract. No invented email, stock photo, or upload action is shown. Initials are visual identifiers only.
- The API has a single full name; the screen does not guess first/last name boundaries.
- Status changes use a named confirmation action on detail rather than an instant row toggle.
- No export, add-customer, bulk action, order-history navigation, or unsupported sort/page-size controls.

Useful future addition: an account-status audit trail with administrator, time, and reason. This would help review access changes, but requires a separately reviewed Laravel contract and persistence change.

## Checks

```powershell
npm run typecheck
$env:NG_BUILD_MAX_WORKERS='2'
npm run build
npm test
```

Playwright uses a dedicated production-build preview on port **4201** by default, preserving the normal development server on 4200. Override `OCTOGEAR_TEST_PORT` if necessary. `npm run preview` defaults to 4200 and can separately use `OCTOGEAR_PREVIEW_PORT`. Build before browser tests.

API verification uses SQLite `:memory:`, array cache/session, and the existing PHPUnit configuration:

```powershell
$env:APP_ENV='testing'
$env:DB_CONNECTION='sqlite'
$env:DB_DATABASE=':memory:'
$env:DB_URL=''
$env:CACHE_STORE='array'
$env:SESSION_DRIVER='array'
php vendor/bin/phpunit --filter 'AdminUserManagementTest|AdminSessionTest'
```

See the current progress record in `PROJECT_DOCUMENTATION.md` for actual final results. Browser intercept tests and isolated Laravel tests verify the two sides of the contract; they are not live end-to-end authentication with a retained account.

Official component references: [PrimeNG table](https://primeng.org/table), [PrimeNG select](https://primeng.org/select). The committed PrimeNG 21 installation was used to compile and verify the implementation.

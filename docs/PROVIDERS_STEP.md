# Step 3: service providers

This slice adds the provider directory, provider details, confirmed block/unblock,
and a read-only list of the provider's stores. It follows the existing OctoGear
navy/yellow identity and PrimeNG/Sakai patterns. The full-size legacy references
`Service providers.png` and `Service provider details.png` were reviewed; the
original files remain unchanged.

## Review the screens

1. Start the Laravel API and Angular app, then sign in with an existing admin.
2. Choose **Service providers** in the sidebar. The table shows name/ID, phone,
   city, joining date in UTC, store count, account status, and View details.
3. Use name, phone, status, and city together, then Apply filters. Results use
   server pagination with **25 providers per page**. Filters and page stay in the
   URL through details, Back, and refresh. A disappearing last page is corrected.
4. Cities download once on first picker interaction, and English/Arabic city
   searches happen locally. Customers and providers share the same in-memory
   catalog. Changing pages does not download it again; browser reload clears it.
5. Open a provider to see grouped contact/account information and the real store
   count. Details are freshly read from Laravel; account records are not cached.
6. Block/unblock opens a dialog with identity and the action's effect. Cancel sends
   nothing. Confirm sends one PATCH, followed by a fresh GET. An uncertain write
   requires Refresh provider before another attempt. No automatic write retries.
   Blocking account access does **not** change the stores' active/inactive fields.
7. Choose **Show stores**. Only now is that provider's store list requested. It
   includes inactive stores and shows name/ID, phone, city, and store status.
   This reuses the existing **15-store** page size; the 25-row requirement applies
   to users. Refresh/retry and previous/next pages use server metadata.
8. Switch to Arabic and review at mobile width. Text and layout use RTL, phone
   numbers remain LTR, and wide tables scroll inside their surfaces.

Automated checks use synthetic responses. Any live block/unblock performed during
manual review affects the real account; the implementation work did not do this.

## API contract

All requests use `ApiClient` and the single `public/app-config.json` API base.

| Action | Method and API-relative path | Inputs |
| --- | --- | --- |
| Provider directory | GET `admin/users/providers` | `name`, `mobile`, `status`, `city_id`, `page` |
| Provider detail | GET `admin/users/{id}` | User ID |
| Account status | PATCH `admin/users/{id}/status` | `status`: `blocked` or `unblocked` |
| Provider stores | GET `admin/stores` | **New optional `owner_id`**, existing `page` |
| City options | GET `admin/cities/options` | None; local name search after download |

Provider list/detail reuse `AdminUserResource`: ID, full name, mobile, type, account
status, city, creation time, order count, store count. A detail that now belongs to
a customer is unavailable on the provider route and exposes no account action.
403 displays denied access; authenticated 401 follows the shared session flow.

Store filtering accepts an optional positive integer referencing a non-deleted
user. It is an owner filter on a general admin endpoint, so it does not introduce
a separate provider-type rule. Omitted/null/empty owner retains existing behavior.
Unknown, deleted, malformed, or non-positive IDs return localized 422 errors.
Owner combines with existing name/mobile/status filters before pagination.
The existing `AdminStoreResource` returns each store's owner and localized city.
The web rejects a response containing a different owner, preventing an older API
that ignores the new filter from displaying unrelated stores in this panel.

## Laravel change, in review order

In `C:/Tamkkun/OctoGearProject/OctoGear-api`:

1. **`routes/api.php` — unchanged.** Existing admin user/store routes already use
   `auth:sanctum,admin` and `admin.active`. No new route or permission policy.
2. **`app/Http/Requests/Admin/StoreIndexRequest.php` — changed.** Adds `owner_id`
   integer/minimum/existence validation, excluding soft-deleted users. The shared
   BaseRequest keeps the established 422 envelope.
3. **`app/Http/Controllers/Api/Admin/AdminStoreController.php` — unchanged.**
   Passes only validated inputs into the existing service.
4. **`app/Services/AdminStoreService.php` — changed.** Applies `where('user_id',
   owner_id)` before pagination. Existing eager loads, car counts, newest-first
   ordering, 15-store pages, store detail and status behavior are preserved.
5. **`lang/en/auth.php`, `lang/ar/auth.php` — changed.** Add clear owner validation
   messages. No schema/migration or retained-data change is needed.
6. **`app/Http/Resources/AdminStoreResource.php` — unchanged.** Reuses the existing
   store/owner/city response and pagination envelope; no new response fields.
7. **`tests/Feature/AdminProviderStoresTest.php` — added.** Covers owner isolation,
   pagination, inactive stores, combined filters, empty/deleted records, localized
   invalid-owner errors, and guest/user/blocked-admin denial.

Provider list/detail/status already work through AdminUserController,
UserIndexRequest, UserStatusRequest, AdminUserService, and AdminUserResource.
Their business rules and 25-user page size are unchanged by this slice.

## Web implementation, in review order

1. `src/app/features/users/user-directory.config.ts`: explicit customer/provider
   route configuration, expected account type, navigation root, icon, and typed
   translation keys. It does not derive endpoint types from untrusted query text.
2. `user-api.service.ts`: shared account types, existing user API operations,
   error mapping, initials, and UTC formatting. This replaces CustomerApi.
3. `user-directory.component.ts/.html`: the existing customer table/filter flow,
   now shared with providers. URL state, cancelable reads, local city picker, and
   pagination are preserved; providers also show the existing stores_count.
4. `user-detail.component.ts/.html`: shared identity/type checks and confirmed
   account actions. Provider details include the separate stores component.
5. `user-status.component.ts`, `users.scss`: the existing status and visual rules
   moved from `features/customers`. Existing customer CSS hooks are preserved.
6. `src/app/features/providers/provider-store-api.service.ts`: scoped store GET
   and response checks. `provider-stores.component.ts/.html`: on-demand loading,
   pagination, explicit refresh/retry, localized statuses and responsive table.
7. `src/app.routes.ts`, `layout/component/app.menu.ts`, `core/locale.service.ts`:
   guarded lazy provider routes, working sidebar link, English/Arabic copy.
8. `tests/providers.spec.ts`: provider behavior and screenshots. The unchanged
   authentication and customer suites guard against shared-component regressions.

Shared user components avoid maintaining two implementations of filtering and
account-access behavior. Routes remain `/customers`, `/customers/:id`,
`/providers`, `/providers/:id`. No new dependency or runtime configuration key.

## Deliberate limits and next review

- Provider email and profile photos are absent from the current user contract;
  initials are used without inventing contact fields or uploaded images.
- Commercial registration belongs to individual stores. It is not presented as
  one provider-level document. Full store details and document review belong to
  the following store-management slice.
- Joining-date filters are still deferred because the current user API does not
  implement them. No decorative filter or browser-only filtering of 25 rows.
- Provider applications/store requests, store activation controls, audit history,
  bulk operations, exports, and account creation are separate reviewable work.
- Useful next step: store requests/review, followed by full store management,
  after reading their wireframes and actual approval/document contracts.

Deploy the API owner-filter addition together with this web update. No migration
or worker change is required for this slice. No production deployment occurred.

## Verification

Use the commands in `ARCHITECTURE.md` for Angular typecheck, production build, and
Playwright. Browser tests intercept all API calls and use the production preview;
they do not prove live authentication against retained accounts.

The API focused set is `AdminProviderStoresTest|AdminStoreManagementTest|AdminUserManagementTest|AdminCityFilterTest|AdminSessionTest`.
Use SQLite `:memory:`, empty DB_URL, and array cache/session as in phpunit.xml.
Read the current progress record in `PROJECT_DOCUMENTATION.md` for actual results,
including any failures in the full API suite.

# Step 1: connect the web administrator session

## Problem and result

The existing admin login correctly issued an Admin-owned Sanctum token. The shared `sanctum` guard was restricted to the `users` provider, so protected routes using only that guard rejected the admin's bearer token. The existing `admin` guard already targets the separate admin table.

The fix keeps both guards and their provider boundaries. Admin routes and shared media/logout use `auth:sanctum,admin`: Laravel tries the existing user guard, then the existing admin guard, and sets the successful guard for `$request->user()`. Admin routes still require `admin.active`, which rejects customer/provider identities and blocked administrators. Mobile routes retain their original user-only guard. Login/logout response shapes are unchanged.

## Request flow

1. Angular sends `POST /api/auth/admin/login` with email and password.
2. Existing throttle middleware and `AdminLoginRequest` validate the request.
3. Existing `AuthController::adminLogin` delegates to `AuthService::adminLogin`, which checks the credentials and blocked status and issues the token.
4. Angular keeps the token in memory and sends `GET /api/admin/profile` with its Authorization bearer header.
5. `auth:sanctum,admin` authenticates it; `admin.active` verifies the admin model/status.
6. The new thin `AdminProfileController::show` returns an `AdminProfileResource` inside the existing API success envelope. No service/repository is needed to serialize the already-authenticated identity.
7. The resource exposes only employee_id, name, email, assigned_role and status, with `Cache-Control: no-store, private`.
8. Angular opens the guarded Sakai shell and requests the existing `GET /api/admin/dashboard` summary.
9. `POST /api/auth/logout` uses the existing device/token service to revoke the current token. Angular clears its in-memory identity after confirmed success.

## Changed Laravel files

- `routes/api.php`: use the existing admin fallback guard on admin/media/logout; add the profile route.
- `app/Http/Controllers/Api/Admin/AdminProfileController.php`: current identity endpoint.
- `app/Http/Resources/AdminProfileResource.php`: explicit minimal serialization.
- `tests/Feature/AdminSessionTest.php`: real bearer-token regressions, rather than relying solely on actingAs.
- `README.md`: document the new profile contract and authentication correction.

No migrations, account creation, role/permission redesign, token-expiration change, real external messaging, or database resets are part of this slice. Existing inactive-admin behavior is preserved; only blocked admins are rejected by the current policy.

## Profile response

```json
{
  "success": true,
  "message": "...",
  "data": {
    "employee_id": 1,
    "name": "Example administrator",
    "email": "admin@example.test",
    "assigned_role": "admin",
    "status": "active"
  }
}
```

This is a schema example, not a real account or credential. Existing role values are admin, manager, employee, hr and developer. The web must not infer new permissions from those labels.

## Verification

The new isolated SQLite tests cover real login token -> profile -> dashboard -> logout -> rejection of revoked token; customer/provider rejection from admin identity; admin-token rejection from mobile profile; unchanged customer profile/logout; and blocked/missing authentication. Full regression and frontend verification results are recorded in PROJECT_DOCUMENTATION.md.

# Administrator accounts, permissions and personal settings

Implemented 2026-10-22 for Angular / PrimeNG / Sakai and the existing Laravel API.
Read both projects' AGENTS.md files before extending this feature. The current
owner decision replaces email invitations with manually shared temporary passwords.
No email provider, SMS delivery or public registration is involved.

## 1. Account flow

An Administrator opens Sub-admins and adds a name, unique email, Saudi mobile,
role and preferred Arabic/English language. They enter a temporary password or use
Generate 16-character password. Generation uses browser crypto.getRandomValues
with rejection sampling, including uppercase/lowercase/digit/symbol characters.
Manual/new passwords require at least 15 characters and at most 72 UTF-8 bytes,
matching the existing bcrypt storage without silent truncation. Password managers,
paste and long passphrases remain supported.

The operator confirms access changes with their own current password. On success
the dialog retains the temporary password only in memory, with an explicit Copy
action and private-sharing guidance. It disappears on closing/navigation. No password
is returned by Laravel or written to browser storage. Laravel persists only its hash.
Temporary passwords expire after 24 hours. An Administrator can issue a replacement.

First login verifies the temporary password but creates **no Sanctum token**.
It returns `requires_password_change`, a 256-bit opaque `challenge`, and
`expires_in: 600`. The challenge is stored hashed in a separate table; it is not
an API bearer and exists only in browser memory. Reloading returns to sign-in.
A fresh successful temporary login replaces the prior challenge. A valid challenge
can set a different confirmed password once, within ten minutes and before the
temporary password expires. Only then does Laravel issue the normal admin token.
The browser verifies profile/permissions before opening the permitted landing page.

Existing accounts retain their password and are not forced through setup by the
migration. They immediately receive the new permissions for their existing role.
Inactive (Suspended), blocked and archived accounts cannot log in. Existing inactive
access was intentionally corrected in this feature. Pending-setup accounts cannot
use older/manual tokens to skip setup, read media, or receive support broadcasts.

## 2. Built-in role matrix

Roles use the existing database values; no role names or existing assignments are
silently migrated. `app/Support/AdminPermissions.php` is the one server-side matrix.
The web reads effective permissions from profile, and role previews from the API.
There is no editable role designer or per-account override in this slice.

| Role | Allowed access |
| --- | --- |
| Administrator (`admin`) | All implemented pages/actions, including staff management and existing eligible cancellation/refund APIs. |
| Manager (`manager`) | Dashboard/financial summary; customer/provider status; store review/activation; order/payment reads; support; catalog CRUD. No staff management, order cancellation or refund. |
| Support employee (`employee`) | Customer/provider, store/document and order/quoted-price reads; support replies/read/close/reopen. No status changes, payment records, financial dashboard or catalogs. |
| HR viewer (`hr`) | Read-only staff directory, role previews and security history. |
| Developer (`developer`) | Car company/model-name reads and CRUD. No customer, payment, support or staff access. |

All active, fully configured roles can read their own profile, change their own
password and language, and log out. The small city reference selector remains
available to signed-in admins, consistent with the public city reference catalog.

Every business admin route declares `admin.permission:<permission>`; the middleware
delegates to registered AdminPolicy and the matrix, on every request. Existing
object rules still apply. Private media checks the corresponding read permission.
Support policies and delivery-time recipient selection use `support.access`.
Order resources omit payment records without `payments.view`; quoted order/offer
prices are deliberately part of `orders.view`. Dashboard includes financial totals
and is therefore limited to Administrator/Manager.

The sidebar and route guards use server permissions, with no role-name fallback.
An old server without permissions cannot open the protected shell. Business actions
are hidden on existing pages where the role lacks write access. Sidebar ordering
ends with Chats → Sub-admins → Car companies → Car models. Settings is in the topbar.

## 3. Safe account management

- The list uses 25-row server pagination; name/email/mobile/ID, role and status
  filters combine before paging. Applied filters live in the URL. Details and edit
  forms reuse the selected row, without another detail GET. Security history loads
  only on explicit request and has 25-row pagination.
- Creates, edits, temporary resets and archival require the operator's current
  password. Updates require the displayed integer version; stale submissions get
  409 and must reload. Writes are single-flight and never auto-retried.
- A singleton database lock serializes access mutations before locked actor/target
  rechecks. Editing one's own access is prohibited; use Settings for own password.
  At least one active Administrator with completed setup must remain.
- Editing account/access details, resetting or archiving revokes all target tokens
  and outstanding challenges. Reactivation requires a fresh login. Archival is a
  soft delete: audit records are retained and the email remains reserved. Archived
  accounts leave the directory; no purge/restore function is included.
- Security events record actor/target IDs, UTC time, action, and role/status changes.
  No passwords, challenges, bearer tokens or request bodies are recorded. Existing
  records have no invented historical events. Audit IDs remain after archival.
- Uncertain writes require closing/reloading before another mutation. If a create
  may have succeeded and the temporary password was lost, locate the account and
  explicitly reset it. The API never retrieves plaintext credentials.

## 4. Personal settings

`/settings` shows account identity, role, allowed actions, password-change date and
the saved language. It reuses the existing database-backed language preference flow.
Changing password requires current password, a different new password and matching
confirmation. Success revokes **all** sessions, clears the browser session, and
returns to login with a success notice. No periodic password rotation is imposed.
Email/role/account-status changes stay under another Administrator's management.

Email recovery and MFA are not implemented. The login recovery message directs the
user to an Administrator for a new temporary password. A sole Administrator who
loses access needs a separately controlled operator recovery procedure; this UI
does not add an unauthenticated recovery bypass.

## 5. Laravel review order

1. Additive migration `2026_10_22_180000_add_admin_account_security.php`: security
   metadata on `admin`, one security lock, hashed setup challenges, security events.
2. `AdminPermissions`, `Admin::hasPermission`, `AdminPolicy`, `EnsureAdminPermission`,
   route declarations, existing catalog/payment/support policies and media guards.
3. `AdminAccount*Request` and `AdminPasswordRequest`: localized validation; shared
   `AdminPassword` rules. Controller → injected service/repository → resource.
4. `AdminCredentialService`: existing AuthService delegates only admin login here;
   temporary setup, password replacement, session issuance/revocation and audit.
   Mobile OTP/authentication decisions are outside this change.
5. `AdminAccountService`: locked current-password/permission/version checks and
   account writes; `AdminAccountRepository`: filtered lists and event pagination.
6. Explicit `AdminAccountResource` / `AdminProfileResource` allowlisted responses;
   `AdminOrderResource` protects nested payment data.
7. `AdminAccountSecurityTest`: real bearer setup/denial/revocation, roles, hashing,
   expiry/replay, media, audit, validation, pagination and throttling. Existing tests
   use an Administrator factory by default; restricted roles are explicit fixtures.

| Method | API path | Purpose |
| --- | --- | --- |
| POST | auth/admin/login | Existing route; normal token OR setup challenge |
| POST | auth/admin/password-setup | Consume challenge and choose private password |
| GET | admin/profile | Existing route; adds effective permissions/change date |
| PATCH | admin/profile/password | Current admin's password; revoke all sessions |
| GET / POST | admin/accounts | List / create accounts |
| GET | admin/accounts/roles | Role values and permission previews |
| PATCH / DELETE | admin/accounts/{id} | Edit / archive with version + current_password |
| POST | admin/accounts/{id}/reset-password | Replace temporary password; same confirmations |
| GET | admin/accounts/{id}/events | Paginated security history |

Mutations/settings use existing envelopes, no-store/private success responses,
5/minute password-operation IP limits, plus existing admin-login throttling.
Create/reset accept `password`; edit forbids it. All mutations require
`current_password`; edit/reset/archive also require `version`. New setup sends
`challenge`, `password`, `password_confirmation`. Settings sends
`current_password`, `password`, `password_confirmation`. Password fields/challenges
are excluded from exception flashing. No secret enters a URL or notification.

## 6. Angular review order and rollout

Read SessionService/guards → typed `en.ts`/`ar.ts` → shared PasswordField → login
setup → `features/admins` → menu/topbar and existing action gates. API base URL
remains exclusively in `public/app-config.json`; its owner's hosted value is preserved.

Deploy backend/migration **before** the frontend, and restart realtime queue workers
so delivery-time role checks take effect. Review existing role assignments first:
Developer accounts now have catalog access only; staff management requires an
existing active `admin` role. Never promote every existing account automatically.

Apply only this migration on a retained database after the normal backup/release
review, not a reset or a blanket run of unrelated pending migrations:

```powershell
php artisan migrate --path=database/migrations/2026_10_22_180000_add_admin_account_security.php
```

Keep HTTPS for production password/bearer transport. The web still uses the
existing tab-scoped bearer session, not a new cookie/CSRF architecture. SMTP/API
credentials are unnecessary. MySQL concurrency/load verification and live hosted
end-to-end verification are separate deployment checks; automated tests use SQLite
memory and mocked HTTP/WebSocket responses. No real credentials/messages are used.

Verification results and local migration status are recorded in PROJECT_DOCUMENTATION.md.
Security rationale follows [OWASP authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
and [authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html).

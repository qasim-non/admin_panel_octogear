# Admin language preference

Implemented 2026-10-21. Follow `ARCHITECTURE.md` and `LARAVEL_SESSION_STEP.md`.

## User flow

1. Before sign-in, the language button changes the browser preference only.
2. Login sends email, password, and `preferred_language` (`ar` or `en`). After
   credential/status checks, Laravel initializes a missing admin preference with
   that choice. An existing saved choice takes precedence across browsers.
3. The existing GET `admin/profile` returns the saved preference. Angular applies
   it before entering the protected page, including after refresh. No extra
   preference GET or automatic PATCH is required on page entry.
4. The signed-in language button sends one PATCH `admin/profile/language` with
   `{ "preferred_language": "ar" }` or `en`. Controls prevent overlapping writes.
   The UI changes language after confirmation; failures show a localized retry
   message and keep the current language. Writes are not automatically retried.
5. Logout/session expiry clears account state. A delayed response cannot apply a
   preference to another session. Other tabs/devices read the saved choice on
   their next profile load; there is no polling or cross-device live synchronization.

Browser localStorage remains a pre-login convenience. The database is the source
for a signed-in account. Nothing infers language from name, nationality, or city.
`Accept-Language` continues selecting each API response's language without changing
stored preferences. A profile GET never writes. Older clients may omit the new
login input; untouched accounts remain null until a choice is recorded.

## Arabic and English files

- `src/app/core/i18n/en.ts`: English labels, buttons, errors, and explanatory text;
  it defines `TextKey` from the available keys.
- `src/app/core/i18n/ar.ts`: the matching Arabic translations, checked by
  `Record<TextKey, string>` so missing or extra keys fail typechecking.
- `src/app/core/locale.service.ts`: selects the dictionary, updates HTML lang/dir,
  and retains the browser preference. Components still use `locale.t('key')`.

Existing copy was moved unchanged; the provider heading stays **عدد المتاجر**.
The database stores only the choice, not duplicated UI translation dictionaries.
Database content, names, and free text remain server data; the app does not invent
Arabic/English copies of customer names or request descriptions.

## Laravel review order

Inside `C:/Tamkkun/OctoGearProject/OctoGear-api`:

1. `2026_10_21_130000_add_preferred_language_to_admin_table.php`: additive nullable
   two-character field on the existing singular `admin` table. No guessed backfill,
   account reset, or default-language migration for historical accounts.
2. `Admin`: fillable field and the existing `PreferredLanguage` enum cast.
3. `AdminLoginRequest`, `AuthController`, `AuthService`: optional validated login
   input; initialize only after successful authorization with a conditional
   `whereNull` update so another login cannot overwrite an established choice.
4. `AdminProfileResource`: adds `preferred_language` to the private profile response.
5. `routes/api.php`, `AdminProfileController`: PATCH the authenticated admin's own
   preference, using existing `auth:sanctum,admin` and `admin.active` protection.
   No admin ID is accepted as a target. Other profile fields cannot be modified.
6. Reuse `UpdateLanguageRequest`, `PreferredLanguage`, and `UserPreferenceService`
   from the concurrent mobile-language work. The service now supports User or
   Admin; existing user behavior is preserved. Validation messages live in
   `lang/ar/admin_web.php` and `lang/en/admin_web.php`.
7. `AdminLanguagePreferenceTest`: initialization/preservation, authorization,
   invalid values, self scope, older clients, read-only GETs, and migration rollback
   preserving account rows. `PreferredLanguageTest` guards the shared user path.

Deploy the migration and API before the frontend. The migration was applied to
the verified **local MySQL** database using only its explicit `--path`; no unrelated
pending migrations, seeders, or production database were run. Current sessions
with null preferences initialize on the next login or signed-in language change.

## Angular review order and checks

Read the dictionaries, LocaleService, SessionService, then app.topbar.ts. The
existing session generation check prevents stale async responses from affecting
new sessions. A small saving/error state belongs to SessionService; LocaleService
has no HTTP dependency, avoiding an interceptor/session dependency cycle.

`tests/language-preference.spec.ts` covers server preference precedence, initial
Arabic login, single writes, refresh, failed-save retry and session expiry.
The existing feature mocks implement the new PATCH; the complete browser suite
guards translation and navigation behavior. Actual results are recorded in
`PROJECT_DOCUMENTATION.md`. Browser tests use synthetic responses; no retained
admin account was logged into or assigned a language during verification.

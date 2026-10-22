# Support conversations in the dashboard

Implemented 2026-10-22 for the existing Laravel support feature. Read this guide
before changing `src/app/features/support`. The API contract remains in
`../OctoGear-api/SUPPORT_CHAT.md`; no API routes, migrations or mobile files were
changed in this dashboard slice.

## User workflow

- **Chats** opens `/chats`, initially filtered to open conversations. The API
  orders by latest activity and ID descending, with 20 records per page.
- Search matches conversation ID, account name or mobile. Status, account type
  and unread filters combine on the server. Applied filters/page live in the URL
  and survive refresh, detail navigation and the Back to chats link.
- One existing conversation belongs to each account, whether customer or provider.
  There is no dashboard create button: the account's first support message creates
  the thread in Laravel. No empty conversation or second conversation is created.
- Details show text history, latest activity, account links, team unread counts,
  and an on-demand status audit. Earlier messages load in cursor pages of 40.
  All displayed times are UTC. Text is rendered with Angular interpolation.
- Replies are text only, 1–2000 Unicode code points after trimming. Sending does
  not resolve or close a conversation. An explicit confirmation closes an issue
  only after the administrator considers it solved. Closed history stays readable;
  Closed/All filters retain access, and reopening returns it to the open queue.
- English/Arabic, RTL, keyboard controls, localized numbers and responsive layouts
  reuse the existing shell, typography and PrimeNG theme. The table scrolls inside
  its region on small screens instead of widening the page.

## Angular responsibilities

1. `support-workspace.component.ts` owns the nested list/detail outlet and one
   route-scoped `SupportRealtime` instance. Leaving Chats closes the connection.
   Other dashboard routes do not start support requests or background polling.
   Root-scoped `SupportRealtimeConfig` retains one in-memory configuration attempt
   for the current admin token and API base, across Chats route navigation.
2. `support-api.service.ts` maps and validates the existing response envelopes,
   pagination, summaries, messages, audit events and socket configuration. All HTTP
   calls use `ApiClient`; the existing interceptor supplies locale, token, timeout
   and authenticated-401 handling. No bearer token enters a socket URL.
3. `support-directory.component.*` owns URL filters and cancellable list requests.
   Coalesced socket events trigger a server refresh for correct ordering, filter
   membership and totals. Background refresh preserves unapplied filter text.
4. `support-thread.service.ts` coordinates history, versioned summaries, replies,
   reads and status actions. Generation guards discard results after route changes;
   destruction cancels HTTP subscriptions. The detail component owns presentation,
   scroll position, confirmation dialogs and foreground visibility.
5. `support-drafts.service.ts` retains unsent text and uncertain reply UUIDs in
   memory across navigation, scoped to the exact admin token. Logout/account
   changes clear them. They are deliberately not stored in localStorage or logs.
   A full page reload or tab closure discards these in-memory drafts.

## Existing Laravel request flow

The `admin/support/*` routes use Sanctum admin authentication and active-admin
middleware. `SupportRequest` and its specialized Form Requests authorize through
the existing support policy and validate filters, text/UUID, read boundaries and
expected status versions. `AdminSupportConversationController` delegates reads to
`SupportConversationRepository` and mutations to `SupportChatService`.

- `GET admin/support/conversations` supplies filtered summaries and pagination.
- `GET .../{id}/timeline` supplies `{conversation,messages,has_more}`. `before_id`
  loads older history; `after_id` recovers the earliest next page of newer messages.
- `POST .../{id}/messages` accepts `{content,client_message_id}`. Actor identity
  comes from authentication, never a browser-supplied sender ID.
- `PATCH .../{id}/read` accepts `{through_id}` and advances the shared support-team
  boundary monotonically. Opening a directory never marks its rows as read.
- `PATCH .../{id}/status` accepts `{status,version}`; the transactional service
  rejects stale versions with 409 and records the status audit.
- `GET .../{id}/events` loads the paginated audit only on request.
- `GET admin/support/realtime` supplies public Reverb connection details and the
  exact private token channel. `POST admin/support/realtime/auth` authenticates the
  socket subscription with the same HTTP bearer boundary.

Resources serialize prepared summaries/messages. Existing jobs deliver
`support.updated` to authorized sessions and notify the mobile recipient after an
admin reply. Database uniqueness, transaction locks, authorization, idempotency and
notification delivery remain backend responsibilities; this UI does not duplicate
those rules or create another conversation table.

## Concurrency, delivery and reading

Each reply gets a cryptographic UUID. Single-flight sends retain the exact text and
UUID when delivery is uncertain. Retry checks/replays that receipt without creating
a duplicate, including if the conversation has since closed. A definite validation
or permission rejection leaves the draft editable. Writes are never auto-retried.

Close/reopen confirmation captures the displayed version. A newer local version or
server 409 requires the administrator to review current state and confirm again.
Uncertain status results require a successful refresh before another status mutation.

Conversation snapshots only replace equal/older versions; messages merge by ID.
The recovery cursor advances only from successful HTTP timeline pages, never from
a live message ID. Reconnect and incoming message events drain forward pages to
recover gaps. A summary may be newer than its accompanying message batch, so the
coordinator checks for that read race and performs a bounded empty-page retry.

Read receipts wait until the page is focused and visible, the latest history is
loaded, and its bottom edge is inside the actual viewport for 1.5 seconds. An
intersection observer prevents off-screen mobile history from being acknowledged;
resizing preserves the latest position when already at the bottom. Scrolling earlier
does not acknowledge incoming messages. Failed reads keep the server unread count
and offer explicit retry. The support boundary is shared by the entire team, as
defined by the API; it is not a per-administrator inbox.

## Realtime and operations

The native WebSocket adapter implements the subset of the
[Pusher Channels protocol](https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/)
used by Laravel Reverb: protocol 7 handshake, authenticated private subscribe,
subscription confirmation and ping/pong. No new npm dependency is introduced.
Production sockets require WSS; unencrypted WS is accepted only for loopback
development. Socket reconnect uses bounded exponential backoff with the cached
configuration; it does not repeat GET admin/support/realtime. That GET runs once
on first entering Chats in a signed-in page session, and again only after a browser
reload, a token/API-base change, or an explicit Reconnect action. In-flight requests
are shared. Disabled and failed configuration results are also retained, so a
configuration outage does not become an HTTP retry loop. Configuration failure waits
for manual recovery. Reconnect clears the cached attempt before trying again. Hidden/offline pages stop
the socket; foreground/reconnection refreshes the selected queue/thread. Token
changes invalidate old callbacks. A denied subscription does not retry endlessly.

The UI displays connection state and offers manual refresh when realtime is disabled
or unavailable. There is no interval polling. The existing support migration, API,
Reverb and queue workers must already be deployed and correctly configured. Web
hosting/CSP must permit the configured WSS endpoint, and Laravel must allow the
dashboard's HTTP origin. No deployment or worker changes are performed here.

## Verification

`tests/support.spec.ts` uses synthetic accounts and intercepted HTTP/WebSocket
traffic. It covers queue defaults/filters/pagination, navigation/drafts, safe text
rendering, history order, reply limits/UUID retries, closed replay, explicit status
actions and conflicts, read failure/visibility, socket authentication, missed-page
recovery, stale-event rejection, error/session states, and English/Arabic desktop
and mobile screenshots. Run typecheck, a production build, then Playwright with
the separate test preview port as described in `ARCHITECTURE.md`.

See `PROJECT_DOCUMENTATION.md` for the actual final run results. Mocked browser
checks do not prove live admin-to-mobile delivery; no retained account login or
real customer message is used for verification.

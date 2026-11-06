# Backend Auth Contract

This document describes the backend authentication contract for issue #17.
The web app owns the login/register UI and maps Better Auth errors to UI states.

## Configuration

Set these API environment variables when the API has a production database:

- `BETTER_AUTH_SECRET`: random secret with at least 32 characters. Generate one
  with `bunx --bun auth@1.7.14 secret`; do not commit it or log it.
- `BETTER_AUTH_URL`: public API base URL, such as `https://api.example.com`.
- `CORS_ORIGINS`: comma-separated exact frontend origins when the browser and
  API use different origins. Each origin must be trusted by Better Auth too.

The browser must send requests with credentials so the HTTP-only session cookie
is set and sent back. Auth routes use the Better Auth response contract. Other
API routes use the shared `{ code, message, status, details? }` error envelope.
If auth is not configured in development or the database is unavailable, the
API returns the shared `AUTH_UNAVAILABLE` 503 envelope.

The Better Auth Drizzle adapter uses database transactions for auth operations.
Signup creates the user and credential account atomically: if account creation
fails, the user insert is rolled back.

## Endpoints

All routes are under `/api/auth` and are handled directly by Better Auth 1.7.14.
Request and error shapes are therefore Better Auth's own contract.

| Method and path | Purpose | Success behavior |
|---|---|---|
| `POST /api/auth/sign-up/email` | Register with `name`, `email`, `password` | Creates a user with `role: "user"` and `emailVerified: false`, sends a verification email (dev: `console.log`), and returns `{ token: null, user }` — **no session cookie** until the email is verified. |
| `POST /api/auth/sign-in/email` | Sign in with `email`, `password` | If `emailVerified` is `false`: `403 FORBIDDEN` (`EMAIL_NOT_VERIFIED`) and a fresh verification email is sent. Otherwise sets a session cookie and returns Better Auth's signin response. |
| `POST /api/auth/sign-out` | End the current session | Revokes the session and clears the session cookie. |
| `GET /api/auth/get-session` | Read current session | Returns `null` when unauthenticated or expired; otherwise returns `{ session, user }`. |
| `POST /api/auth/update-user` | Update the signed-in user's name or image | Returns Better Auth's `{ "status": true }`; fetch the session again to read the updated user. |
| `POST /api/auth/request-password-reset` | Request a reset email with `email`, `redirectTo` | Always returns `{ "status": true, "message": "..." }`, whether or not the email exists (timing-safe, does not leak account existence). `redirectTo` must be a trusted origin (see Configuration) or the request is rejected before any lookup. |
| `GET /api/auth/reset-password/:token` | The link the reset email points to | Handled entirely by Better Auth: redirects to `redirectTo` with `?token=<raw>` on a valid token, or `?error=INVALID_TOKEN` if invalid or expired. The frontend never calls this directly — it's the email link's destination. |
| `POST /api/auth/reset-password` | Set a new password with `token`, `newPassword` | Returns `{ "status": true }` on success. `newPassword` must be 8–128 characters (Better Auth's `minPasswordLength`/`maxPasswordLength` defaults — not overridden in this config). On success, every other session for that user is revoked (`revokeSessionsOnPasswordReset: true`) — the user must sign in again on other devices. |
| `POST /api/auth/send-verification-email` | (Re)send a verification email with `email`, `callbackURL` | Always returns `{ "status": true }`, whether or not the email exists or is already verified (same non-leaking pattern as password reset). Also fires automatically on a failed sign-in caused by an unverified email (`sendOnSignIn: true`) — the frontend does not need a separate "resend" trigger for that path. |
| `GET /api/auth/verify-email` | The link the verification email points to, `token` + optional `callbackURL` | Handled entirely by Better Auth. With `callbackURL`: redirects there on success (no extra query params — see below), or with `?error=INVALID_TOKEN\|TOKEN_EXPIRED\|USER_NOT_FOUND` on failure. Without `callbackURL`: returns `{ "status": true, "user": null }` as JSON directly (used by integration tests, not the frontend). On success, sets a session cookie (`autoSignInAfterVerification: true`) — verifying logs the user in. |

Profile updates require a valid session cookie. Send at least one of `name` or
`image`. A name must contain non-whitespace characters and be at most 100
characters. An image must be an HTTPS URL without credentials, at most 2048
characters, or `null` to remove it. This endpoint stores an image URL; it does
not upload or inspect the image. Email changes and role changes are not profile
updates. Auth errors retain the Better Auth response format.

Signup input cannot set `role`. The server config declares the role field as
non-input and returns it in the user object. Supported role values are `user`,
`seller`, and `admin`.

The frontend may rely on these `user` fields:

```json
{
  "id": "uuid-string",
  "name": "Example User",
  "email": "user@example.com",
  "image": null,
  "emailVerified": false,
  "role": "user"
}
```

`image` may be a URL or `null`. Better Auth may include additional non-sensitive
user metadata. Password hashes and database models are not part of the user
payload. Better Auth signup/signin also returns its `token` field outside the
`user` object; the browser should use the HTTP-only cookie and must not persist
that field as application state or local storage.

`emailVerified` is returned as stored. Email verification is **mandatory**:
an account with `emailVerified: false` cannot sign in (`403 EMAIL_NOT_VERIFIED`)
until the link in the verification email is followed.

Password reset links expire after 15 minutes
(`resetPasswordTokenExpiresIn: 15 * 60`); verification links also expire after
15 minutes (`emailVerification.expiresIn: 15 * 60`). Both the reset email and
the verification email are only ever sent to a `console.log` dev transport
right now — no production email provider is wired up yet (follow-up task, not
part of issue #92).

**Frontend quirk**: on a successful `GET /verify-email?...&callbackURL=X`, Better
Auth redirects to exactly `X` with no extra query params — unlike the error
case, which appends `?error=...`. So the frontend genuinely cannot tell "just
verified successfully" apart from "visited this page directly, nothing
happened yet" from query params alone. `apps/web/app/verify-email/page.tsx`
doesn't guess: absent `?error=`, it shows one calm message that's true either
way ("if you just clicked the link, you're verified — otherwise request a new
one below") instead of claiming a success it can't actually confirm.

## Frontend state mapping

- While the initial session request is pending, show loading state.
- A successful `get-session` response with `null` means guest.
- A successful response with `{ session, user }` means authenticated.
- An invalid or expired cookie is treated as guest by `get-session`.
- Network failures and server failures are errors, not guest state.
- After signout succeeds, clear the in-memory user and show guest state.
- Validate any return URL in the frontend: accept only a local relative path or
  an explicitly allowed same-origin URL; reject external and protocol-relative
  destinations.

The server checks the session cookie on protected routes with `requireAuth`.
Apply `requireRole(...)` after `requireAuth` to allow exact role matches. No
role inherits another role's permissions; route policies must explicitly list
every allowed role.

## Out of scope

Login/register UI, production email delivery for either flow (a provider
still needs to be chosen — dev uses a `console.log` transport, see above),
grandfathering any pre-existing unverified accounts (none exist yet — no
production users have signed up), social login (Google/GitHub), rate
limiting on auth endpoints, seller onboarding/approval, admin dashboard,
image uploads, payments, and purchase history require separate tasks.

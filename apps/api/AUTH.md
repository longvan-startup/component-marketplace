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
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: configure together to send verification
  and password-reset email through Resend. The sender must be on a domain
  verified in Resend. Leaving both unset keeps the API available; when an
  eligible account triggers delivery, Better Auth receives a generic delivery
  error. Production logs only the email type and provider status, or a
  sanitized transport error name with an optional allow-listed network code;
  it never logs recipients, tokenized links, provider response bodies, or API
  credentials. Non-production uses the local
  console transport for development.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: configure together to enable
  Google sign-in. Leave both unset to keep the provider off.
- `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`: configure together to enable
  GitHub sign-in. Leave both unset to keep the provider off.

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
| `POST /api/auth/sign-up/email` | Register with `name`, `email`, `password` | Creates a user with `role: "user"` and `emailVerified: false`, sends a verification email, and returns `{ token: null, user }` — **no session cookie** until the email is verified. |
| `POST /api/auth/sign-in/email` | Sign in with `email`, `password` | If `emailVerified` is `false`: `403 FORBIDDEN` (`EMAIL_NOT_VERIFIED`) and a fresh verification email is sent. Otherwise sets a session cookie and returns Better Auth's signin response. |
| `POST /api/auth/sign-out` | End the current session | Revokes the session and clears the session cookie. |
| `POST /api/auth/change-password` | Change a signed-in credential password with `currentPassword`, `newPassword`, `revokeOtherSessions` | The web app always sends `revokeOtherSessions: true`; Better Auth verifies the current password, revokes the other sessions, rotates the current session cookie, and returns `{ token, user }`. Password length is 8–128 characters. |
| `POST /api/auth/revoke-sessions` | Revoke every session for the signed-in user | Returns `{ "status": true }` after deleting all sessions, including the current one. It does not clear the browser cookie; the web app follows with `/sign-out` for cookie cleanup. |
| `GET /api/auth/get-session` | Read current session | Returns `null` when unauthenticated or expired; otherwise returns `{ session, user }`. |
| `POST /api/auth/update-user` | Update the signed-in user's name or image | Returns Better Auth's `{ "status": true }`; fetch the session again to read the updated user. |
| `POST /api/auth/request-password-reset` | Request a reset email with `email`, `redirectTo` | On successful delivery (or when the email is unknown), returns `{ "status": true, "message": "..." }` without revealing account existence. A provider failure can fail delivery. `redirectTo` must be a trusted origin (see Configuration) or the request is rejected before any lookup. |
| `GET /api/auth/reset-password/:token` | The link the reset email points to | Handled entirely by Better Auth: redirects to `redirectTo` with `?token=<raw>` on a valid token, or `?error=INVALID_TOKEN` if invalid or expired. The frontend never calls this directly — it's the email link's destination. |
| `POST /api/auth/reset-password` | Set a new password with `token`, `newPassword` | Returns `{ "status": true }` on success. `newPassword` must be 8–128 characters (`minPasswordLength`/`maxPasswordLength`). On success, every other session for that user is revoked (`revokeSessionsOnPasswordReset: true`) — the user must sign in again on other devices. |
| `POST /api/auth/send-verification-email` | (Re)send a verification email with `email`, `callbackURL` | Returns `{ "status": true }` without revealing whether the email exists or is verified when delivery succeeds or no email is needed. A provider failure can fail delivery. Also fires automatically on a failed sign-in caused by an unverified email (`sendOnSignIn: true`) — the frontend does not need a separate "resend" trigger for that path. |
| `GET /api/social-providers` | List configured social providers | Returns `{ "providers": ["google" and/or "github"] }`. Ids only. An unconfigured provider is omitted. |
| `POST /api/auth/sign-in/social` | Start Google or GitHub sign-in with `provider`, `callbackURL`, `errorCallbackURL`, `newUserCallbackURL`, and `disableRedirect: true` | Returns `{ "url", "redirect": false }`. The browser navigates to `url`. An unconfigured or unknown provider is an error and does not create a user. |
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
15 minutes (`emailVerification.expiresIn: 15 * 60`). In production, both email
types use Resend when configured. The API does not log tokenized URLs.

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
- After signout succeeds, clear the in-memory user and show guest state. If
  the request fails, retain the user and show a generic error.
- Changing a password keeps the current browser signed in and revokes other
  sessions. Signing out everywhere revokes all sessions, then clears the
  current browser cookie.
- Validate any return URL in the frontend: accept only a local relative path or
  an explicitly allowed same-origin URL; reject external and protocol-relative
  destinations.

The server checks the session cookie on protected routes with `requireAuth`.
Apply `requireRole(...)` after `requireAuth` to allow exact role matches. No
role inherits another role's permissions; route policies must explicitly list
every allowed role.

## Out of scope

Login/register UI, grandfathering any pre-existing unverified accounts (none
exist yet — no production users have signed up), rate limiting on auth
endpoints, seller onboarding/approval, admin dashboard, image uploads,
payments, and purchase history require separate tasks.

## Social sign-in

Google and GitHub are optional and free to the user. A new social account is
created with `role: "user"`. That is the Free membership: there is no Pro
subscription row, and OAuth does not grant Pro. The role field stays
non-input, so the provider profile cannot choose `admin` or `seller`.

Register these redirect URIs on the provider, using the origin of
`BETTER_AUTH_URL` (no path):

- `{origin}/api/auth/callback/google`
- `{origin}/api/auth/callback/github`

The browser returns to `/` after success and `/login?oauth=1` after failure. Both
callback URLs are built by the web app from its own origin. Google and GitHub
are trusted providers. Better Auth still requires the existing local account
to have a verified email before it links an OAuth identity into that row.

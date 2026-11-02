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

## Endpoints

All routes are under `/api/auth` and are handled directly by Better Auth 1.7.14.
Request and error shapes are therefore Better Auth's own contract.

| Method and path | Purpose | Success behavior |
|---|---|---|
| `POST /api/auth/sign-up/email` | Register with `name`, `email`, `password` | Creates a user with `role: "user"`, sets a session cookie and returns Better Auth's signup response. Auto-login is enabled. |
| `POST /api/auth/sign-in/email` | Sign in with `email`, `password` | Sets a session cookie and returns Better Auth's signin response. |
| `POST /api/auth/sign-out` | End the current session | Revokes the session and clears the session cookie. |
| `GET /api/auth/get-session` | Read current session | Returns `null` when unauthenticated or expired; otherwise returns `{ session, user }`. |

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

`emailVerified` is returned as stored. Signup does not send verification email
and an unverified account can sign in in this scope.

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

Login/register UI, password reset email delivery, email verification delivery,
seller onboarding/approval, admin dashboard, profile features, payments, and
purchase history require separate tasks.

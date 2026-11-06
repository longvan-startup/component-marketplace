/**
 * Builds the `redirectTo`/`callbackURL` sent to the password-reset and
 * email-verification request endpoints.
 *
 * Deliberately takes no external input (no query param, no user-supplied
 * `next`): always this app's own fixed page on the current origin. Better
 * Auth independently re-validates it against `trustedOrigins` server-side
 * (see `apps/api/src/auth/config.ts`), so this is belt-and-suspenders, not
 * the only safeguard — but accepting zero outside input here means there is
 * no open-redirect surface to review.
 */
export function resetPasswordCallbackUrl(origin: string = window.location.origin): string {
  return `${origin}/reset-password`
}

/**
 * On a successful `GET /api/auth/verify-email`, Better Auth redirects to
 * this URL completely unmodified (no params added), while on failure it
 * appends `?error=...` (see `apps/api/AUTH.md`'s "Frontend quirk"). So a
 * plain visit with no `error` param is genuinely ambiguous — "just
 * verified" and "direct visit, nothing happened yet" look identical — and
 * `app/verify-email/page.tsx` renders one calm message that's true either
 * way rather than guessing.
 */
export function verifyEmailCallbackUrl(origin: string = window.location.origin): string {
  return `${origin}/verify-email`
}

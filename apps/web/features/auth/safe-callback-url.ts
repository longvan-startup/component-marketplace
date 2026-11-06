/**
 * Builds the `redirectTo` sent to `/api/auth/request-password-reset`.
 *
 * Deliberately takes no external input (no query param, no user-supplied
 * `next`): it is always this app's own fixed `/reset-password` page on the
 * current origin. Better Auth independently re-validates it against
 * `trustedOrigins` server-side (see `apps/api/src/auth/config.ts`), so this
 * is belt-and-suspenders, not the only safeguard — but accepting zero
 * outside input here means there is no open-redirect surface to review.
 */
export function resetPasswordCallbackUrl(origin: string = window.location.origin): string {
  return `${origin}/reset-password`
}

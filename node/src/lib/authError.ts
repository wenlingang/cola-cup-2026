// Carries the reason an X OAuth sign-in failed from the callback handler to the
// auth error page, so the user sees a specific cause instead of a generic error.
export const AUTH_ERROR_COOKIE = "x_auth_error";

export type AuthErrorReason =
  | { kind: "suspended" }
  | { kind: "rate_limited"; resetEpoch: number };

const RATE_LIMITED_PREFIX = "rate_limited:";

export function encodeAuthError(reason: AuthErrorReason): string {
  return reason.kind === "rate_limited"
    ? `${RATE_LIMITED_PREFIX}${reason.resetEpoch}`
    : reason.kind;
}

export function decodeAuthError(
  value: string | undefined,
): AuthErrorReason | null {
  if (!value) return null;
  if (value === "suspended") return { kind: "suspended" };
  if (value.startsWith(RATE_LIMITED_PREFIX)) {
    const resetEpoch = Number(value.slice(RATE_LIMITED_PREFIX.length));
    if (Number.isFinite(resetEpoch)) return { kind: "rate_limited", resetEpoch };
  }
  return null;
}

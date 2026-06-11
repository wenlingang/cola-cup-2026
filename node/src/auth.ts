import NextAuth from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { cookies } from "next/headers";
import { upsertOAuthUser } from "./db/queries/users";
import {
  AUTH_ERROR_COOKIE,
  encodeAuthError,
  type AuthErrorReason,
} from "./lib/authError";

const RATE_LIMITED_STATUS = 429;
const SUSPENDED_USER_MARKER = "user-suspended";
const AUTH_ERROR_COOKIE_FALLBACK_TTL = 300;

declare module "next-auth" {
  interface Session {
    uid?: number;
  }
}

// Warn once the per-window /users/me budget drops this low, so we get an early
// heads-up before logins start failing with 429.
const LOW_RATE_LIMIT_REMAINING = 10;

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  // /users/me is only called on a fresh OAuth sign-in (see the jwt callback
  // guard). The profile then lives in the JWT, so a longer session means users
  // re-authenticate — and thus hit X's rate-limited /users/me — far less often.
  session: { strategy: "jwt", maxAge: 90 * 24 * 60 * 60 },
  pages: { error: "/auth/error" },
  providers: [
    // Minimal scope: just read the profile once at login. Drop offline.access
    // (refresh token) — we store the profile in our own session, never refresh.
    // tweet.read is required by Twitter alongside users.read even for /users/me.
    Twitter({
      authorization:
        "https://x.com/i/oauth2/authorize?scope=users.read tweet.read",
      // Stay quiet on healthy logins; surface X's raw reply only when the call
      // fails (or returns no `data`), and warn early when the rate-limit budget
      // runs low — so a missing `data` field never crashes silently.
      userinfo: {
        url: "https://api.x.com/2/users/me?user.fields=profile_image_url",
        async request({ tokens }: { tokens: { access_token?: string } }) {
          const res = await fetch(
            "https://api.x.com/2/users/me?user.fields=profile_image_url",
            { headers: { Authorization: `Bearer ${tokens.access_token}` } },
          );
          const raw = await res.text();
          const limit = res.headers.get("x-rate-limit-limit");
          const remaining = Number(res.headers.get("x-rate-limit-remaining"));
          const resetEpoch = res.headers.get("x-rate-limit-reset");
          const resetAt = resetEpoch
            ? new Date(Number(resetEpoch) * 1000).toISOString()
            : "n/a";

          if (!res.ok || !raw.includes('"data"')) {
            console.error(
              `[twitter userinfo] HTTP ${res.status} ${res.statusText} | rate-limit ${remaining}/${limit}, resets ${resetAt} :: ${raw}`,
            );
            const reason: AuthErrorReason | null = raw.includes(
              SUSPENDED_USER_MARKER,
            )
              ? { kind: "suspended" }
              : res.status === RATE_LIMITED_STATUS && resetEpoch
                ? { kind: "rate_limited", resetEpoch: Number(resetEpoch) }
                : null;
            if (reason) {
              const maxAge =
                reason.kind === "rate_limited"
                  ? Math.max(
                      60,
                      reason.resetEpoch - Math.floor(Date.now() / 1000),
                    )
                  : AUTH_ERROR_COOKIE_FALLBACK_TTL;
              try {
                (await cookies()).set(AUTH_ERROR_COOKIE, encodeAuthError(reason), {
                  maxAge,
                  path: "/",
                  sameSite: "lax",
                });
              } catch {
                // Cookie store unavailable outside a request scope — non-fatal.
              }
            }
          } else if (
            Number.isFinite(remaining) &&
            remaining <= LOW_RATE_LIMIT_REMAINING
          ) {
            console.warn(
              `[twitter userinfo] rate-limit running low: ${remaining}/${limit} left, resets ${resetAt}`,
            );
          }

          try {
            return JSON.parse(raw);
          } catch {
            return { data: undefined };
          }
        },
      },
      profile(profile) {
        const data = (profile as { data?: Record<string, unknown> }).data;
        if (!data?.id) {
          throw new Error(
            "twitter_userinfo_no_data — see [twitter userinfo] log line above",
          );
        }
        return {
          id: String(data.id),
          name: (data.name as string) ?? "球迷",
          image: (data.profile_image_url as string) ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // On sign-in, upsert into our users table and remember the local id.
      if (account && profile) {
        const data = (profile as { data?: Record<string, unknown> }).data ?? {};
        const twitterId = String(
          data.id ?? account.providerAccountId ?? token.sub,
        );
        const rawAvatar = (data.profile_image_url as string | undefined) ?? null;
        const user = upsertOAuthUser({
          provider: "twitter",
          providerAccountId: twitterId,
          username: (data.username as string | undefined) ?? null,
          name: (data.name as string | undefined) ?? "球迷",
          avatarUrl: rawAvatar
            ? rawAvatar.replace("_normal", "_400x400")
            : null,
        });
        token.uid = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (typeof token.uid === "number") session.uid = token.uid;
      return session;
    },
  },
});

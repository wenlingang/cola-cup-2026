# OIDC Login (alongside Twitter/X) — Design

- **Date:** 2026-06-12
- **Scope:** `rails/` subproject
- **Status:** Implemented (branch `feat/oidc-login`)

## Background

`rails/` authenticates exclusively via Twitter (X) OAuth 2.0, wired through
Devise + OmniAuth (`omniauth-twitter2`). There is no password login and no other
identity provider. Twitter is currently **mandatory** because three places hard-wire
it:

1. `config/initializers/devise.rb` registers `config.omniauth :twitter2, …`
   unconditionally (even with blank credentials).
2. `app/models/user.rb` declares `omniauth_providers: [:twitter2]`.
3. `app/views/identities/show.html.erb` hard-codes the "𝕏 用 Twitter 登录" button
   and X-specific lead copy.

We want to add a generic, configurable **OIDC** login as a second, fully equal
provider, and make **both** providers independently optional — so a deployment can
run Twitter-only (today's behavior), OIDC-only, or both.

## Goals

- Add a generic OIDC provider configurable via environment variables (any standard
  IdP: Keycloak, Auth0, Okta, Google, …) using OIDC discovery.
- Make Twitter and OIDC **independently toggleable**. OIDC-only is a first-class,
  supported configuration.
- Keep OIDC behavior symmetric with Twitter: first login creates a new `User`; every
  login refreshes avatar/handle from the IdP but never overwrites the user-edited
  `nickname`/`emoji`.

## Non-goals (YAGNI)

- No cross-provider account linking or merging. An OIDC identity and a Twitter
  identity are always distinct users.
- No email storage and no email-based matching (the schema has no email column).
- No manual "bind OIDC to my existing account" UI.
- No change to the X-specific error protocol (`Users::AuthFailure`).
- No change to `Settler` matching logic.

## Key constraint: identity model has no email

The `users` table has **no `email` column** — only an `encrypted_password` placeholder
so `:database_authenticatable` can serve as the Warden base. Login identity is carried
entirely by the `accounts` table: `(provider, provider_account_id)` with a unique
index on the pair, plus `username` and `avatar_url`. A `User` `has_many :accounts`.

This table is already a multi-provider design, so OIDC slots in as just another
`provider` value. It also means email-based linking is not possible without a schema
change — which we explicitly do not do.

## Approach

Use the **`omniauth_openid_connect`** gem as a second OmniAuth strategy on the existing
Devise + OmniAuth chain. Rejected alternatives: `omniauth-oauth2-generic` /
hand-rolled OAuth2 (re-implements discovery, JWKS, nonce/state — error-prone); a
standalone hand-written OIDC controller (diverges from the existing Devise/OmniAuth
pattern and duplicates the callback machinery).

`omniauth_openid_connect` gives us discovery (issuer → endpoints), JWKS signature
verification, and nonce/state out of the box, and its `auth.info` mapping aligns with
the fields the current code already reads.

## Configuration

| Env var | Purpose |
|---|---|
| `OIDC_ISSUER` | OIDC issuer URL; **presence is the on/off switch** for OIDC. |
| `OIDC_CLIENT_ID` | Client identifier. |
| `OIDC_CLIENT_SECRET` | Client secret. |
| `OIDC_DISPLAY_NAME` | Login button label (default: `"OIDC 登录"`). |
| `AUTH_TWITTER_ID` | Existing; **presence is the on/off switch** for Twitter. |
| `AUTH_TWITTER_SECRET` | Existing. |
| `AUTH_URL` | Existing; used to build the OIDC `redirect_uri`. |

Provider enablement matrix:

| `AUTH_TWITTER_ID` | `OIDC_ISSUER` | Login page |
|---|---|---|
| set | unset | X button only (current behavior) |
| unset | set | OIDC button only |
| set | set | both buttons |
| unset | unset | "no login method configured" notice (misconfiguration) |

## Components & changes

### 1. `AuthProviders` module (new)

Single source of truth for which providers are enabled and their display strings.
Used by the initializer, the model, and the views so the toggle logic lives in one
place.

- `AuthProviders.twitter_enabled?` → `ENV["AUTH_TWITTER_ID"].present?`
- `AuthProviders.oidc_enabled?` → `ENV["OIDC_ISSUER"].present?`
- `AuthProviders.oidc_display_name` → `ENV.fetch("OIDC_DISPLAY_NAME", "OIDC 登录")`
- `AuthProviders.any_enabled?`

### 2. `config/initializers/devise.rb`

Make **both** registrations conditional:

```ruby
config.omniauth :twitter2, ENV["AUTH_TWITTER_ID"], ENV["AUTH_TWITTER_SECRET"],
  scope: "tweet.read users.read" if AuthProviders.twitter_enabled?

if AuthProviders.oidc_enabled?
  config.omniauth :openid_connect,
    name: :openid_connect,
    issuer: ENV["OIDC_ISSUER"],
    discovery: true,
    scope: [:openid, :profile],
    client_options: {
      identifier:   ENV["OIDC_CLIENT_ID"],
      secret:       ENV["OIDC_CLIENT_SECRET"],
      redirect_uri: "#{ENV['AUTH_URL']}/users/auth/openid_connect/callback"
    }
end
```

The existing `OmniAuth.config.on_failure` block is unchanged.

> **`redirect_uri` / `AUTH_URL` caveat.** `redirect_uri` is built from `AUTH_URL`, so
> `AUTH_URL` must match the origin actually serving the app in each environment, and
> that exact callback URL must be registered at the IdP — otherwise the IdP rejects the
> request with a `redirect_uri` mismatch. Note `.env.example` ships
> `AUTH_URL=http://localhost:8026` (the Thruster/docker port) while `bin/dev` serves on
> `:3000`; real-IdP local testing must set `AUTH_URL` to the served origin. (The dev
> mock in §6 bypasses the real IdP, so mock-based local login is unaffected.)

### 3. `app/models/user.rb`

- `omniauth_providers: [:twitter2, :openid_connect]` (list both; route helpers are
  generated regardless of registration, and disabled providers are never linked
  because their button is hidden).
- Generalize `from_omniauth`: replace the hard-coded `PROVIDER = "twitter"` with a
  map keyed on `auth.provider`:

  ```ruby
  PROVIDERS = { "twitter2" => "twitter", "openid_connect" => "oidc" }.freeze
  ```

  Derive the stored provider via `PROVIDERS.fetch(auth.provider.to_s)`. The rest of
  `from_omniauth` (find-or-create account, refresh avatar/username, create user on
  first login, never overwrite nickname/emoji) is unchanged.
- `auth.info` already aligns across both strategies:
  `omniauth_openid_connect` maps `nickname ← preferred_username`, `name ← name`,
  `image ← picture`. So `username = auth.info.nickname` and
  `nickname_from(auth.info.name)` work for both with no branching.
- The only provider-specific bit — the `_normal → _400x400` avatar rewrite in
  `normalize_avatar` — applies **only to twitter**. OIDC uses `auth.info.image`
  (the `picture` claim) verbatim.
- **OIDC avatar is best-effort.** The `picture` claim is only present when the IdP
  populates it under `profile` scope (many, e.g. Keycloak by default, do not). When
  absent, `avatar_url` is blank and the existing `_avatar` partial falls back to a
  name initial — no special handling needed.

### 4. `app/controllers/users/omniauth_callbacks_controller.rb`

Add an `openid_connect` action. Extract the shared body of `twitter2` into a private
`handle_omniauth` (build user from `omniauth.auth`, set `remember_me = true`,
`sign_in_and_redirect`, else redirect to `identity_path`). Both actions delegate to it.
`after_sign_in_path_for` (first-time users → settings, returning → dashboard) is
unchanged.

### 5. `app/views/identities/show.html.erb`

- Render each button conditionally: X button when `AuthProviders.twitter_enabled?`,
  OIDC button when `AuthProviders.oidc_enabled?`.
- **The OIDC button MUST be `button_to` (POST), mirroring the existing X button** —
  not a GET `link_to`/`href`. `omniauth-rails_csrf_protection` (in the Gemfile)
  disables the OmniAuth request phase over GET and requires a CSRF token, which is why
  the X button is `button_to "𝕏 用 Twitter 登录", "/users/auth/twitter2"`. The OIDC
  button is `button_to AuthProviders.oidc_display_name, "/users/auth/openid_connect",
  class: "cta"`. A plain GET link would be rejected.
- Replace the X-specific lead copy with neutral copy that doesn't assume Twitter.
  New strings follow the existing **inline-Chinese-in-ERB** convention (the app does
  not route UI copy through locale files); no i18n keys are added.
- When `!AuthProviders.any_enabled?`, show a "暂未配置登录方式" notice.

### 6. `config/initializers/omniauth_test_mode.rb` (dev mock)

Today the dev mock only fakes `twitter2`. Extend it so OIDC-only local development can
exercise the login flow: when the mock is enabled (development + `OMNIAUTH_MOCK`) and
`AuthProviders.oidc_enabled?`, also register a mock `openid_connect` auth hash. It
reuses the existing `OMNIAUTH_MOCK_HANDLE` / `OMNIAUTH_MOCK_UID` env vars (same handle
and uid as the twitter mock) so no new knobs are introduced; the mock's
`info.nickname`/`name`/`image` mirror the twitter mock shape. Both mocks may be
registered at once when both providers are enabled.

### 7. `.env.example`

Document the OIDC vars and note that each provider is independently optional. Also
note that `AUTH_URL` is now load-bearing for OIDC (it builds the `redirect_uri`) and
that the OIDC callback `<AUTH_URL>/users/auth/openid_connect/callback` must be
registered at the IdP — mirroring the existing X callback-registration note.

## Data flow (OIDC login)

1. User clicks the OIDC button → `POST /users/auth/openid_connect` (via `button_to`,
   carrying the CSRF token) → OmniAuth request phase redirects to the IdP authorize
   endpoint (discovered from `OIDC_ISSUER`).
2. IdP authenticates and redirects back to
   `/users/auth/openid_connect/callback`; OmniAuth validates the ID token
   (signature via JWKS, nonce, state) and populates `request.env["omniauth.auth"]`.
3. `OmniauthCallbacksController#openid_connect` → `handle_omniauth` →
   `User.from_omniauth(auth)`:
   - `provider = "oidc"`, `provider_account_id = auth.uid` (the `sub`).
   - Existing account → refresh `username`/`avatar_url`; existing user keeps
     nickname/emoji. No account → create a new `User` + `oidc` `Account`.
4. `sign_in_and_redirect` with a 90-day remember cookie; first-time users land on
   profile setup, returning users on their dashboard.

## Settler (admin) behavior

No code change. `Settler.settler?` iterates `user.accounts` and matches each
account's `username` or `provider_account_id` against `SETTLER_USERNAMES`. OIDC
accounts are therefore automatically eligible: an admin lists the user's OIDC
`preferred_username` or `sub` in `SETTLER_USERNAMES`. Documented here so operators
know the matching value differs by provider.

## Error handling

OIDC failures flow through the existing `OmniAuth.config.on_failure`.
`Users::AuthFailure.reason_for` only recognizes the two X conditions
(`user-suspended`, HTTP 429 rate-limit) and returns `nil` otherwise, so an OIDC
failure falls through to a plain `302 /auth/error` (generic error page). This is the
intended behavior; no OIDC-specific error protocol is added.

## Testing

- `spec/models/user_omniauth_spec.rb`: OIDC first-login creates user + `oidc`
  account; returning OIDC login refreshes avatar/username but preserves
  nickname/emoji; OIDC avatar is **not** `_400x400`-rewritten.
- `spec/requests/users/omniauth_callbacks_spec.rb`: drive the `openid_connect`
  callback via `OmniAuth.config.test_mode` with a mock auth hash; assert sign-in and
  redirect.
- Login-page request spec: button visibility for each enablement combination —
  in particular **OIDC-only shows only the OIDC button and no X button**, and the
  none-configured case shows the notice.
- Provider symmetry: a Twitter login and an OIDC login with overlapping handles
  produce two distinct users (no linking).

## Resolved questions

- **Listing `:openid_connect` in `omniauth_providers` while its strategy is
  unregistered (Twitter-only deploys) is safe.** Devise's `devise_omniauth_callback`
  generates the passthru request route and the `#<provider>` callback route by
  iterating `omniauth_providers` with no `OmniAuth.strategies` registration check, so
  route generation and app boot succeed regardless. An unregistered strategy only
  matters at runtime if the request-phase route is hit — moot here because the button
  is hidden when the provider is disabled. Listing both providers and gating the
  buttons is therefore the final plan; no need to gate the `omniauth_providers` list.

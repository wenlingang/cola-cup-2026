# Local-only OmniAuth mock so the X login flow can be exercised end-to-end in
# development without real Twitter credentials — only the Twitter API boundary is
# faked; the real callback, User.from_omniauth and Devise session all run.
#
# Double-gated: active only in development AND when OMNIAUTH_MOCK is set. It never
# fires in test (each example manages its own OmniAuth.config.test_mode) or in
# production (which must always hit the real provider).
#
# Usage: OMNIAUTH_MOCK=1 SETTLER_USERNAMES=tester bin/dev
#   then click "用 X 登录" → a real session for @tester (uid 10001) is created.
if Rails.env.development? && ENV["OMNIAUTH_MOCK"].present?
  handle = ENV.fetch("OMNIAUTH_MOCK_HANDLE", "tester")
  uid = ENV.fetch("OMNIAUTH_MOCK_UID", "10001")

  OmniAuth.config.test_mode = true
  OmniAuth.config.mock_auth[:twitter2] = OmniAuth::AuthHash.new(
    provider: "twitter2",
    uid: uid,
    info: { name: "测试用户", nickname: handle, image: nil }
  )

  Rails.logger.info("[omniauth] dev mock enabled — @#{handle} (uid #{uid})")

  if AuthProviders.oidc_enabled?
    OmniAuth.config.mock_auth[:openid_connect] = OmniAuth::AuthHash.new(
      provider: "openid_connect",
      uid: uid,
      info: { name: "测试用户", nickname: handle, image: nil }
    )
    Rails.logger.info("[omniauth] dev OIDC mock enabled — @#{handle} (sub #{uid})")
  end
end

require "rails_helper"

RSpec.describe Users::AuthFailure, ".reason_for" do
  FakeResponse = Struct.new(:status, :body, :headers) unless defined?(FakeResponse)
  FakeError = Struct.new(:response) unless defined?(FakeError)

  def error(status: 200, body: "", headers: {})
    FakeError.new(FakeResponse.new(status, body, headers))
  end

  it "flags a suspended account from the response body (TTL 300)" do
    reason = described_class.reason_for(error(status: 403, body: '{"detail":"user-suspended"}'))
    expect(reason).to eq(value: "suspended", ttl: 300)
  end

  it "flags a 429 rate limit and carries the reset epoch, floored to 60s TTL" do
    now = Time.zone.at(1_700_000_000)
    reset = 1_700_000_030 # 30s out -> below the 60s floor

    reason = described_class.reason_for(
      error(status: 429, headers: { "x-rate-limit-reset" => reset.to_s }), now: now
    )

    expect(reason[:value]).to eq("rate_limited:#{reset}")
    expect(reason[:ttl]).to eq(60)
  end

  it "uses the remaining seconds as TTL when the reset is further out" do
    now = Time.zone.at(1_700_000_000)
    reset = 1_700_000_500 # 500s out

    reason = described_class.reason_for(
      error(status: 429, headers: { "x-rate-limit-reset" => reset.to_s }), now: now
    )

    expect(reason[:ttl]).to eq(500)
  end

  it "is nil for a 429 without a reset header" do
    expect(described_class.reason_for(error(status: 429))).to be_nil
  end

  it "is nil for a generic failure (no response, non-429, no marker)" do
    expect(described_class.reason_for(error(status: 500, body: "boom"))).to be_nil
    expect(described_class.reason_for(Object.new)).to be_nil
    expect(described_class.reason_for(nil)).to be_nil
  end
end

RSpec.describe Users::AuthFailure, ".response_for" do
  def env_for(error, cookie: nil)
    env = { "omniauth.error" => error }
    env["HTTP_COOKIE"] = cookie if cookie
    env
  end

  def dissect(response)
    status, headers, _body = response.to_a
    flat = headers.to_h.transform_keys(&:downcase)
    [ status, flat["location"], Array(flat["set-cookie"]).join("\n") ]
  end

  def x_error(status:, body: "", headers: {})
    response = Struct.new(:status, :body, :headers).new(status, body, headers)
    Struct.new(:response).new(response)
  end

  it "self-heals a stale request-phase CSRF token: bounce to a fresh login + guard cookie" do
    status, location, set_cookie = dissect(
      described_class.response_for(env_for(ActionController::InvalidAuthenticityToken.new))
    )

    expect(status).to eq(302)
    expect(location).to eq("/identity?auth_retry=1")
    expect(set_cookie).to include("auth_retry=1")
  end

  it "treats a stale callback state/nonce mismatch as recoverable too" do
    _status, location, _ = dissect(described_class.response_for(env_for(RuntimeError.new("csrf_detected"))))
    expect(location).to eq("/identity?auth_retry=1")
  end

  it "stops after one bounce: a second consecutive failure goes to the error page" do
    _status, location, _ = dissect(
      described_class.response_for(
        env_for(ActionController::InvalidAuthenticityToken.new, cookie: "auth_retry=1")
      )
    )

    expect(location).to eq("/auth/error")
  end

  it "routes a suspended X account to the error page with the reason cookie" do
    _status, location, set_cookie = dissect(
      described_class.response_for(env_for(x_error(status: 403, body: "user-suspended")))
    )

    expect(location).to eq("/auth/error")
    expect(set_cookie).to include("x_auth_error=suspended")
  end

  it "routes a genuinely unknown error to the generic error page without a reason cookie" do
    _status, location, set_cookie = dissect(described_class.response_for(env_for(RuntimeError.new("boom"))))

    expect(location).to eq("/auth/error")
    expect(set_cookie).not_to include("x_auth_error")
  end
end

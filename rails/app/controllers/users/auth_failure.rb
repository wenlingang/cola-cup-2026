module Users
  # Decides what happens after an OmniAuth failure (OmniAuth.config.on_failure).
  # Two shapes:
  #
  #   * Terminal X conditions (suspended / rate-limited) — show /auth/error with a
  #     specific cause carried via the x_auth_error cookie. Mirrors the legacy
  #     authError.ts protocol.
  #
  #   * Recoverable handshake failures — a stale request-phase CSRF token
  #     (ActionController::InvalidAuthenticityToken) or a stale callback
  #     state/nonce. The login form simply went out of sync with the session,
  #     usually a cached/back-button page after a logout (which rotates the CSRF
  #     token). Bounce back to a freshly rendered /identity so the next click
  #     carries a matching token — the user never has to clear cookies. Guarded
  #     to a single bounce so a genuinely broken cookie/SSL setup surfaces the
  #     error page instead of looping.
  module AuthFailure
    COOKIE = "x_auth_error"
    RETRY_COOKIE = "auth_retry"
    RETRY_TTL = 120
    SUSPENDED_MARKER = "user-suspended"
    SUSPENDED_TTL = 300
    RATE_LIMITED_STATUS = 429
    MIN_RATE_LIMITED_TTL = 60
    LOGIN_PATH = "/identity"
    ERROR_PATH = "/auth/error"
    HANDSHAKE_HINT = /csrf|state|nonce/i

    module_function

    # Entry point for the on_failure hook. Returns a Rack::Response (caller calls
    # #finish).
    def response_for(env, now: Time.current)
      error = env["omniauth.error"]

      reason = reason_for(error, now: now)
      return error_response(reason) if reason

      return retry_response if recoverable?(error) && !already_retried?(env)

      error_response(nil)
    end

    # Returns { value:, ttl: } for the x_auth_error cookie, or nil when the
    # failure is not one of the two recognised X conditions.
    def reason_for(error, now: Time.current)
      response = error.respond_to?(:response) ? error.response : nil
      return nil unless response

      return { value: "suspended", ttl: SUSPENDED_TTL } if response.body.to_s.include?(SUSPENDED_MARKER)

      reset = rate_limit_reset(response)
      return nil unless response.status == RATE_LIMITED_STATUS && reset

      { value: "rate_limited:#{reset}", ttl: [ MIN_RATE_LIMITED_TTL, reset - now.to_i ].max }
    end

    def rate_limit_reset(response)
      raw = response.headers && response.headers["x-rate-limit-reset"]
      raw.to_i if raw && raw.to_i.positive?
    end

    # A stale request-phase CSRF token, or a stale callback state/nonce — the form
    # is out of sync with the session, not a real auth rejection.
    def recoverable?(error)
      return true if error.is_a?(ActionController::InvalidAuthenticityToken)

      message = error.respond_to?(:message) ? error.message.to_s : ""
      message.match?(HANDSHAKE_HINT)
    end

    def already_retried?(env)
      Rack::Request.new(env).cookies.key?(RETRY_COOKIE)
    end

    def retry_response
      response = Rack::Response.new([], 302, { "Location" => "#{LOGIN_PATH}?auth_retry=1" })
      response.set_cookie(
        RETRY_COOKIE,
        value: "1", path: "/", max_age: RETRY_TTL, same_site: :lax, http_only: true
      )
      response
    end

    def error_response(reason)
      response = Rack::Response.new([], 302, { "Location" => ERROR_PATH })
      if reason
        response.set_cookie(
          COOKIE,
          value: reason[:value], path: "/", max_age: reason[:ttl], same_site: :lax
        )
      end
      response
    end
  end
end

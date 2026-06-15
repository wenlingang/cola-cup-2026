module Users
  # Devise resolves the user for sign_out (and its verify_signed_out_user guard)
  # with run_callbacks: false, so it only sees a user present in the *session*.
  # Someone kept signed in purely by the 90-day remember cookie (e.g. the session
  # cookie expired after a browser restart) is invisible to it: the before_logout
  # hook never fires and forget_me! never runs, leaving a still-valid
  # remember_user_token behind. That stale cookie then re-authenticates the login
  # page on every GET, churning the session's CSRF token so the next OmniAuth POST
  # fails the request-phase check with InvalidAuthenticityToken (X <-> OIDC alike).
  #
  # Forget it ourselves before Devise's session-only guard can short-circuit:
  # current_user runs the strategies, so it resolves the user even from the
  # remember cookie alone, and we clear both the DB token and the cookie.
  class SessionsController < Devise::SessionsController
    prepend_before_action :forget_remembered_user, only: :destroy

    private

    def forget_remembered_user
      current_user&.forget_me!
      cookies.delete(:remember_user_token)
    end
  end
end

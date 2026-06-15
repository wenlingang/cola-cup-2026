class IdentitiesController < ApplicationController
  def show
    if current_user
      # New users (no emoji yet) set up their profile first; everyone else lands
      # on the ledger.
      redirect_to(current_user.emoji.nil? ? me_settings_path : me_path)
    else
      # Never cache the login page: the OmniAuth request phase verifies the form's
      # CSRF token against the current session, so a cached or back-button page
      # (e.g. after a logout, which rotates the token) would post a stale token
      # and fail with InvalidAuthenticityToken. no-store also opts the page out of
      # the browser's back/forward cache.
      response.headers["Cache-Control"] = "no-store"
    end
  end
end

require "rails_helper"

# Regression: Devise's sign_out resolves the user with run_callbacks: false, so a
# user kept signed in only by the 90-day remember cookie (session cookie gone
# after a browser restart) is invisible to it — the before_logout hook never
# fires and forget_me! never runs. The leftover remember_user_token then
# re-authenticates the login page and churns the CSRF token, breaking the next
# OmniAuth login with InvalidAuthenticityToken. Users::SessionsController forces
# the forget so logout always invalidates the remember cookie.
RSpec.describe "Logout invalidates the remember cookie", type: :request do
  let(:session_key) { Rails.application.config.session_options[:key] }

  def mock_login(uid: "555")
    OmniAuth.config.test_mode = true
    OmniAuth.config.mock_auth[:twitter2] = OmniAuth::AuthHash.new(
      provider: "twitter2", uid: uid,
      info: { name: "Test User", nickname: "tester", image: nil }
    )
    post "/users/auth/twitter2"
    follow_redirect! # request phase 302 -> callback, which signs in + sets remember
  ensure
    OmniAuth.config.test_mode = false
    OmniAuth.config.mock_auth[:twitter2] = nil
  end

  it "clears the DB remember token and the cookie even when only the remember cookie is keeping the user in" do
    mock_login
    user = User.last
    expect(cookies[:remember_user_token]).to be_present
    expect(user.remember_created_at).to be_present

    # Simulate a browser restart: the session cookie is gone, the persistent
    # remember cookie remains. The user is now signed in by rememberable only.
    cookies.delete(session_key)

    delete destroy_user_session_path

    expect(user.reload.remember_created_at).to be_nil
    expect(cookies[:remember_user_token]).to be_blank
  end
end

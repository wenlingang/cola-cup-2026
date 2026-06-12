module Users
  class OmniauthCallbacksController < Devise::OmniauthCallbacksController
    # GET/POST /users/auth/twitter2/callback
    def twitter2
      handle_omniauth
    end

    # GET/POST /users/auth/openid_connect/callback
    def openid_connect
      handle_omniauth
    end

    private

    def handle_omniauth
      @user = User.from_omniauth(request.env["omniauth.auth"])

      if @user.persisted?
        @user.remember_me = true # 90-day remember cookie, like the legacy session
        sign_in_and_redirect @user, event: :authentication
      else
        redirect_to identity_path
      end
    end

    # First-time logins (no emoji chosen yet) land on the profile setup page;
    # returning users go to their dashboard.
    def after_sign_in_path_for(resource)
      resource.emoji.nil? ? me_settings_path : me_path
    end
  end
end

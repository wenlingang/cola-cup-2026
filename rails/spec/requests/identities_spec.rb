require "rails_helper"

RSpec.describe "Identity (login) page", type: :request do
  def stub_providers(twitter:, oidc:, oidc_name: "OIDC 登录")
    allow(AuthProviders).to receive(:twitter_enabled?).and_return(twitter)
    allow(AuthProviders).to receive(:oidc_enabled?).and_return(oidc)
    allow(AuthProviders).to receive(:any_enabled?).and_return(twitter || oidc)
    allow(AuthProviders).to receive(:oidc_display_name).and_return(oidc_name)
  end

  it "shows only the X button when Twitter-only" do
    stub_providers(twitter: true, oidc: false)
    get identity_path
    expect(response.body).to include("/users/auth/twitter2")
    expect(response.body).not_to include("/users/auth/openid_connect")
  end

  it "shows only the OIDC button when OIDC-only" do
    stub_providers(twitter: false, oidc: true, oidc_name: "用公司账号登录")
    get identity_path
    expect(response.body).to include("/users/auth/openid_connect")
    expect(response.body).to include("用公司账号登录")
    expect(response.body).not_to include("/users/auth/twitter2")
  end

  it "shows both buttons when both enabled" do
    stub_providers(twitter: true, oidc: true)
    get identity_path
    expect(response.body).to include("/users/auth/twitter2")
    expect(response.body).to include("/users/auth/openid_connect")
  end

  it "shows a notice when no provider is configured" do
    stub_providers(twitter: false, oidc: false)
    get identity_path
    expect(response.body).to include("暂未配置登录方式")
    expect(response.body).not_to include("/users/auth/")
  end

  it "disables Turbo on the login forms so the IdP redirect is a full-page navigation" do
    # Under Turbo the POST is a fetch that follows the cross-origin 302 to the
    # IdP and gets CORS-blocked; the forms must opt out with data-turbo=false.
    stub_providers(twitter: true, oidc: true)
    get identity_path
    expect(response.body.scan('data-turbo="false"').size).to eq(2)
  end
end

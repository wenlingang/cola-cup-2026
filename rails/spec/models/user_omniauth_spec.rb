require "rails_helper"

RSpec.describe User, ".from_omniauth" do
  def auth_hash(uid: "777", name: "Lionel Messi", nickname: "leomessi", image: "https://pbs.x/p_normal.jpg")
    OmniAuth::AuthHash.new(
      provider: "twitter2", uid: uid,
      info: { name: name, nickname: nickname, image: image }
    )
  end

  def oidc_auth_hash(uid: "sub-123", name: "Ada Lovelace", nickname: "ada", image: "https://idp/pic.png")
    OmniAuth::AuthHash.new(
      provider: "openid_connect", uid: uid,
      info: { name: name, nickname: nickname, image: image }
    )
  end

  it "creates a user and a normalized account on first login" do
    expect { User.from_omniauth(auth_hash) }
      .to change(User, :count).by(1).and change(Account, :count).by(1)

    user = User.last
    expect(user.nickname).to eq("Lionel Messi")
    expect(user.avatar_url).to eq("https://pbs.x/p_400x400.jpg") # _normal -> _400x400

    account = user.accounts.first
    expect(account.provider).to eq("twitter") # normalized from "twitter2"
    expect(account.provider_account_id).to eq("777")
    expect(account.username).to eq("leomessi")
  end

  it "truncates the display name to 16 chars and falls back to 球迷 when blank" do
    long = User.from_omniauth(auth_hash(uid: "1", name: "A very long display name"))
    expect(long.nickname).to eq("A very long disp")

    blank = User.from_omniauth(auth_hash(uid: "2", name: ""))
    expect(blank.nickname).to eq("球迷")
  end

  it "refreshes handle and avatar on re-login but never the edited nickname/emoji" do
    user = User.from_omniauth(auth_hash(uid: "9", nickname: "old_handle", image: "https://x/a_normal.png"))
    user.update!(nickname: "我的昵称", emoji: "🐉")

    expect {
      User.from_omniauth(auth_hash(uid: "9", name: "Whatever", nickname: "new_handle", image: "https://x/b_normal.png"))
    }.not_to change(User, :count)

    user.reload
    expect(user.nickname).to eq("我的昵称") # preserved
    expect(user.emoji).to eq("🐉")        # preserved
    expect(user.avatar_url).to eq("https://x/b_400x400.png") # refreshed
    expect(user.accounts.first.username).to eq("new_handle") # refreshed
  end

  it "blocks a soft-deleted user from authenticating" do
    user = User.from_omniauth(auth_hash(uid: "5"))
    expect(user.active_for_authentication?).to be(true)

    user.soft_delete!
    expect(user.active_for_authentication?).to be(false)
    expect(user.inactive_message).to eq(:deleted_account)
  end

  it "creates a user and an 'oidc' account on first OIDC login, sub as account id" do
    expect { User.from_omniauth(oidc_auth_hash) }
      .to change(User, :count).by(1).and change(Account, :count).by(1)

    account = User.last.accounts.first
    expect(account.provider).to eq("oidc")            # normalized from "openid_connect"
    expect(account.provider_account_id).to eq("sub-123")
    expect(account.username).to eq("ada")
  end

  it "uses the OIDC picture claim verbatim (no _400x400 rewrite)" do
    user = User.from_omniauth(oidc_auth_hash(image: "https://idp/avatar_normal.png"))
    expect(user.avatar_url).to eq("https://idp/avatar_normal.png") # unchanged
  end

  it "keeps Twitter and OIDC identities as separate users even with the same handle" do
    twitter = User.from_omniauth(auth_hash(uid: "100", nickname: "samehandle"))
    oidc    = User.from_omniauth(oidc_auth_hash(uid: "200", nickname: "samehandle"))
    expect(oidc.id).not_to eq(twitter.id)
    expect(Account.where(username: "samehandle").pluck(:provider)).to contain_exactly("twitter", "oidc")
  end
end
